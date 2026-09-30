import { createServerFn } from "@tanstack/react-start";

import { requireAuth } from "@/lib/sqlite/auth-middleware";
import { parseJsonColumn, type Json } from "@/lib/sqlite/json";

interface SaleRow {
  id: string;
  user_id: string;
  order_id: string | null;
  marketplace: "mercado_livre" | "shopee" | "amazon";
  external_order_id: string | null;
  buyer_name: string | null;
  product_title: string | null;
  quantity: number;
  gross_amount: number;
  net_amount: number | null;
  fees_amount: number;
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "refunded";
  sold_at: string;
  created_at: string;
  updated_at: string;
}

interface SaleOrderInfoRow {
  buyer_email: string | null;
  buyer_document: string | null;
  shipping_address: string | null;
  history: string;
}

interface SaleOrderItemRow {
  id: string;
  title: string;
  quantity: number;
  total_price: number;
}

export const listSales = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = context.db;
    const sales = db
      .prepare(`SELECT * FROM sales WHERE user_id = ? ORDER BY sold_at DESC`)
      .all(context.userId) as unknown as SaleRow[];

    const orderStmt = db.prepare(
      `SELECT buyer_email, buyer_document, shipping_address, history FROM orders WHERE id = ? AND user_id = ?`,
    );
    const itemsStmt = db.prepare(
      `SELECT id, title, quantity, total_price FROM order_items WHERE order_id = ? ORDER BY created_at`,
    );

    return sales.map((sale) => {
      if (!sale.order_id) return { ...sale, orders: null };
      const order = orderStmt.get(sale.order_id, context.userId) as unknown as
        SaleOrderInfoRow | undefined;
      if (!order) return { ...sale, orders: null };
      return {
        ...sale,
        orders: {
          buyer_email: order.buyer_email,
          buyer_document: order.buyer_document,
          shipping_address: parseJsonColumn<Json>(order.shipping_address, null),
          history: parseJsonColumn<Json[]>(order.history, []),
          order_items: itemsStmt.all(sale.order_id) as unknown as SaleOrderItemRow[],
        },
      };
    });
  });
