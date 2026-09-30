/**
 * Sugestão de ficha técnica do Mercado Livre pela ECO (Lovable AI Gateway).
 * Só sugere valores para atributos obrigatórios/condicionais da categoria e
 * valida cada valor contra os metadados oficiais antes de devolver.
 */
import { getCategoryMetadata } from "@/lib/mercado-livre.server";
import { checkValue, isEditable, isRequired, type MlAttributeMeta, type MlValue } from "@/lib/ml-validation";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "openai/gpt-5.4-mini";
/** Nunca inventamos código de barras nem motivo de ausência. */
const NEVER_SUGGEST = ["GTIN", "EMPTY_GTIN_REASON", "SELLER_SKU"];

type ProductCtx = { title: string; description: string; brand: string | null };

function compact(a: MlAttributeMeta) {
  return {
    id: a.id,
    name: a.name,
    value_type: a.value_type ?? "string",
    ...(a.values?.length ? { values: a.values.slice(0, 60).map((v) => ({ id: v.id, name: v.name })) } : {}),
    ...(a.allowed_units?.length ? { units: a.allowed_units.map((u) => u.id) } : {}),
    ...(a.value_max_length ? { max_length: a.value_max_length } : {}),
  };
}

function sanitize(list: MlAttributeMeta[], raw: unknown): Record<string, MlValue> {
  const out: Record<string, MlValue> = {};
  const obj = (raw ?? {}) as Record<string, unknown>;
  for (const meta of list) {
    const got = obj[meta.id] as Record<string, unknown> | undefined;
    if (!got || typeof got !== "object") continue;
    const candidate: MlValue = {};
    if (typeof got["value_id"] === "string" && got["value_id"]) candidate.value_id = got["value_id"];
    else if (typeof got["value_name"] === "string" && got["value_name"].trim())
      candidate.value_name = got["value_name"].trim();
    if (typeof got["unit"] === "string" && got["unit"]) candidate.unit = got["unit"];
    if (!candidate.value_id && !candidate.value_name) continue;
    if (checkValue(meta, candidate) !== null) continue;
    out[meta.id] = candidate;
  }
  return out;
}

export async function suggestMlSpec(input: {
  userId: string;
  categoryId: string;
  condition: string | null;
  conditionalIds: string[];
  product: ProductCtx;
}): Promise<{ attributes: Record<string, MlValue>; saleTerms: Record<string, MlValue>; message: string | null }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { attributes: {}, saleTerms: {}, message: "A ECO não está disponível no momento." };

  const meta = await getCategoryMetadata(input.userId, input.categoryId);
  const wanted = meta.attributes.filter(
    (a) =>
      isEditable(a) &&
      !NEVER_SUGGEST.includes(a.id) &&
      (isRequired(a, input.condition) || input.conditionalIds.includes(a.id)),
  );
  const wantedTerms = meta.saleTerms.filter((t) => isEditable(t) && isRequired(t, input.condition));
  if (!wanted.length && !wantedTerms.length)
    return { attributes: {}, saleTerms: {}, message: "Nada a completar nesta categoria." };

  const payload = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "Você é a ECO, assistente de e-commerce do ECOM. Preencha a ficha técnica de um anúncio do Mercado Livre. " +
          "Responda SOMENTE com JSON no formato {\"attributes\":{\"ID\":{\"value_id\"?:string,\"value_name\"?:string,\"unit\"?:string}},\"sale_terms\":{...}}. " +
          "Quando o atributo tiver lista de valores, use obrigatoriamente um value_id da lista. " +
          "Para value_type number_unit, informe value_name numérico e unit entre as unidades permitidas. " +
          "Não invente dados que contrariem as informações do produto. Se não tiver base para um atributo, omita-o.",
      },
      {
        role: "user",
        content: JSON.stringify({
          produto: {
            titulo: input.product.title,
            descricao: input.product.description.slice(0, 1500),
            marca: input.product.brand,
          },
          categoria: { id: meta.categoryId, nome: meta.categoryName },
          atributos: wanted.map(compact),
          condicoes_de_venda: wantedTerms.map(compact),
        }),
      },
    ],
    response_format: { type: "json_object" },
  };

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) return { attributes: {}, saleTerms: {}, message: "Limite de uso da ECO atingido. Tente em instantes." };
  if (res.status === 402) return { attributes: {}, saleTerms: {}, message: "Créditos de IA esgotados." };
  if (!res.ok) return { attributes: {}, saleTerms: {}, message: "A ECO não conseguiu completar a ficha agora." };

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return { attributes: {}, saleTerms: {}, message: "Resposta da ECO não pôde ser lida." };
  }

  const attributes = sanitize(wanted, parsed["attributes"]);
  const saleTerms = sanitize(wantedTerms, parsed["sale_terms"] ?? parsed["saleTerms"]);
  const count = Object.keys(attributes).length + Object.keys(saleTerms).length;
  return {
    attributes,
    saleTerms,
    message: count ? null : "A ECO não encontrou valores seguros para preencher. Complete manualmente.",
  };
}
