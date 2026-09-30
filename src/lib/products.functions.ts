import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/sqlite/auth-middleware";
import { applyInventoryMovement } from "@/lib/sqlite/inventory";
import { deleteProductImageFile, saveProductImage } from "@/lib/sqlite/storage";

interface ProductRow {
  id: string;
  user_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  category: string | null;
  brand: string | null;
  status: "active" | "inactive" | "archived";
  price: number | null;
  cost: number | null;
  weight_grams: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

interface VariantRow {
  id: string;
  product_id: string;
  user_id: string;
  name: string;
  sku: string | null;
  price: number | null;
  attributes: string;
  created_at: string;
  updated_at: string;
}

interface ProductImageRow {
  id: string;
  product_id: string;
  user_id: string;
  storage_path: string;
  position: number;
  alt_text: string | null;
  created_at: string;
}

interface BalanceRow {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  reserved: number;
  low_stock_threshold: number;
  updated_at: string;
  created_at: string;
}

interface ListingIdRow {
  id: string;
}

const productPayload = z.object({
  name: z.string().trim().min(1),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  brand: z.string().nullable(),
  status: z.enum(["active", "inactive", "archived"]),
  price: z.number().nullable(),
  cost: z.number().nullable(),
  weight_grams: z.number().nullable(),
  length_cm: z.number().nullable(),
  width_cm: z.number().nullable(),
  height_cm: z.number().nullable(),
  low_stock_threshold: z.number().int(),
});

const PRODUCT_COLUMNS = [
  "name",
  "sku",
  "barcode",
  "description",
  "category",
  "brand",
  "status",
  "price",
  "cost",
  "weight_grams",
  "length_cm",
  "width_cm",
  "height_cm",
  "low_stock_threshold",
] as const satisfies ReadonlyArray<keyof ProductRow>;

export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = context.db;
    const products = db
      .prepare(`SELECT * FROM products WHERE user_id = ? ORDER BY created_at DESC`)
      .all(context.userId) as unknown as ProductRow[];
    const balanceStmt = db.prepare(`SELECT quantity FROM inventory_balances WHERE product_id = ?`);
    const listingStmt = db.prepare(`SELECT id FROM marketplace_listings WHERE product_id = ?`);
    return products.map((p) => ({
      ...p,
      inventory_balances: balanceStmt.all(p.id) as unknown as Array<{ quantity: number }>,
      marketplace_listings: listingStmt.all(p.id) as unknown as ListingIdRow[],
    }));
  });

const idInput = z.object({ id: z.string() });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    context.db
      .prepare(`DELETE FROM products WHERE id = ? AND user_id = ?`)
      .run(data.id, context.userId);
    return { ok: true };
  });

export const duplicateProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.db;
    const original = db
      .prepare(`SELECT ${PRODUCT_COLUMNS.join(", ")} FROM products WHERE id = ? AND user_id = ?`)
      .get(data.id, context.userId) as unknown as
      Pick<ProductRow, (typeof PRODUCT_COLUMNS)[number]> | undefined;
    if (!original) throw new Error("Produto não encontrado.");

    const values: Array<string | number | null> = PRODUCT_COLUMNS.map((col) => {
      if (col === "name") return `${original.name} (cópia)`;
      if (col === "sku") return original.sku ? `${original.sku}-COPIA` : null;
      return original[col] ?? null;
    });

    const created = db
      .prepare(
        `INSERT INTO products (user_id, ${PRODUCT_COLUMNS.join(", ")})
         VALUES (?, ${PRODUCT_COLUMNS.map(() => "?").join(", ")})
         RETURNING id`,
      )
      .get(context.userId, ...values) as { id: string };

    return { id: created.id };
  });

export const getProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.db;
    const product = db
      .prepare(`SELECT * FROM products WHERE id = ? AND user_id = ?`)
      .get(data.id, context.userId) as unknown as ProductRow | undefined;
    if (!product) return null;

    return {
      ...product,
      product_variants: db
        .prepare(`SELECT * FROM product_variants WHERE product_id = ? ORDER BY created_at`)
        .all(data.id) as unknown as VariantRow[],
      product_images: db
        .prepare(`SELECT * FROM product_images WHERE product_id = ? ORDER BY position, created_at`)
        .all(data.id) as unknown as ProductImageRow[],
      inventory_balances: db
        .prepare(`SELECT * FROM inventory_balances WHERE product_id = ?`)
        .all(data.id) as unknown as BalanceRow[],
    };
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => productPayload.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.db;
    const values: Array<string | number | null> = PRODUCT_COLUMNS.map((col) => data[col] ?? null);
    const created = db
      .prepare(
        `INSERT INTO products (user_id, ${PRODUCT_COLUMNS.join(", ")})
         VALUES (?, ${PRODUCT_COLUMNS.map(() => "?").join(", ")})
         RETURNING id`,
      )
      .get(context.userId, ...values) as { id: string };
    return { id: created.id };
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => productPayload.extend({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.db;
    const values: Array<string | number | null> = PRODUCT_COLUMNS.map((col) => data[col] ?? null);
    db.prepare(
      `UPDATE products SET ${PRODUCT_COLUMNS.map((c) => `${c} = ?`).join(", ")} WHERE id = ? AND user_id = ?`,
    ).run(...values, data.id, context.userId);
    return { id: data.id };
  });

const createVariantInput = z.object({
  productId: z.string(),
  name: z.string().trim().min(1),
  sku: z.string().nullable(),
});

export const createVariant = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => createVariantInput.parse(input))
  .handler(async ({ data, context }) => {
    context.db
      .prepare(`INSERT INTO product_variants (user_id, product_id, name, sku) VALUES (?, ?, ?, ?)`)
      .run(context.userId, data.productId, data.name, data.sku);
    return { ok: true };
  });

const addStockInput = z.object({
  productId: z.string(),
  variantId: z.string().nullable(),
  quantity: z.number().int().positive(),
  reason: z.string().nullable(),
});

/** Used by the product editor: always an "entry" (initial or manual), never the "out"/adjustment UI flow in Estoque. */
export const addProductStock = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => addStockInput.parse(input))
  .handler(async ({ data, context }) => {
    return applyInventoryMovement(context.db, {
      userId: context.userId,
      productId: data.productId,
      variantId: data.variantId,
      type: "entry",
      quantity: data.quantity,
      reason: data.reason,
    });
  });

export const uploadProductImage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: FormData) => data)
  .handler(async ({ data, context }) => {
    const productId = data.get("productId");
    const file = data.get("file");
    if (typeof productId !== "string" || !productId) throw new Error("productId ausente.");
    if (!(file instanceof File)) throw new Error("Arquivo ausente.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const path = await saveProductImage(context.userId, productId, buffer, file.name);

    try {
      context.db
        .prepare(
          `INSERT INTO product_images (user_id, product_id, storage_path, alt_text) VALUES (?, ?, ?, ?)`,
        )
        .run(context.userId, productId, path, file.name);
    } catch (error) {
      await deleteProductImageFile(path);
      throw error;
    }

    return { path };
  });

const deleteImageInput = z.object({ id: z.string() });

export const deleteProductImage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => deleteImageInput.parse(input))
  .handler(async ({ data, context }) => {
    const row = context.db
      .prepare(`SELECT storage_path FROM product_images WHERE id = ? AND user_id = ?`)
      .get(data.id, context.userId) as { storage_path: string } | undefined;
    if (!row) return { ok: true };

    context.db
      .prepare(`DELETE FROM product_images WHERE id = ? AND user_id = ?`)
      .run(data.id, context.userId);
    await deleteProductImageFile(row.storage_path);
    return { ok: true };
  });
