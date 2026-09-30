import { createServerFn } from "@tanstack/react-start";

import { requireAuth } from "@/lib/sqlite/auth-middleware";

interface AlertRow {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  severity: "info" | "warning" | "critical";
}

export const listUnreadAlerts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return context.db
      .prepare(
        `SELECT id, title, description, created_at, severity
         FROM alerts WHERE user_id = ? AND read_at IS NULL
         ORDER BY created_at DESC LIMIT 8`,
      )
      .all(context.userId) as unknown as AlertRow[];
  });
