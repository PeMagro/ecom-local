import type { DatabaseSync } from "node:sqlite";

export type MovementType = "entry" | "sale" | "adjustment" | "return" | "reservation" | "release";

export interface ApplyInventoryMovementInput {
  userId: string;
  productId: string;
  variantId: string | null;
  type: MovementType;
  quantity: number;
  reason?: string | null;
  marketplace?: "mercado_livre" | "shopee" | "amazon" | null;
  orderId?: string | null;
}

export interface InventoryBalanceRow {
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

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function signedDelta(type: MovementType, quantity: number): number {
  const abs = Math.abs(quantity);
  switch (type) {
    case "sale":
    case "reservation":
      return -abs;
    case "entry":
    case "return":
    case "release":
      return abs;
    default:
      return quantity; // 'adjustment' — caller passes the signed delta directly
  }
}

/**
 * TypeScript equivalent of the Postgres `apply_inventory_movement` RPC.
 *
 * The original relied on `auth.uid()` from the Supabase session; here the
 * caller (an authenticated server route) must pass `userId` explicitly —
 * always take it from the verified session, never from client input.
 *
 * Runs as a single SQLite transaction (BEGIN IMMEDIATE) so the upsert into
 * inventory_balances and the inventory_movements insert are atomic, exactly
 * like the original PL/pgSQL function.
 */
export function applyInventoryMovement(
  db: DatabaseSync,
  input: ApplyInventoryMovementInput,
): InventoryBalanceRow {
  const {
    userId,
    productId,
    variantId,
    type,
    quantity,
    reason = null,
    marketplace = null,
    orderId = null,
  } = input;
  const delta = signedDelta(type, quantity);
  const variantKey = variantId ?? ZERO_UUID;

  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db
      .prepare(
        `SELECT * FROM inventory_balances
         WHERE product_id = ? AND COALESCE(variant_id, ?) = ?`,
      )
      .get(productId, ZERO_UUID, variantKey) as InventoryBalanceRow | undefined;

    let balance: InventoryBalanceRow;

    if (existing) {
      db.prepare(
        `UPDATE inventory_balances
         SET quantity = quantity + ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`,
      ).run(delta, existing.id);

      balance = db
        .prepare(`SELECT * FROM inventory_balances WHERE id = ?`)
        .get(existing.id) as unknown as InventoryBalanceRow;
    } else {
      const initialQuantity = Math.max(delta, 0);
      db.prepare(
        `INSERT INTO inventory_balances (user_id, product_id, variant_id, quantity)
         VALUES (?, ?, ?, ?)`,
      ).run(userId, productId, variantId, initialQuantity);

      balance = db
        .prepare(
          `SELECT * FROM inventory_balances
           WHERE product_id = ? AND COALESCE(variant_id, ?) = ?`,
        )
        .get(productId, ZERO_UUID, variantKey) as unknown as InventoryBalanceRow;
    }

    db.prepare(
      `INSERT INTO inventory_movements
         (user_id, product_id, variant_id, type, quantity, balance_after, reason, marketplace, order_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      productId,
      variantId,
      type,
      delta,
      balance.quantity,
      reason,
      marketplace,
      orderId,
    );

    db.exec("COMMIT");
    return balance;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
