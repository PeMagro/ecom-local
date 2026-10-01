import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import * as queries from "./queries";

export interface EcomToolContext {
  db: DatabaseSync;
  userId: string;
}

interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[] | undefined;
  [key: string]: unknown;
}

interface RuntimeTool {
  name: string;
  description: string;
  input_schema: JsonSchema;
  run: (ctx: EcomToolContext, rawInput: unknown) => unknown;
}

/**
 * `TInput` só existe dentro desta função: cada chamada valida o input com seu
 * próprio schema Zod e chama seu próprio handler tipado. Erasing para
 * `RuntimeTool` evita o problema clássico de TS de "união de funções" quando
 * as 7 tools (cada uma com um input diferente) moram no mesmo array.
 */
function defineTool<TInput>(def: {
  name: string;
  description: string;
  input_schema: JsonSchema;
  inputSchema: z.ZodType<TInput>;
  handler: (ctx: EcomToolContext, input: TInput) => unknown;
}): RuntimeTool {
  return {
    name: def.name,
    description: def.description,
    input_schema: def.input_schema,
    run: (ctx, rawInput) => def.handler(ctx, def.inputSchema.parse(rawInput ?? {})),
  };
}

const getProdutoTool = defineTool({
  name: "getProduto",
  description:
    "Retorna o cadastro completo de um produto (variantes, imagens e saldos de estoque). Informe sku OU produtoId.",
  input_schema: {
    type: "object",
    properties: {
      sku: { type: "string", description: "SKU do produto." },
      produtoId: { type: "string", description: "ID interno do produto." },
    },
  },
  inputSchema: z.object({ sku: z.string().optional(), produtoId: z.string().optional() }),
  handler: (ctx, input) => queries.getProduto(ctx.db, ctx.userId, input),
});

const getCamposFaltantesTool = defineTool({
  name: "getCamposFaltantes",
  description:
    "Lista os campos de cadastro vazios/nulos de um produto, para sugerir o que falta completar.",
  input_schema: {
    type: "object",
    properties: { produtoId: { type: "string" } },
    required: ["produtoId"],
  },
  inputSchema: z.object({ produtoId: z.string() }),
  handler: (ctx, input) => queries.getCamposFaltantes(ctx.db, ctx.userId, input.produtoId),
});

const buscarProdutoCatalogoTool = defineTool({
  name: "buscarProdutoCatalogo",
  description:
    "Busca, entre os produtos já cadastrados pelo próprio vendedor, itens com nome/marca/modelo parecidos — para reaproveitar dado real (ex: outro SKU do mesmo modelo) em vez de inventar.",
  input_schema: {
    type: "object",
    properties: {
      nome: { type: "string" },
      marca: { type: "string" },
      modelo: { type: "string" },
    },
    required: ["nome"],
  },
  inputSchema: z.object({
    nome: z.string(),
    marca: z.string().optional(),
    modelo: z.string().optional(),
  }),
  handler: (ctx, input) => queries.buscarProdutoCatalogo(ctx.db, ctx.userId, input),
});

const getEstoqueAtualTool = defineTool({
  name: "getEstoqueAtual",
  description: "Retorna a quantidade atual em estoque de um produto, somando todas as variantes.",
  input_schema: {
    type: "object",
    properties: { produtoId: { type: "string" } },
    required: ["produtoId"],
  },
  inputSchema: z.object({ produtoId: z.string() }),
  handler: (ctx, input) => queries.getEstoqueAtual(ctx.db, ctx.userId, input.produtoId),
});

const getHistoricoVendasTool = defineTool({
  name: "getHistoricoVendas",
  description:
    "Retorna a série de vendas (unidades vendidas por dia) de um produto num período, para calcular média e velocidade de saída.",
  input_schema: {
    type: "object",
    properties: {
      produtoId: { type: "string" },
      periodoDias: { type: "number", description: "Janela em dias (padrão 30)." },
    },
    required: ["produtoId"],
  },
  inputSchema: z.object({ produtoId: z.string(), periodoDias: z.number().positive().optional() }),
  handler: (ctx, input) => queries.getHistoricoVendas(ctx.db, ctx.userId, input),
});

const listarEstoqueBaixoTool = defineTool({
  name: "listarEstoqueBaixo",
  description:
    "Lista produtos com estoque disponível igual ou abaixo do limiar (o limiar próprio do produto, ou um limiar informado). Gatilho de alerta estoque_baixo.",
  input_schema: {
    type: "object",
    properties: { limiarOpcional: { type: "number" } },
  },
  inputSchema: z.object({ limiarOpcional: z.number().optional() }),
  handler: (ctx, input) => queries.listarEstoqueBaixo(ctx.db, ctx.userId, input.limiarOpcional),
});

const listarSemMovimentacaoTool = defineTool({
  name: "listarSemMovimentacao",
  description:
    "Lista produtos com estoque positivo que não vendem há N dias ou mais. Gatilho de alerta estoque_parado.",
  input_schema: {
    type: "object",
    properties: { diasSemVenda: { type: "number" } },
    required: ["diasSemVenda"],
  },
  inputSchema: z.object({ diasSemVenda: z.number().int().positive() }),
  handler: (ctx, input) => queries.listarSemMovimentacao(ctx.db, ctx.userId, input.diasSemVenda),
});

export const ECOM_TOOLS = [
  getProdutoTool,
  getCamposFaltantesTool,
  buscarProdutoCatalogoTool,
  getEstoqueAtualTool,
  getHistoricoVendasTool,
  listarEstoqueBaixoTool,
  listarSemMovimentacaoTool,
] as const;

/** O que vai no campo `tools` da chamada à Messages API. */
export const ECOM_TOOL_DEFINITIONS = ECOM_TOOLS.map(({ name, description, input_schema }) => ({
  name,
  description,
  input_schema,
}));

/** Valida o input (vindo do modelo) contra o contrato Zod da tool antes de tocar no banco. */
export function executeEcomTool(ctx: EcomToolContext, name: string, rawInput: unknown): unknown {
  const tool = ECOM_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Ferramenta desconhecida: ${name}`);
  return tool.run(ctx, rawInput);
}
