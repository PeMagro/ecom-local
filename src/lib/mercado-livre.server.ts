import { createHmac, timingSafeEqual } from "crypto";

import { getDb } from "@/lib/sqlite/client";
import { applyInventoryMovement } from "@/lib/sqlite/inventory";
import { imageUrl } from "@/lib/sqlite/storage";
import {
  buildAttributes,
  buildItemPayload,
  buildSaleTerms,
  mapItemStatus,
  parseConditionalIds,
  parsePrice,
  parseStock,
  validateSpec,
  type Issue,
  type MlAttributeMeta,
  type MlMetadata,
  type MlSpec,
} from "@/lib/ml-validation";

export { buildItemPayload };

export const ML_API = "https://api.mercadolibre.com";

export function mlCredentials() {
  const clientId = process.env["MERCADO_LIVRE_CLIENT_ID"];
  const clientSecret = process.env["MERCADO_LIVRE_CLIENT_SECRET"];
  const appUrl = process.env["APP_URL"] ?? "";
  return { clientId, clientSecret, appUrl };
}

export function redirectUriFor(marketplace: string) {
  const { appUrl } = mlCredentials();
  return `${appUrl.replace(/\/$/, "")}/api/public/integracoes/callback/${marketplace}`;
}

/** Assina o state do OAuth para que o callback confie no user_id recebido. */
export function signState(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}

export function verifyState(state: string, secret: string) {
  const parts = state.split(":");
  if (parts.length !== 3) return null;
  const [userId, marketplace, signature] = parts as [string, string, string];
  const expected = signState(`${userId}:${marketplace}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { userId, marketplace };
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  user_id?: number;
};

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = mlCredentials();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId ?? "",
    client_secret: clientSecret ?? "",
    code,
    redirect_uri: redirectUriFor("mercado_livre"),
  });
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const json = (await res.json()) as TokenResponse & { message?: string; error?: string };
  if (!res.ok) throw new Error(json.message ?? json.error ?? "Falha ao trocar o código por token.");
  return json;
}

export async function refreshToken(refresh: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = mlCredentials();
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId ?? "",
      client_secret: clientSecret ?? "",
      refresh_token: refresh,
    }),
  });
  const json = (await res.json()) as TokenResponse & { message?: string };
  if (!res.ok) throw new Error(json.message ?? "Falha ao renovar o token.");
  return json;
}

/** Devolve um access token válido para a conexão, renovando quando expirado. */
export async function getValidAccessToken(connectionId: string): Promise<string | null> {
  const db = getDb();
  const data = db
    .prepare(`SELECT access_token, refresh_token, expires_at FROM marketplace_credentials WHERE connection_id = ?`)
    .get(connectionId) as { access_token: string | null; refresh_token: string | null; expires_at: string | null } | undefined;

  if (!data?.access_token) return null;

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 60_000) return data.access_token;
  if (!data.refresh_token) return data.access_token;

  const renewed = await refreshToken(data.refresh_token);
  db.prepare(
    `UPDATE marketplace_credentials
     SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE connection_id = ?`,
  ).run(
    renewed.access_token,
    renewed.refresh_token ?? data.refresh_token,
    new Date(Date.now() + (renewed.expires_in ?? 21600) * 1000).toISOString(),
    connectionId,
  );
  return renewed.access_token;
}

export async function mlFetch<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${ML_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Mercado Livre respondeu ${res.status} em ${path}`);
  return (await res.json()) as T;
}

type MlOrder = {
  id: number;
  status: string;
  date_created?: string;
  total_amount?: number;
  paid_amount?: number;
  currency_id?: string;
  buyer?: { nickname?: string; first_name?: string; last_name?: string; email?: string };
  payments?: Array<{ shipping_cost?: number }>;
  order_items?: Array<{
    item?: { id?: string; title?: string; seller_sku?: string };
    quantity?: number;
    unit_price?: number;
    sale_fee?: number;
  }>;
};

const STATUS_MAP: Record<string, "pending" | "paid" | "cancelled"> = {
  confirmed: "pending",
  payment_required: "pending",
  payment_in_process: "pending",
  partially_paid: "pending",
  paid: "paid",
  cancelled: "cancelled",
  invalid: "cancelled",
};

