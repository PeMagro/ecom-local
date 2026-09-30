import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/sqlite/auth-middleware";

interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts: string | null;
  created_at: string;
}

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return context.db
      .prepare(`SELECT * FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC`)
      .all(context.userId) as unknown as ConversationRow[];
  });

const conversationIdInput = z.object({ conversationId: z.string() });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => conversationIdInput.parse(input))
  .handler(async ({ data, context }) => {
    return context.db
      .prepare(
        `SELECT * FROM ai_messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at`,
      )
      .all(data.conversationId, context.userId) as unknown as MessageRow[];
  });

export const hasAnyConversation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const row = context.db
      .prepare(`SELECT id FROM ai_conversations WHERE user_id = ? LIMIT 1`)
      .get(context.userId);
    return { has: Boolean(row) };
  });

const createConversationInput = z.object({ title: z.string() });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => createConversationInput.parse(input))
  .handler(async ({ data, context }) => {
    const created = context.db
      .prepare(`INSERT INTO ai_conversations (user_id, title) VALUES (?, ?) RETURNING id`)
      .get(context.userId, data.title) as { id: string };
    return { id: created.id };
  });

const addMessageInput = z.object({
  conversationId: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export const addMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => addMessageInput.parse(input))
  .handler(async ({ data, context }) => {
    context.db
      .prepare(
        `INSERT INTO ai_messages (user_id, conversation_id, role, content) VALUES (?, ?, ?, ?)`,
      )
      .run(context.userId, data.conversationId, data.role, data.content);
    return { ok: true };
  });

export const touchConversation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => conversationIdInput.extend({}).parse(input))
  .handler(async ({ data, context }) => {
    context.db
      .prepare(
        `UPDATE ai_conversations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`,
      )
      .run(data.conversationId, context.userId);
    return { ok: true };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => conversationIdInput.parse(input))
  .handler(async ({ data, context }) => {
    context.db
      .prepare(`DELETE FROM ai_messages WHERE conversation_id = ? AND user_id = ?`)
      .run(data.conversationId, context.userId);
    context.db
      .prepare(`DELETE FROM ai_conversations WHERE id = ? AND user_id = ?`)
      .run(data.conversationId, context.userId);
    return { ok: true };
  });

interface AiProductRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  brand: string | null;
  price: number | null;
  description: string | null;
}

interface AiListingRow {
  marketplace: "mercado_livre" | "shopee" | "amazon";
  title: string | null;
  status: "draft" | "ready" | "publishing" | "active" | "paused" | "error";
  price: number | null;
  stock: number | null;
  validation_errors: string;
}

interface AiBalanceRow {
  product_id: string;
  quantity: number;
  reserved: number;
  low_stock_threshold: number;
}

interface AiOrderRow {
  external_order_id: string;
  marketplace: "mercado_livre" | "shopee" | "amazon";
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "refunded";
  total_amount: number;
  placed_at: string | null;
}

interface AiSaleRow {
  marketplace: "mercado_livre" | "shopee" | "amazon";
  product_title: string | null;
  gross_amount: number;
  net_amount: number | null;
  quantity: number;
  status: string;
  sold_at: string;
}

interface AiConnectionRow {
  marketplace: "mercado_livre" | "shopee" | "amazon";
  status: "disconnected" | "connecting" | "connected" | "error";
  last_sync_at: string | null;
}

/** Supabase-sourced half of ia.tsx's buildContext(); the caller still merges in client-only `usePresentation()` data. */
export const getAiContextData = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = context.db;
    const uid = context.userId;
    return {
      products: db
        .prepare(
          `SELECT id, name, sku, category, brand, price, description FROM products WHERE user_id = ? LIMIT 25`,
        )
        .all(uid) as unknown as AiProductRow[],
      listings: db
        .prepare(
          `SELECT marketplace, title, status, price, stock, validation_errors FROM marketplace_listings WHERE user_id = ? LIMIT 25`,
        )
        .all(uid) as unknown as AiListingRow[],
      balances: db
        .prepare(
          `SELECT product_id, quantity, reserved, low_stock_threshold FROM inventory_balances WHERE user_id = ? LIMIT 25`,
        )
        .all(uid) as unknown as AiBalanceRow[],
      orders: db
        .prepare(
          `SELECT external_order_id, marketplace, status, total_amount, placed_at FROM orders WHERE user_id = ? ORDER BY placed_at DESC LIMIT 12`,
        )
        .all(uid) as unknown as AiOrderRow[],
      sales: db
        .prepare(
          `SELECT marketplace, product_title, gross_amount, net_amount, quantity, status, sold_at FROM sales WHERE user_id = ? ORDER BY sold_at DESC LIMIT 12`,
        )
        .all(uid) as unknown as AiSaleRow[],
      connections: db
        .prepare(
          `SELECT marketplace, status, last_sync_at FROM marketplace_connections WHERE user_id = ?`,
        )
        .all(uid) as unknown as AiConnectionRow[],
    };
  });
