import { getDb } from "@/lib/sqlite/client";

export const AMZ_LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
export const AMZ_SANDBOX_API = "https://sandbox.sellingpartnerapi-na.amazon.com";

export function amzCredentials() {
  const clientId = process.env["AMAZON_SP_CLIENT_ID"];
  const clientSecret = process.env["AMAZON_SP_CLIENT_SECRET"];
  const refreshToken = process.env["AMAZON_SP_REFRESH_TOKEN"];
  return { clientId, clientSecret, refreshToken };
}

type LwaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

/** Troca o refresh token (estático, self-authorized) por um access token LWA. */
export async function refreshAmazonToken(refresh: string): Promise<LwaTokenResponse> {
  const { clientId, clientSecret } = amzCredentials();
  const res = await fetch(AMZ_LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId ?? "",
      client_secret: clientSecret ?? "",
      refresh_token: refresh,
    }),
  });
  const json = (await res.json()) as LwaTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok)
    throw new Error(json.error_description ?? json.error ?? "Falha ao renovar o token da Amazon.");
  return json;
}

/** Devolve um access token válido para a conexão, renovando quando expirado. */
export async function getValidAmazonAccessToken(connectionId: string): Promise<string | null> {
  const db = getDb();
  const data = db
    .prepare(
      `SELECT access_token, refresh_token, expires_at FROM marketplace_credentials WHERE connection_id = ?`,
    )
    .get(connectionId) as
    | { access_token: string | null; refresh_token: string | null; expires_at: string | null }
    | undefined;

  if (!data?.refresh_token) return null;

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (data.access_token && expiresAt - Date.now() > 60_000) return data.access_token;

  const renewed = await refreshAmazonToken(data.refresh_token);
  db.prepare(
    `UPDATE marketplace_credentials
     SET access_token = ?, expires_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE connection_id = ?`,
  ).run(
    renewed.access_token,
    new Date(Date.now() + (renewed.expires_in ?? 3600) * 1000).toISOString(),
    connectionId,
  );
  return renewed.access_token;
}

/** Conecta (ou reconecta) a conta Amazon do usuário usando o refresh token estático do servidor. */
export async function connectAmazon(userId: string) {
  const { clientId, clientSecret, refreshToken } = amzCredentials();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Configure AMAZON_SP_CLIENT_ID, AMAZON_SP_CLIENT_SECRET e AMAZON_SP_REFRESH_TOKEN no servidor.",
    );
  }
  const db = getDb();
  const token = await refreshAmazonToken(refreshToken);

  const connection = db
    .prepare(
      `INSERT INTO marketplace_connections
         (user_id, marketplace, status, account_name, last_error, connected_at, last_sync_at)
       VALUES (?, 'amazon', 'connected', 'Amazon Seller (sandbox)', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL)
       ON CONFLICT (user_id, marketplace) DO UPDATE SET
         status = excluded.status, account_name = excluded.account_name,
         last_error = excluded.last_error, connected_at = excluded.connected_at
       RETURNING id`,
    )
    .get(userId) as { id: string } | undefined;
  if (!connection) throw new Error("Não foi possível salvar a conexão com a Amazon.");

  db.prepare(
    `INSERT INTO marketplace_credentials (connection_id, user_id, access_token, refresh_token, token_type, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (connection_id) DO UPDATE SET
       access_token = excluded.access_token, refresh_token = excluded.refresh_token,
       token_type = excluded.token_type, expires_at = excluded.expires_at,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  ).run(
    connection.id,
    userId,
    token.access_token,
    refreshToken,
    token.token_type ?? "bearer",
    new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
  );

  return { connectionId: connection.id };
}

async function ownedConnection(userId: string) {
  const connection = getDb()
    .prepare(
      `SELECT id, status FROM marketplace_connections WHERE user_id = ? AND marketplace = 'amazon'`,
    )
    .get(userId) as { id: string; status: string } | undefined;
  if (!connection || connection.status !== "connected")
    throw new Error("Conecte sua conta da Amazon em Integrações antes de continuar.");
  const token = await getValidAmazonAccessToken(connection.id);
  if (!token) throw new Error("Autorização expirada. Reconecte sua conta.");
  return { token };
}

/** GET autenticado na Selling Partner API (sandbox). */
export async function amzFetch<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${AMZ_SANDBOX_API}${path}`, {
    headers: {
      "x-amz-access-token": accessToken,
      "Content-Type": "application/json",
      "User-Agent": "ECOM/1.0",
      Accept: "application/json",
    },
  });
  const json = (await res.json().catch(() => ({}))) as T & {
    errors?: Array<{ code?: string; message?: string }>;
  };
  if (!res.ok) {
    const message = (json.errors ?? []).map((e) => [e.code, e.message].filter(Boolean).join(": "));
    throw new Error(
      message.length ? message.join(" · ") : `Amazon respondeu ${res.status} em ${path}`,
    );
  }
  return json;
}

export type AmzJson = string | number | boolean | null | AmzJson[] | { [key: string]: AmzJson };

/** Busca o item do catálogo oficial (sandbox) para preencher dados de um novo anúncio. */
export async function getCatalogItem(
  userId: string,
  asin: string,
  marketplaceId = "ATVPDKIKX0DER",
): Promise<Record<string, AmzJson>> {
  const { token } = await ownedConnection(userId);
  const includedData = [
    "classifications",
    "dimensions",
    "identifiers",
    "images",
    "productTypes",
    "relationships",
    "salesRanks",
    "summaries",
    "vendorDetails",
  ].join(",");
  return amzFetch<Record<string, AmzJson>>(
    token,
    `/catalog/2022-04-01/items/${encodeURIComponent(asin)}?marketplaceIds=${marketplaceId}&includedData=${includedData}`,
  );
}
