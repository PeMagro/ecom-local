import { z } from "zod";

/** Contrato `alerta_v1` do doc de validação — usado para estoque_baixo e estoque_parado. */
export const AlertaV1Schema = z.object({
  tipo: z.enum(["estoque_baixo", "estoque_parado"]),
  severidade: z.enum(["alta", "media", "baixa"]),
  produto: z.object({
    id: z.string(),
    nome: z.string(),
    sku: z.string().nullable(),
  }),
  dados_suporte: z.object({
    estoque_atual: z.number(),
    media_venda_dia: z.number(),
  }),
  acao_recomendada: z.string(),
  origem: z.enum(["dado_real", "estimativa"]),
});
export type AlertaV1 = z.infer<typeof AlertaV1Schema>;

/** Contrato `sugestao_campo_v1` do doc de validação — usado para completude de cadastro/anúncio. */
export const SugestaoCampoV1Schema = z.object({
  produto_id: z.string(),
  campo: z.string(),
  valor_sugerido: z.string(),
  origem: z.enum(["dado_cadastro", "conhecimento_geral"]),
  confianca: z.enum(["alta", "media", "baixa"]),
});
export type SugestaoCampoV1 = z.infer<typeof SugestaoCampoV1Schema>;

export type StructuredEcomOutput =
  | { kind: "alerta_v1"; data: AlertaV1 }
  | { kind: "sugestao_campo_v1"; data: SugestaoCampoV1 }
  | { kind: "texto_livre" };

/**
 * O prompt instrui o modelo a nunca misturar texto livre com os schemas
 * estruturados na mesma resposta — então basta tentar JSON.parse e validar
 * contra os dois contratos; qualquer coisa que não bater vira texto livre.
 */
export function parseStructuredOutput(text: string): StructuredEcomOutput {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return { kind: "texto_livre" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { kind: "texto_livre" };
  }

  const alerta = AlertaV1Schema.safeParse(parsed);
  if (alerta.success) return { kind: "alerta_v1", data: alerta.data };

  const sugestao = SugestaoCampoV1Schema.safeParse(parsed);
  if (sugestao.success) return { kind: "sugestao_campo_v1", data: sugestao.data };

  return { kind: "texto_livre" };
}
