import { createMiddleware } from "@tanstack/react-start";

import { getDb } from "@/lib/sqlite/client";
import { getSessionUserId } from "@/lib/sqlite/session";

/** Server-fn middleware: injects { userId, db } from the session cookie, or throws if unauthenticated. */
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new Error("Unauthorized: no active session");
  }

  return next({ context: { userId, db: getDb() } });
});