/** Grava um pedido do Mercado Livre e dá baixa no estoque central. */
export async function ingestMercadoLivreOrder(params: {
  userId: string;
  order: MlOrder;
}): Promise<void> {
  const { userId, order } = params;
  const db = getDb();
  const externalId = String(order.id);
  const status = STATUS_MAP[order.status] ?? "pending";
  const buyerName =
    order.buyer?.nickname ??
    [order.buyer?.first_name, order.buyer?.last_name].filter(Boolean).join(" ") ??
    null;
  const fees = (order.order_items ?? []).reduce((sum, item) => sum + (item.sale_fee ?? 0), 0);
  const shipping = order.payments?.[0]?.shipping_cost ?? 0;

  const existing = db
    .prepare(
      `SELECT id, status FROM orders WHERE user_id = ? AND marketplace = 'mercado_livre' AND external_order_id = ?`,
    )
    .get(userId, externalId) as { id: string; status: string } | undefined;

  const placedAt = order.date_created ?? new Date().toISOString();
  const rawPayload = JSON.stringify(order);

  const saved = db
    .prepare(
      `INSERT INTO orders
         (user_id, marketplace, external_order_id, status, buyer_name, buyer_email, total_amount, shipping_amount, fees_amount, currency, placed_at, raw_payload)
       VALUES (?, 'mercado_livre', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, marketplace, external_order_id) DO UPDATE SET
         status = excluded.status, buyer_name = excluded.buyer_name, buyer_email = excluded.buyer_email,
         total_amount = excluded.total_amount, shipping_amount = excluded.shipping_amount, fees_amount = excluded.fees_amount,
         currency = excluded.currency, placed_at = excluded.placed_at, raw_payload = excluded.raw_payload
       RETURNING id`,
    )
    .get(
      userId,
      externalId,
      status,
      buyerName,
      order.buyer?.email ?? null,
      order.total_amount ?? 0,
      shipping,
      fees,
      order.currency_id ?? "BRL",
      placedAt,
      rawPayload,
    ) as { id: string };

  const isNew = !existing;
  const becamePaid = status === "paid" && existing?.status !== "paid";

  if (isNew) {
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, user_id, title, sku, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const item of order.order_items ?? []) {
      insertItem.run(
        saved.id,
        userId,
        item.item?.title ?? "Item",
        item.item?.seller_sku ?? item.item?.id ?? null,
        item.quantity ?? 1,
        item.unit_price ?? 0,
        (item.unit_price ?? 0) * (item.quantity ?? 1),
      );
    }
  }

  if (!becamePaid) return;

  // Venda registrada + baixa de estoque central por SKU correspondente.
  db.prepare(
    `INSERT INTO sales (user_id, order_id, marketplace, external_order_id, buyer_name, product_title, quantity, gross_amount, fees_amount, net_amount, status, sold_at)
     VALUES (?, ?, 'mercado_livre', ?, ?, ?, ?, ?, ?, ?, 'paid', ?)`,
  ).run(
    userId,
    saved.id,
    externalId,
    buyerName,
    order.order_items?.[0]?.item?.title ?? null,
    (order.order_items ?? []).reduce((s, i) => s + (i.quantity ?? 1), 0),
    order.total_amount ?? 0,
    fees,
    (order.total_amount ?? 0) - fees,
    order.date_created ?? new Date().toISOString(),
  );

  const findProductBySku = db.prepare(`SELECT id FROM products WHERE user_id = ? AND sku = ?`);
  for (const item of order.order_items ?? []) {
    const sku = item.item?.seller_sku;
    if (!sku) continue;
    const product = findProductBySku.get(userId, sku) as { id: string } | undefined;
    if (!product) continue;

    applyInventoryMovement(db, {
      userId,
      productId: product.id,
      variantId: null,
      type: "sale",
      quantity: item.quantity ?? 1,
      reason: `Venda ${externalId} no Mercado Livre`,
      marketplace: "mercado_livre",
      orderId: saved.id,
    });
  }
}

/** Chamada com corpo JSON que devolve a mensagem de erro detalhada do Mercado Livre. */
export async function mlSend<T>(
  accessToken: string,
  method: "POST" | "PUT",
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${ML_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    error?: string;
    cause?: Array<{ message?: string; type?: string; code?: string }>;
  };
  if (!res.ok) {
    const causes = (Array.isArray(json.cause) ? json.cause : [])
      .filter((c) => c.type !== "warning")
      .map((c) => [c.code, c.message].filter(Boolean).join(": "))
      .filter(Boolean);
    const parts = [json.error, json.message, ...causes].filter(
      (p, i, arr): p is string => typeof p === "string" && p.length > 0 && arr.indexOf(p) === i,
    );
    throw new Error(parts.length ? parts.join(" · ") : `Erro ${res.status}`);
  }
  return json;
}

