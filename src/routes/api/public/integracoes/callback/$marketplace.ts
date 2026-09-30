import { createFileRoute } from "@tanstack/react-router";

import { getDb } from "@/lib/sqlite/client";

export const Route = createFileRoute("/api/public/integracoes/callback/$marketplace")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const appUrl = (process.env["APP_URL"] ?? "").replace(/\/$/, "");
        const back = (query: string) => Response.redirect(`${appUrl}/integracoes?${query}`, 302);

        if (params.marketplace !== "mercado_livre") {
          return back("integracao=erro&motivo=canal_nao_suportado");
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const clientSecret = process.env["MERCADO_LIVRE_CLIENT_SECRET"];

        if (!code || !state || !clientSecret) {
          return back("integracao=erro&motivo=parametros_invalidos");
        }

        const { verifyState, exchangeCodeForToken, mlFetch } =
          await import("@/lib/mercado-livre.server");
        const verified = verifyState(state, clientSecret);
        if (!verified || verified.marketplace !== "mercado_livre") {
          return back("integracao=erro&motivo=state_invalido");
        }

        const db = getDb();

        try {
          const token = await exchangeCodeForToken(code);
          const me = await mlFetch<{
            id: number;
            nickname?: string;
            email?: string;
            site_id?: string;
          }>(token.access_token, "/users/me");

          const connection = db
            .prepare(
              `INSERT INTO marketplace_connections
                 (user_id, marketplace, status, account_id, account_name, account_email, site_id, last_error, connected_at, last_sync_at)
               VALUES (?, 'mercado_livre', 'connected', ?, ?, ?, ?, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
               ON CONFLICT (user_id, marketplace) DO UPDATE SET
                 status = excluded.status, account_id = excluded.account_id, account_name = excluded.account_name,
                 account_email = excluded.account_email, site_id = excluded.site_id, last_error = excluded.last_error,
                 connected_at = excluded.connected_at, last_sync_at = excluded.last_sync_at
               RETURNING id`,
            )
            .get(
              verified.userId,
              String(me.id),
              me.nickname ?? null,
              me.email ?? null,
              me.site_id ?? "MLB",
            ) as { id: string } | undefined;

          if (!connection) return back("integracao=erro&motivo=conexao_nao_salva");

          db.prepare(
            `INSERT INTO marketplace_credentials (connection_id, user_id, access_token, refresh_token, token_type, expires_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (connection_id) DO UPDATE SET
               access_token = excluded.access_token, refresh_token = excluded.refresh_token,
               token_type = excluded.token_type, expires_at = excluded.expires_at,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
          ).run(
            connection.id,
            verified.userId,
            token.access_token,
            token.refresh_token ?? null,
            token.token_type ?? "bearer",
            new Date(Date.now() + (token.expires_in ?? 21600) * 1000).toISOString(),
          );

          return back("integracao=sucesso&canal=mercado_livre");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro desconhecido";
          db.prepare(
            `INSERT INTO marketplace_connections (user_id, marketplace, status, last_error)
             VALUES (?, 'mercado_livre', 'error', ?)
             ON CONFLICT (user_id, marketplace) DO UPDATE SET status = excluded.status, last_error = excluded.last_error`,
          ).run(verified.userId, message);
          return back(`integracao=erro&motivo=${encodeURIComponent(message)}`);
        }
      },
    },
  },
});
