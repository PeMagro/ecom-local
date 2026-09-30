import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/sqlite/auth-middleware";
import { loadOrderWithItems } from "@/lib/orders.functions";

interface DocOrderRow {
  id: string;
  external_order_id: string;
  marketplace: "mercado_livre" | "shopee" | "amazon";
  placed_at: string | null;
}

export const listOrdersForDocuments = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return context.db
      .prepare(
        `SELECT id, external_order_id, marketplace, placed_at FROM orders WHERE user_id = ? ORDER BY placed_at DESC`,
      )
      .all(context.userId) as unknown as DocOrderRow[];
  });

const orderIdInput = z.object({ id: z.string() });

export const getOrderForDocument = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => orderIdInput.parse(input))
  .handler(async ({ data, context }) => loadOrderWithItems(context.db, context.userId, data.id));
