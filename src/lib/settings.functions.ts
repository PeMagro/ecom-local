import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/sqlite/auth-middleware";
import { parseJsonColumn, type Json } from "@/lib/sqlite/json";

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  avatar_url: string | null;
  company_name: string | null;
  company_document: string | null;
  created_at: string;
  updated_at: string;
}

export const getProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const row = context.db
      .prepare(`SELECT * FROM profiles WHERE id = ?`)
      .get(context.userId) as unknown as ProfileRow | undefined;
    return row ?? null;
  });

const updateProfileInput = z.object({
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  company_name: z.string().nullable(),
  company_document: z.string().nullable(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => updateProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    context.db
      .prepare(
        `UPDATE profiles SET full_name = ?, phone = ?, company_name = ?, company_document = ? WHERE id = ?`,
      )
      .run(data.full_name, data.phone, data.company_name, data.company_document, context.userId);
    return { ok: true };
  });

interface SellerSettingsRow {
  user_id: string;
  onboarding_completed: number;
  sells_online: number | null;
  marketplaces: string;
  ai_enabled: number;
  ai_provider: string | null;
  ai_model: string | null;
  default_landing: string;
  density: string;
  currency: string;
  low_stock_threshold: number;
  notifications: string;
  created_at: string;
  updated_at: string;
}

function shapeSellerSettings(row: SellerSettingsRow) {
  return {
    ...row,
    marketplaces: parseJsonColumn<Json[]>(row.marketplaces, []),
    notifications: parseJsonColumn<Record<string, boolean>>(row.notifications, {}),
  };
}

export const getSellerSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const row = context.db
      .prepare(`SELECT * FROM seller_settings WHERE user_id = ?`)
      .get(context.userId) as unknown as SellerSettingsRow | undefined;
    return row ? shapeSellerSettings(row) : null;
  });

const updateSellerSettingsInput = z
  .object({
    onboarding_completed: z.boolean(),
    sells_online: z.boolean().nullable(),
    marketplaces: z.array(z.enum(["mercado_livre", "shopee", "amazon"])),
    ai_enabled: z.boolean(),
    default_landing: z.string(),
    density: z.string(),
    low_stock_threshold: z.number().int(),
    notifications: z.record(z.string(), z.boolean()),
  })
  .partial();

export const updateSellerSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => updateSellerSettingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.db;
    const entries = Object.entries(data).filter(
      (entry): entry is [string, NonNullable<(typeof data)[keyof typeof data]>] =>
        entry[1] !== undefined,
    );
    if (entries.length === 0) return { ok: true };

    const columns = entries.map(([key]) => `${key} = ?`).join(", ");
    const values: Array<string | number | null> = entries.map(([key, value]) => {
      if (key === "marketplaces" || key === "notifications") return JSON.stringify(value);
      if (typeof value === "boolean") return value ? 1 : 0;
      if (value === null) return null;
      return value as string | number;
    });

    db.prepare(`UPDATE seller_settings SET ${columns} WHERE user_id = ?`).run(
      ...values,
      context.userId,
    );
    return { ok: true };
  });