type MlCause = { code?: string; message?: string; type?: string; references?: string[] };

/** Chamada de validação: 204 = aceito (sem corpo); demais códigos trazem causas oficiais. */
export async function mlValidateItem(accessToken: string, payload: unknown): Promise<Issue[]> {
  const res = await fetch(`${ML_API}/items/validate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 204 || res.ok) return [];
  const text = await res.text();
  let json: { message?: string; error?: string; cause?: MlCause[] } = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }
  const causes = (json.cause ?? []).filter((c) => c.type !== "warning");
  if (!causes.length) {
    return [{ field: "official", message: [json.error, json.message].filter(Boolean).join(" · ") || `Erro ${res.status}` }];
  }
  return causes.map((c) => {
    const ref = (c.references ?? []).join(" ");
    const attr = /attributes?\.?\[?([A-Z_]+)/.exec(`${ref} ${c.message ?? ""}`)?.[1];
    const field = attr ? `attr:${attr}` : /title|family_name/.test(ref) ? "title" : /price/.test(ref) ? "price" : /quantity/.test(ref) ? "stock" : /picture/.test(ref) ? "pictures" : "official";
    return { field, message: [c.code, c.message].filter(Boolean).join(": ") };
  });
}

type Me = { id: number; tags?: string[] };

/** Metadados oficiais atuais da categoria para a conta do vendedor. */
export async function loadCategoryMetadata(token: string, categoryId: string, me: Me): Promise<MlMetadata> {
  if (!/^MLB\d+$/.test(categoryId)) throw new Error("Categoria inválida. Use o ID oficial (ex.: MLB1055).");
  const [cat, attrs, terms, types, prefs] = await Promise.all([
    mlFetch<{ id: string; name: string; path_from_root?: Array<{ name: string }>; settings?: Record<string, unknown> }>(token, `/categories/${categoryId}`),
    mlFetch<MlAttributeMeta[]>(token, `/categories/${categoryId}/attributes`),
    mlFetch<MlAttributeMeta[]>(token, `/categories/${categoryId}/sale_terms`).catch(() => [] as MlAttributeMeta[]),
    mlFetch<unknown>(token, `/users/${me.id}/available_listing_types?category_id=${categoryId}`),
    mlFetch<{ modes?: string[] }>(token, `/users/${me.id}/shipping_preferences`).catch(() => ({ modes: [] as string[] })),
  ]);
  const settings = cat.settings ?? {};
  const typeList = (Array.isArray(types) ? types : ((types as { available?: unknown[] })?.available ?? [])) as Array<{ id: string; name?: string }>;
  const catModes = Array.isArray(settings["shipping_modes"]) ? (settings["shipping_modes"] as string[]) : null;
  const userModes = prefs.modes ?? [];
  const shippingModes = catModes ? userModes.filter((m) => catModes.includes(m)) : userModes;
  return {
    categoryId: cat.id,
    categoryName: (cat.path_from_root ?? []).map((p) => p.name).join(" > ") || cat.name,
    listingAllowed: settings["listing_allowed"] !== false,
    maxTitleLength: Number(settings["max_title_length"]) || 60,
    maxPictures: Number(settings["max_pictures_per_item"]) || 10,
    itemConditions: Array.isArray(settings["item_conditions"])
      ? (settings["item_conditions"] as string[]).filter((c) => c !== "not_specified")
      : ["new"],
    userProducts: Array.isArray(me.tags) && me.tags.includes("user_product_seller"),
    listingTypes: typeList.map((t) => ({ id: t.id, name: t.name ?? t.id })),
    shippingModes: shippingModes.filter((m) => m !== "not_specified"),
    attributes: attrs.filter((a) => !a.id.startsWith("SELLER_PACKAGE_")),
    saleTerms: terms,
  };
}

async function ownedConnection(userId: string) {
  const connection = getDb()
    .prepare(`SELECT id, status FROM marketplace_connections WHERE user_id = ? AND marketplace = 'mercado_livre'`)
    .get(userId) as { id: string; status: string } | undefined;
  if (!connection || connection.status !== "connected")
    throw new Error("Conecte sua conta do Mercado Livre em Integrações antes de continuar.");
  const token = await getValidAccessToken(connection.id);
  if (!token) throw new Error("Autorização expirada. Reconecte sua conta.");
  const me = await mlFetch<Me>(token, "/users/me");
  return { token, me };
}

export async function searchCategories(userId: string, query: string) {
  const { token } = await ownedConnection(userId);
  if (/^MLB\d+$/.test(query.trim())) {
    const cat = await mlFetch<{ id: string; name: string; path_from_root?: Array<{ name: string }> }>(token, `/categories/${query.trim()}`);
    return [{ categoryId: cat.id, categoryName: (cat.path_from_root ?? []).map((p) => p.name).join(" > ") || cat.name }];
  }
  const found = await mlFetch<Array<{ category_id: string; category_name: string; domain_name?: string }>>(
    token,
    `/sites/MLB/domain_discovery/search?limit=8&q=${encodeURIComponent(query)}`,
  );
  return found.map((f) => ({ categoryId: f.category_id, categoryName: f.domain_name ? `${f.domain_name} · ${f.category_name}` : f.category_name }));
}

export async function getCategoryMetadata(userId: string, categoryId: string) {
  const { token, me } = await ownedConnection(userId);
  return loadCategoryMetadata(token, categoryId, me);
}

/** Recarrega tudo do banco/API pelo dono e monta o payload que será validado e publicado. */
interface ListingRow {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  marketplace: string;
  status: string;
  title: string | null;
  description: string | null;
  category_path: string | null;
  external_category_id: string | null;
  price: number | null;
  stock: number | null;
  external_id: string | null;
  external_url: string | null;
  validation_errors: string;
  last_error: string | null;
  published_at: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

async function prepareCandidate(userId: string, listingId: string, spec: MlSpec) {
  const db = getDb();
  const listing = db
    .prepare(`SELECT * FROM marketplace_listings WHERE id = ? AND user_id = ?`)
    .get(listingId, userId) as unknown as ListingRow | undefined;
  if (!listing) throw new Error("Falha ao ler o anúncio.");
  if (listing.marketplace !== "mercado_livre") throw new Error("Anúncio não encontrado.");
  if (listing.external_id) throw new Error(`Este anúncio já existe no Mercado Livre (${listing.external_id}).`);
  if (!spec.categoryId) throw new Error("Escolha a categoria oficial do Mercado Livre.");

  const variantCount = (
    db
      .prepare(`SELECT COUNT(*) as c FROM product_variants WHERE product_id = ? AND user_id = ?`)
      .get(listing.product_id, userId) as { c: number }
  ).c;
  if (variantCount > 0) {
    throw new Error("Produtos com variações ainda não podem ser publicados pelo ECOM nesta versão. Seu rascunho foi mantido.");
  }

  const { token, me } = await ownedConnection(userId);
  const meta = await loadCategoryMetadata(token, spec.categoryId, me);

  const images = db
    .prepare(`SELECT storage_path FROM product_images WHERE product_id = ? AND user_id = ? ORDER BY position`)
    .all(listing.product_id, userId) as Array<{ storage_path: string }>;
  const { appUrl } = mlCredentials();
  const pictures: Array<{ source: string }> = images
    .slice(0, meta.maxPictures)
    .map((image) => ({ source: `${appUrl.replace(/\/$/, "")}${imageUrl(image.storage_path)}` }));

  const basic = {
    title: listing.title ?? "",
    price: listing.price == null ? "" : String(listing.price),
    stock: listing.stock == null ? "" : String(listing.stock),
    description: listing.description ?? "",
    pictureCount: pictures.length,
  };
  let issues = validateSpec(meta, spec, basic);
  const title = basic.title.trim();
  const build = (userProducts: boolean) =>
    buildItemPayload({
      userProducts,
      title,
      familyName: title,
      categoryId: meta.categoryId,
      price: parsePrice(basic.price) ?? 0,
      stock: parseStock(basic.stock) ?? 0,
      listingTypeId: spec.listingTypeId ?? "",
      condition: spec.condition ?? "",
      pictures,
      attributes: buildAttributes(meta, spec),
      saleTerms: buildSaleTerms(meta, spec),
      shippingMode: spec.shippingMode,
    });
  const payload = build(meta.userProducts);

  // Condicionais oficiais: falha aqui bloqueia (não fingimos sucesso).
  let conditionalIds: string[] = [];
  try {
    const res = await mlSend<unknown>(token, "POST", `/categories/${meta.categoryId}/attributes/conditional`, payload);
    conditionalIds = parseConditionalIds(res);
  } catch (e) {
    throw new Error(`Não foi possível consultar os atributos condicionais da categoria. Tente novamente. (${e instanceof Error ? e.message : ""})`);
  }
  if (conditionalIds.length) issues = validateSpec(meta, spec, basic, conditionalIds);

  return { listing, token, meta, payload, build, issues, conditionalIds };
}

export async function validateListing(params: { userId: string; listingId: string; spec: MlSpec }) {
  const c = await prepareCandidate(params.userId, params.listingId, params.spec);
  if (c.issues.length) return { ok: false, issues: c.issues, conditionalIds: c.conditionalIds };
  const official = await mlValidateItem(c.token, c.payload);
  return { ok: official.length === 0, issues: official, conditionalIds: c.conditionalIds };
}

const LOCK_STALE_MS = 10 * 60 * 1000;

/** Publica: revalida no servidor, trava o registro e grava o ID antes da descrição. */
export async function publishListing(params: { userId: string; listingId: string; spec: MlSpec }) {
  const { userId, listingId, spec } = params;
  const db = getDb();
  const c = await prepareCandidate(userId, listingId, spec);
  if (c.issues.length) throw new Error(`Corrija as pendências antes de publicar: ${c.issues.map((i) => i.message).join(" · ")}`);
  const official = await mlValidateItem(c.token, c.payload);
  if (official.length) throw new Error(`O Mercado Livre recusou a validação: ${official.map((i) => i.message).join(" · ")}`);

  // Trava contra duplo clique/concorrência.
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS).toISOString();
  const locked = db
    .prepare(
      `UPDATE marketplace_listings
       SET status = 'publishing', last_error = NULL, external_category_id = ?, category_path = ?
       WHERE id = ? AND user_id = ? AND external_id IS NULL AND (status != 'publishing' OR updated_at < ?)
       RETURNING id`,
    )
    .get(c.meta.categoryId, c.meta.categoryName, listingId, userId, staleBefore) as { id: string } | undefined;
  if (!locked) throw new Error("Este anúncio já está sendo publicado ou já foi publicado.");

  type Created = { id: string; permalink?: string; status?: string };
  let item: Created;
  try {
    try {
      item = await mlSend<Created>(c.token, "POST", "/items", c.payload);
    } catch (firstError) {
      const msg = firstError instanceof Error ? firstError.message : "";
      // Fallback único: conta tradicional recusada por exigir family_name (User Products).
      if (c.meta.userProducts || !msg.includes("family_name")) throw firstError;
      try {
        item = await mlSend<Created>(c.token, "POST", "/items", c.build(true));
      } catch (secondError) {
        const second = secondError instanceof Error ? secondError.message : "Falha";
        throw new Error(`${second} (tentativa anterior: ${msg})`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao publicar.";
    db.prepare(
      `UPDATE marketplace_listings SET status = 'error', last_error = ? WHERE id = ? AND user_id = ? AND external_id IS NULL`,
    ).run(message, listingId, userId);
    throw new Error(message);
  }

  const status = mapItemStatus(item.status);
  db.prepare(
    `UPDATE marketplace_listings
     SET status = ?, external_id = ?, external_url = ?, published_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         last_sync_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         last_error = ?
     WHERE id = ? AND user_id = ?`,
  ).run(
    status,
    item.id,
    item.permalink ?? null,
    status === "publishing" ? "O Mercado Livre ainda está processando o anúncio." : null,
    listingId,
    userId,
  );

  let warning: string | null = status === "publishing" ? "O Mercado Livre ainda está processando o anúncio." : null;
  const description = (c.listing.description ?? "").trim();
  if (description) {
    try {
      await mlSend(c.token, "POST", `/items/${item.id}/description`, { plain_text: description });
    } catch (e) {
      warning = `Anúncio criado (${item.id}), mas a descrição não foi enviada: ${e instanceof Error ? e.message : "erro"}. Adicione a descrição diretamente no Mercado Livre.`;
      db.prepare(`UPDATE marketplace_listings SET last_error = ? WHERE id = ? AND user_id = ?`).run(
        warning,
        listingId,
        userId,
      );
    }
  }

  return { externalId: item.id, url: item.permalink ?? null, status, warning };
}
