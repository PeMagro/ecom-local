import {
  clearSession,
  getSession,
  updateSession,
  type SessionConfig,
} from "@tanstack/react-start/server";

type SessionData = { userId: string };

const secret = process.env["SESSION_SECRET"];
if (!secret || secret.length < 32) {
  throw new Error("SESSION_SECRET must be set in .env to at least 32 characters.");
}

export const sessionConfig: SessionConfig = {
  password: secret,
  name: "ecom_session",
  maxAge: 60 * 60 * 24 * 30, // 30 days
  cookie: {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
  },
};

export async function getSessionUserId(): Promise<string | null> {
  const session = await getSession<SessionData>(sessionConfig);
  return session.data.userId ?? null;
}

export async function setSessionUserId(userId: string): Promise<void> {
  await updateSession<SessionData>(sessionConfig, { userId });
}

export async function clearSessionCookie(): Promise<void> {
  await clearSession(sessionConfig);
}
