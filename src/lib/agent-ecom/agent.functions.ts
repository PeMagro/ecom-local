import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/sqlite/auth-middleware";
import { runEcomAgent } from "@/lib/agent-ecom/agent";

const sendMessageInput = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
});

/**
 * Entry point do agente ECOM v1 (completude de cadastro, títulos/descrições de
 * anúncio, alertas de estoque baixo/parado). O histórico de conversa é
 * responsabilidade do chamador — persista com ai_conversations/ai_messages
 * (ai.functions.ts) se quiser manter o histórico entre chamadas.
 */
export const sendEcomAgentMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => sendMessageInput.parse(input))
  .handler(async ({ data, context }) => {
    return runEcomAgent({ db: context.db, userId: context.userId, messages: data.messages });
  });
