import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/sqlite/auth-middleware";
import { applyInventoryMovement, type MovementType } from "@/lib/sqlite/inventory";

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
  product_name: string;
  product_sku: string | null;
  variant_name: string | null;
  variant_sku: string | null;
}

export const listInventoryBalances = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rows = context.db
      .prepare(
        `SELECT ib.*, p.name as product_name, p.sku as product_sku, pv.name as variant_name, pv.sku as variant_sku
         FROM inventory_balances ib
         JOIN products p ON p.id = ib.product_id
         LEFT JOIN product_variants pv ON pv.id = ib.variant_id
         WHERE ib.user_id = ?
         ORDER BY ib.quantity ASC`,
      )
      .all(context.userId) as unknown as BalanceRow[];

    return rows.map((r) => ({
      ...r,
      products: { name: r.product_name, sku: r.product_sku },
      product_variants: r.variant_name ? { name: r.variant_name, sku: r.variant_sku } : null,
    }));
  });

interface MovementRow {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  type: MovementType;
  quantity: number;
  balance_after: number | null;
  reason: string | null;
  marketplace: "mercado_livre" | "shopee" | "amazon" | null;
  order_id: string | null;
  created_at: string;
  product_name: string;
}

export const listInventoryMovements = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rows = context.db
      .prepare(
        `SELECT im.*, p.name as product_name
         FROM inventory_movements im
         JOIN products p ON p.id = im.product_id
         WHERE im.user_id = ?
         ORDER BY im.created_at DESC
         LIMIT 50`,
      )
      .all(context.userId) as unknown as MovementRow[];

    return rows.map((r) => ({ ...r, products: { name: r.product_name } }));
  });

const adjustInput = z.object({
  productId: z.string(),
  variantId: z.string().nullable(),
  type: z.enum(["entry", "out", "adjustment", "return"]),
  quantity: z.number().int().positive(),
  reason: z.string().nullable().optional(),
});

/** Same UI-to-RPC translation as the old estoque.tsx: "out" becomes an "adjustment" with a negative, capped quantity. */
export const adjustInventory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => adjustInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.db;

    if (data.type === "out") {
      const row = db
        .prepare(
          `SELECT quantity, reserved FROM inventory_balances WHERE product_id = ? AND variant_id IS ?`,
        )
        .get(data.productId, data.variantId) as { quantity: number; reserved: number } | undefined;
      const available = Math.max(0, (row?.quantity ?? 0) - (row?.reserved ?? 0));
      if (data.quantity > available) {
        throw new Error(`Saldo disponível: ${available}. A saída não pode exceder esse valor.`);
      }
    }

    const type: MovementType = data.type === "out" ? "adjustment" : data.type;
    const quantity = data.type === "out" ? -data.quantity : data.quantity;
    const reason =
      data.type === "out"
        ? `Saída manual: ${data.reason?.trim() || "retirada de estoque"}`
        : data.reason?.trim() || null;

    return applyInventoryMovement(db, {
      userId: context.userId,
      productId: data.productId,
      variantId: data.variantId,
      type,
      quantity,
      reason,
    });
  });
