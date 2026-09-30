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
