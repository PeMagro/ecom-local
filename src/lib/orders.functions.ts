import { createServerFn } from "@tanstack/react-start";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import { requireAuth } from "@/lib/sqlite/auth-middleware";
import { parseJsonColumn, type Json } from "@/lib/sqlite/json";

export interface OrderRow {
  id: string;
  user_id: string;
  marketplace: "mercado_livre" | "shopee" | "amazon";
  external_order_id: string;
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "refunded";
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_document: string | null;
  shipping_address: string | null;
  total_amount: number;
  shipping_amount: number;
  fees_amount: number;
  currency: string;
  placed_at: string | null;
  history: string;
  raw_payload: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  user_id: string;
  product_id: string | null;
  variant_id: string | null;
  listing_id: string | null;
  title: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

/** Shared by orders.functions.ts and documents.functions.ts. Not a server fn. */
export function loadOrderWithItems(db: DatabaseSync, userId: string, orderId: string) {
  const order = db
    .prepare(`SELECT * FROM orders WHERE id = ? AND user_id = ?`)
    .get(orderId, userId) as unknown as OrderRow | undefined;
  if (!order) return null;

  const items = db
    .prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at`)
    .all(orderId) as unknown as OrderItemRow[];

  return {
    ...order,
    history: parseJsonColumn<Json[]>(order.history, []),
    shipping_address: parseJsonColumn<Json>(order.shipping_address, null),
    raw_payload: parseJsonColumn<Json>(order.raw_payload, null),
    order_items: items,
  };
}

export const listOrders = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return context.db
      .prepare(`SELECT * FROM orders WHERE user_id = ? ORDER BY placed_at DESC`)
      .all(context.userId) as unknown as OrderRow[];
  });

const orderIdInput = z.object({ id: z.string() });

export const getOrder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => orderIdInput.parse(input))
  .handler(async ({ data, context }) => loadOrderWithItems(context.db, context.userId, data.id));
