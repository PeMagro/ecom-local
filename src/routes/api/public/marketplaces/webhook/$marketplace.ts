import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getDb } from "@/lib/sqlite/client";

const notificationSchema = z.object({
  topic: z.string().max(80).optional(),
  resource: z.string().max(300).optional(),
  user_id: z.union([z.number(), z.string()]).optional(),
  application_id: z.union([z.number(), z.string()]).optional(),
});

export const Route = createFileRoute("/api/public/marketplaces/webhook/$marketplace")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (params.marketplace !== "mercado_livre") {
          return new Response("unsupported", { status: 404 });
        }

        const parsed = notificationSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("ok", { status: 200 });
        const notification = parsed.data;

        const appId = process.env["MERCADO_LIVRE_CLIENT_ID"];
        if (appId && notification.application_id && String(notification.application_id) !== appId) {
          return new Response("ok", { status: 200 });
        }

        const db = getDb();
        const { getValidAccessToken, mlFetch, ingestMercadoLivreOrder } =
          await import("@/lib/mercado-livre.server");

        const sellerId = notification.user_id ? String(notification.user_id) : null;
        if (!sellerId) return new Response("ok", { status: 200 });

        const connection = db
          .prepare(
            `SELECT id, user_id FROM marketplace_connections WHERE marketplace = 'mercado_livre' AND account_id = ?`,
          )
          .get(sellerId) as { id: string; user_id: string } | undefined;

        if (!connection) return new Response("ok", { status: 200 });

        const insertSyncLog = db.prepare(
          `INSERT INTO sync_logs (user_id, marketplace, entity, direction, status, message, finished_at)
           VALUES (?, 'mercado_livre', ?, 'inbound', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
        );

        try {
          const isOrder = (notification.topic ?? "").startsWith("orders");
          if (isOrder && notification.resource) {
            const accessToken = await getValidAccessToken(connection.id);
            if (accessToken) {
              const order = await mlFetch<Parameters<typeof ingestMercadoLivreOrder>[0]["order"]>(
                accessToken,
                notification.resource,
              );
              await ingestMercadoLivreOrder({ userId: connection.user_id, order });
            }
          }

          insertSyncLog.run(
            connection.user_id,
            notification.topic ?? "notification",
            "success",
            notification.resource ?? null,
          );
        } catch (error) {
          insertSyncLog.run(
            connection.user_id,
            notification.topic ?? "notification",
            "error",
            error instanceof Error ? error.message : "Erro ao processar notificação",
          );
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
