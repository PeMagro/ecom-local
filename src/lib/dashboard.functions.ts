import { createServerFn } from "@tanstack/react-start";

import { requireAuth } from "@/lib/sqlite/auth-middleware";

interface SaleSummaryRow {
  gross_amount: number;
  marketplace: "mercado_livre" | "shopee" | "amazon";
  sold_at: string;
  external_order_id: string | null;
  order_id: string | null;
}

interface ProductSummaryRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  brand: string | null;
  price: number | null;
  created_at: string;
}

interface ListingSummaryRow {
  status: "draft" | "ready" | "publishing" | "active" | "paused" | "error";
  marketplace: "mercado_livre" | "shopee" | "amazon";
}

interface BalanceSummaryRow {
  quantity: number;
  low_stock_threshold: number;
  product_id: string;
}

interface OrderSummaryRow {
  id: string;
  external_order_id: string;
  marketplace: "mercado_livre" | "shopee" | "amazon";
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "refunded";
  total_amount: number;
  placed_at: string | null;
  buyer_name: string | null;
}

interface AlertSummaryRow {
  id: string;
  title: string;
  description: string | null;
  severity: "info" | "warning" | "critical";
  created_at: string;
}

/** Collapses visao-geral.tsx's 6 parallel Supabase queries into one server fn. */
export const getOverview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = context.db;
    const uid = context.userId;

    const sales = db
      .prepare(
        `SELECT gross_amount, marketplace, sold_at, external_order_id, order_id FROM sales WHERE user_id = ?`,
      )
      .all(uid) as unknown as SaleSummaryRow[];
    const products = db
      .prepare(
        `SELECT id, name, sku, category, brand, price, created_at FROM products WHERE user_id = ? ORDER BY created_at DESC LIMIT 6`,
      )
      .all(uid) as unknown as ProductSummaryRow[];
    const productCount = (
      db.prepare(`SELECT COUNT(*) as c FROM products WHERE user_id = ?`).get(uid) as { c: number }
    ).c;
    const listings = db
      .prepare(`SELECT status, marketplace FROM marketplace_listings WHERE user_id = ?`)
      .all(uid) as unknown as ListingSummaryRow[];
    const balances = db
      .prepare(
        `SELECT quantity, low_stock_threshold, product_id FROM inventory_balances WHERE user_id = ?`,
      )
      .all(uid) as unknown as BalanceSummaryRow[];
    const orders = db
      .prepare(
        `SELECT id, external_order_id, marketplace, status, total_amount, placed_at, buyer_name
         FROM orders WHERE user_id = ? ORDER BY placed_at DESC LIMIT 6`,
      )
      .all(uid) as unknown as OrderSummaryRow[];
    const alerts = db
      .prepare(
        `SELECT id, title, description, severity, created_at
         FROM alerts WHERE user_id = ? AND resolved_at IS NULL ORDER BY created_at DESC LIMIT 6`,
      )
      .all(uid) as unknown as AlertSummaryRow[];

    return { sales, productCount, products, listings, balances, orders, alerts };
  });
