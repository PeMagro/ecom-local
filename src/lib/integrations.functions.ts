import { createServerFn } from "@tanstack/react-start";

import { z } from "zod";

import type { MlSpec } from "@/lib/ml-validation";
import { requireAuth } from "@/lib/sqlite/auth-middleware";
import type { MarketplaceChannel } from "@/lib/marketplaces";

const ENV_KEYS: Record<MarketplaceChannel, { id: string; secret: string; authorizeUrl: string }> = {
  mercado_livre: {
    id: "MERCADO_LIVRE_CLIENT_ID",
    secret: "MERCADO_LIVRE_CLIENT_SECRET",
    authorizeUrl: "https://auth.mercadolivre.com.br/authorization",
  },
  shopee: {
    id: "SHOPEE_PARTNER_ID",
    secret: "SHOPEE_PARTNER_KEY",
    authorizeUrl: "https://partner.shopeemobile.com/api/v2/shop/auth_partner",
  },
  amazon: {
    id: "AMAZON_SP_CLIENT_ID",
    secret: "AMAZON_SP_CLIENT_SECRET",
    authorizeUrl: "https://sellercentral.amazon.com.br/apps/authorize/consent",
  },
};

interface MarketplaceConnectionRow {
  status: "disconnected" | "connecting" | "connected" | "error";
  account_id: string | null;
  account_name: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
}

export const getMarketplaceConnection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ marketplace: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const row = context.db
      .prepare(
        `SELECT status, account_id, account_name, connected_at, last_sync_at, last_error
         FROM marketplace_connections WHERE user_id = ? AND marketplace = ?`,
      )
      .get(context.userId, data.marketplace) as unknown as MarketplaceConnectionRow | undefined;
    return row ?? null;
  });

/**
 * Inicia a conexão OAuth de um marketplace.
 * Sem credenciais de aplicação configuradas no servidor, retorna instrução
 * em vez de simular uma conexão concluída.
 */
export const startMarketplaceConnection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { marketplace: MarketplaceChannel }) => input)
  .handler(async ({ data, context }) => {
    const config = ENV_KEYS[data.marketplace];
    const clientId = process.env[config.id];
    const clientSecret = process.env[config.secret];
    const status = clientId && clientSecret ? "connecting" : "disconnected";
    const lastError =
      clientId && clientSecret
        ? null
        : "Credenciais de aplicação ainda não configuradas no servidor.";

    context.db
      .prepare(
        `INSERT INTO marketplace_connections (user_id, marketplace, status, last_error)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, marketplace) DO UPDATE SET status = excluded.status, last_error = excluded.last_error`,
      )
      .run(context.userId, data.marketplace, status, lastError);

    if (!clientId || !clientSecret) {
      return {
        authorizationUrl: null as string | null,
        message: `Configure ${config.id} e ${config.secret} no servidor para habilitar a conexão OAuth.`,
      };
    }

    const { signState, redirectUriFor } = await import("@/lib/mercado-livre.server");
    const redirectUri = redirectUriFor(data.marketplace);
    const statePayload = `${context.userId}:${data.marketplace}`;
    const url = new URL(config.authorizeUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", `${statePayload}:${signState(statePayload, clientSecret)}`);

    return { authorizationUrl: url.toString(), message: null as string | null };
  });

/** Busca os pedidos recentes do Mercado Livre e atualiza pedidos, vendas e estoque. */
export const syncMarketplace = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { marketplace: MarketplaceChannel }) => input)
  .handler(async ({ data, context }) => {
    if (data.marketplace !== "mercado_livre") {
      return { synced: 0, message: "Sincronização disponível apenas para o Mercado Livre." };
    }

    const connection = context.db
      .prepare(
        `SELECT id, account_id, status FROM marketplace_connections WHERE user_id = ? AND marketplace = 'mercado_livre'`,
      )
      .get(context.userId) as { id: string; account_id: string | null; status: string } | undefined;

    if (!connection || connection.status !== "connected" || !connection.account_id) {
      return { synced: 0, message: "Conecte sua conta do Mercado Livre antes de sincronizar." };
    }

    const { getValidAccessToken, mlFetch, ingestMercadoLivreOrder } =
      await import("@/lib/mercado-livre.server");

    const accessToken = await getValidAccessToken(connection.id);
    if (!accessToken) {
      return { synced: 0, message: "Autorização expirada. Reconecte sua conta." };
    }

    const result = await mlFetch<{ results?: unknown[] }>(
      accessToken,
      `/orders/search?seller=${connection.account_id}&sort=date_desc&limit=30`,
    );

    const orders = (result.results ?? []) as Parameters<
      typeof ingestMercadoLivreOrder
    >[0]["order"][];

    for (const order of orders) {
      await ingestMercadoLivreOrder({ userId: context.userId, order });
    }

    context.db
      .prepare(
        `UPDATE marketplace_connections SET last_sync_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), last_error = NULL WHERE id = ?`,
      )
      .run(connection.id);

    return { synced: orders.length, message: null as string | null };
  });

