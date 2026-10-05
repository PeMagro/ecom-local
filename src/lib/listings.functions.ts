import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/sqlite/auth-middleware";
import { parseJsonColumn, type Json } from "@/lib/sqlite/json";

interface ListingRow {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  marketplace: "mercado_livre" | "shopee" | "amazon";
  status: "draft" | "ready" | "publishing" | "active" | "paused" | "error";
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

export const listListings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rows = context.db
      .prepare(`SELECT * FROM marketplace_listings WHERE user_id = ? ORDER BY updated_at DESC`)
      .all(context.userId) as unknown as ListingRow[];
    return rows.map((r) => ({
      ...r,
      validation_errors: parseJsonColumn<Json[]>(r.validation_errors, []),
    }));
  });

const idInput = z.object({ id: z.string() });

export const deleteListing = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    context.db
      .prepare(`DELETE FROM marketplace_listings WHERE id = ? AND user_id = ?`)
      .run(data.id, context.userId);
    return { ok: true };
  });

const MARKETPLACE_ENUM = z.enum(["mercado_livre", "shopee", "amazon"]);

const upsertListingDraftInput = z.object({
  productId: z.string(),
  marketplace: MARKETPLACE_ENUM,
  title: z.string(),
  description: z.string(),
  price: z.number().nullable(),
  stock: z.number().int().nullable(),
  categoryPath: z.string().nullable().default(null),
  externalCategoryId: z.string().nullable().default(null),
  // Opaque per-platform payload (Mercado Livre: condition/listing type/
  // attributes/sale terms/package dims; Shopee/Amazon will shape their own).
  platformData: z.record(z.string(), z.custom<Json>()).default({}),
});

/**
 * Cria/atualiza o rascunho em marketplace_listings de um produto para UM
 * marketplace — a tela de anúncio chama isso uma vez por plataforma
 * selecionada. Exigido antes de validar/publicar (validateMlListing,
 * publishListingToMercadoLivre, e os equivalentes futuros de outras
 * plataformas esperam um listingId já existente).
 */
export const upsertListingDraft = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => upsertListingDraftInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.db;
    const platformDataJson = JSON.stringify(data.platformData);
    const existing = db
      .prepare(
        `SELECT id FROM marketplace_listings
         WHERE user_id = ? AND product_id = ? AND marketplace = ? AND external_id IS NULL`,
      )
      .get(context.userId, data.productId, data.marketplace) as { id: string } | undefined;

    if (existing) {
      db.prepare(
        `UPDATE marketplace_listings
         SET title = ?, description = ?, price = ?, stock = ?,
             category_path = ?, external_category_id = ?, platform_data = ?
         WHERE id = ? AND user_id = ?`,
      ).run(
        data.title,
        data.description,
        data.price,
        data.stock,
        data.categoryPath,
        data.externalCategoryId,
        platformDataJson,
        existing.id,
        context.userId,
      );
      return { id: existing.id };
    }

    const inserted = db
      .prepare(
        `INSERT INTO marketplace_listings
           (user_id, product_id, marketplace, status, title, description, price, stock,
            category_path, external_category_id, platform_data)
         VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
      )
      .get(
        context.userId,
        data.productId,
        data.marketplace,
        data.title,
        data.description,
        data.price,
        data.stock,
        data.categoryPath,
        data.externalCategoryId,
        platformDataJson,
      ) as { id: string };
    return { id: inserted.id };
  });

interface ListingDraftRow {
  id: string;
  marketplace: "mercado_livre" | "shopee" | "amazon";
  status: string;
  title: string | null;
  description: string | null;
  price: number | null;
  stock: number | null;
  category_path: string | null;
  external_category_id: string | null;
  platform_data: string;
  external_id: string | null;
  external_url: string | null;
  last_error: string | null;
}

const draftsForProductInput = z.object({ productId: z.string() });

/** Carrega os rascunhos existentes de um produto, um por marketplace já iniciado — usado para reabrir a tela de anúncio com o que já foi preenchido. */
export const getListingDraftsForProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => draftsForProductInput.parse(input))
  .handler(async ({ data, context }) => {
    const rows = context.db
      .prepare(
        `SELECT id, marketplace, status, title, description, price, stock,
                category_path, external_category_id, platform_data,
                external_id, external_url, last_error
         FROM marketplace_listings WHERE user_id = ? AND product_id = ?`,
      )
      .all(context.userId, data.productId) as unknown as ListingDraftRow[];
    return rows.map((r) => ({
      ...r,
      platform_data: parseJsonColumn<Record<string, Json>>(r.platform_data, {}),
    }));
  });

interface ListingProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  barcode: string | null;
  brand: string | null;
}

interface ProductImageIdRow {
  id: string;
}

/** Product picker used by anuncios/novo — mirrors the old `.select("id, name, description, price, barcode, brand, product_images(id)")`. */
export const listProductsForListingPicker = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = context.db;
    const products = db
      .prepare(
        `SELECT id, name, description, price, barcode, brand FROM products WHERE user_id = ? ORDER BY name`,
      )
      .all(context.userId) as unknown as ListingProductRow[];
    const imageStmt = db.prepare(`SELECT id FROM product_images WHERE product_id = ?`);
    return products.map((p) => ({
      ...p,
      product_images: imageStmt.all(p.id) as unknown as ProductImageIdRow[],
    }));
  });
