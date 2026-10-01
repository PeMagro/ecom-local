import Anthropic from "@anthropic-ai/sdk";
import type { DatabaseSync } from "node:sqlite";

import type { Json } from "@/lib/sqlite/json";

import { ECOM_AGENT_SYSTEM_PROMPT } from "./system-prompt";
import { parseStructuredOutput, type StructuredEcomOutput } from "./schemas";
import { ECOM_TOOL_DEFINITIONS, executeEcomTool, type EcomToolContext } from "./tools";

const MODEL = process.env["ECOM_AGENT_MODEL"] || "claude-sonnet-5";
const MAX_TOOL_ROUNDS = 6;

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");
  client = new Anthropic({ apiKey });
  return client;
}

export interface EcomAgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RunEcomAgentInput {
  db: DatabaseSync;
  userId: string;
  messages: EcomAgentMessage[];
}

export interface ToolCallLog {
  name: string;
  input: Json;
  output: Json;
}

export interface RunEcomAgentResult {
  text: string;
  structured: StructuredEcomOutput;
  toolCalls: ToolCallLog[];
}

/**
 * Loop de tool-use manual sobre a Messages API. Escolha deliberada em vez do
 * Claude Agent SDK: o agente roda dentro de uma server fn já autenticada
 * (requireAuth), então basta um request/response por turno — dá pra trocar
 * por um runtime de agente mais completo depois sem mudar o contrato das
 * tools (agent.functions.ts é o único ponto de entrada externo).
 */
export async function runEcomAgent(input: RunEcomAgentInput): Promise<RunEcomAgentResult> {
  const ctx: EcomToolContext = { db: input.db, userId: input.userId };
  const conversation: Anthropic.MessageParam[] = input.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const toolCalls: ToolCallLog[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1536,
      system: ECOM_AGENT_SYSTEM_PROMPT,
      tools: ECOM_TOOL_DEFINITIONS as Anthropic.Tool[],
      messages: conversation,
    });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUses.length === 0) {
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return { text, structured: parseStructuredOutput(text), toolCalls };
    }

    conversation.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = toolUses.map((block) => {
      let output: unknown;
      try {
        output = executeEcomTool(ctx, block.name, block.input);
      } catch (error) {
        output = { erro: error instanceof Error ? error.message : String(error) };
      }
      toolCalls.push({
        name: block.name,
        input: block.input as unknown as Json,
        output: output as Json,
      });
      return {
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(output),
      };
    });

    conversation.push({ role: "user", content: toolResults });
  }

  throw new Error("O agente excedeu o limite de chamadas de ferramenta sem concluir a resposta.");
}