/** Revoga a conexão local do Mercado Livre do usuário autenticado. */
export const disconnectMarketplace = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ marketplace: z.literal("mercado_livre") }).parse(input),
  )
  .handler(async ({ context }) => {
    const connection = context.db
      .prepare(
        `SELECT id FROM marketplace_connections WHERE user_id = ? AND marketplace = 'mercado_livre'`,
      )
      .get(context.userId) as { id: string } | undefined;
    if (!connection) return { disconnected: false };

    context.db
      .prepare(`DELETE FROM marketplace_credentials WHERE connection_id = ? AND user_id = ?`)
      .run(connection.id, context.userId);

    context.db
      .prepare(
        `UPDATE marketplace_connections
         SET status = 'disconnected', connected_at = NULL, last_sync_at = NULL, last_error = NULL
         WHERE id = ? AND user_id = ?`,
      )
      .run(connection.id, context.userId);

    return { disconnected: true };
  });

const specSchema = z.object({
  v: z.literal(1),
  categoryId: z
    .string()
    .regex(/^MLB\d+$/)
    .nullable(),
  categoryName: z.string().max(500).nullable(),
  condition: z.string().max(40).nullable(),
  listingTypeId: z.string().max(60).nullable(),
  shippingMode: z.string().max(40).nullable(),
  attributes: z.record(z.string().max(80), valueSchema()),
  saleTerms: z.record(z.string().max(80), valueSchema()),
  pkg: z.object({
    weight: z.string().max(12),
    height: z.string().max(12),
    width: z.string().max(12),
    length: z.string().max(12),
  }),
});
function valueSchema() {
  return z.object({
    value_id: z.string().max(80).optional(),
    value_name: z.string().max(500).optional(),
    unit: z.string().max(20).optional(),
  });
}
const listingInput = z.object({ listingId: z.string().uuid(), spec: specSchema });
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export const searchMlCategories = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().trim().min(2).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { searchCategories } = await import("@/lib/mercado-livre.server");
    try {
      return {
        results: await searchCategories(context.userId, data.query),
        message: null as string | null,
      };
    } catch (e) {
      return { results: [], message: errText(e, "Falha ao buscar categorias.") };
    }
  });

export const getMlCategoryMetadata = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z.object({ categoryId: z.string().regex(/^MLB\d+$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getCategoryMetadata } = await import("@/lib/mercado-livre.server");
    return getCategoryMetadata(context.userId, data.categoryId);
  });

/** Completa a ficha técnica obrigatória com a ECO, validando contra os metadados oficiais. */
export const suggestMlSpecWithAi = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        categoryId: z.string().regex(/^MLB\d+$/),
        condition: z.string().max(40).nullable().default(null),
        conditionalIds: z.array(z.string().max(60)).max(80).default([]),
        title: z.string().max(300).default(""),
        description: z.string().max(5000).default(""),
        brand: z.string().max(120).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { suggestMlSpec } = await import("@/lib/ml-ai.server");
    try {
      return await suggestMlSpec({
        userId: context.userId,
        categoryId: data.categoryId,
        condition: data.condition,
        conditionalIds: data.conditionalIds,
        product: { title: data.title, description: data.description, brand: data.brand },
      });
    } catch (e) {
      return {
        attributes: {},
        saleTerms: {},
        message: errText(e, "Falha ao completar com a ECO."),
      };
    }
  });

export const validateMlListing = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => listingInput.parse(input))
  .handler(async ({ data, context }) => {
    const { validateListing } = await import("@/lib/mercado-livre.server");
    try {
      return await validateListing({
        userId: context.userId,
        listingId: data.listingId,
        spec: data.spec as MlSpec,
      });
    } catch (e) {
      return {
        ok: false,
        issues: [{ field: "official", message: errText(e, "Falha na validação.") }],
        conditionalIds: [] as string[],
      };
    }
  });

/** Publica um anúncio do Mercado Livre com a ficha revisada no editor. */
export const publishListingToMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => listingInput.parse(input))
  .handler(async ({ data, context }) => {
    const { publishListing } = await import("@/lib/mercado-livre.server");
    try {
      const r = await publishListing({
        userId: context.userId,
        listingId: data.listingId,
        spec: data.spec as MlSpec,
      });
      return {
        ok: true as const,
        url: r.url,
        externalId: r.externalId,
        status: r.status,
        warning: r.warning,
        message: null as string | null,
      };
    } catch (error) {
      return {
        ok: false as const,
        url: null,
        externalId: null,
        status: null,
        warning: null,
        message: errText(error, "Falha ao publicar."),
      };
    }
  });
