import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/sqlite/auth-middleware";
import { getDb } from "@/lib/sqlite/client";
import { hashPassword, verifyPassword } from "@/lib/sqlite/passwords";
import { clearSessionCookie, getSessionUserId, setSessionUserId } from "@/lib/sqlite/session";
import { isValidCpf } from "@/lib/format";

type UserRow = { id: string; email: string; password_hash: string };
type PublicUser = { id: string; email: string; fullName: string | null };

function getUserByEmail(email: string): UserRow | undefined {
  return getDb()
    .prepare(`SELECT id, email, password_hash FROM users WHERE email = ?`)
    .get(email) as UserRow | undefined;
}

function loadPublicUser(userId: string): PublicUser | null {
  const row = getDb()
    .prepare(
      `SELECT u.id as id, u.email as email, p.full_name as full_name FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = ?`,
    )
    .get(userId) as { id: string; email: string; full_name: string | null } | undefined;
  if (!row) return null;
  return { id: row.id, email: row.email, fullName: row.full_name };
}

const signupInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  fullName: z.string().trim().min(3, "Informe seu nome completo."),
  cpf: z.string().refine(isValidCpf, "CPF inválido."),
});

export const signup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupInput.parse(input))
  .handler(async ({ data }) => {
    const db = getDb();
    if (getUserByEmail(data.email)) {
      throw new Error("Este e-mail já está cadastrado.");
    }

    const passwordHash = hashPassword(data.password);
    const inserted = db
      .prepare(`INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id`)
      .get(data.email, passwordHash) as { id: string };

    db.prepare(`UPDATE profiles SET full_name = ?, cpf = ? WHERE id = ?`).run(
      data.fullName,
      data.cpf.replace(/\D+/g, ""),
      inserted.id,
    );

    await setSessionUserId(inserted.id);
    return loadPublicUser(inserted.id)!;
  });

const loginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => loginInput.parse(input))
  .handler(async ({ data }) => {
    const user = getUserByEmail(data.email);
    if (!user || !verifyPassword(data.password, user.password_hash)) {
      throw new Error("E-mail ou senha inválidos.");
    }
    await setSessionUserId(user.id);
    return loadPublicUser(user.id)!;
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await clearSessionCookie();
  return { ok: true };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await getSessionUserId();
  if (!userId) return { user: null };
  return { user: loadPublicUser(userId) };
});

const changePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres."),
});

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => changePasswordInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.db;
    const row = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(context.userId) as
      { password_hash: string } | undefined;
    if (!row || !verifyPassword(data.currentPassword, row.password_hash)) {
      throw new Error("Senha atual incorreta.");
    }
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
      hashPassword(data.newPassword),
      context.userId,
    );
    return { ok: true };
  });
