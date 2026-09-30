/**
 * Regras puras (sem rede/banco) usadas pelo editor e pelo servidor na
 * validação e montagem do anúncio do Mercado Livre.
 */

// ---------- Números ----------

/** Aceita "19,90", "19.90", "1.234,56" e "1234". Retorna null quando inválido. */
export function parsePrice(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null;
  const s = raw.trim();
  let normalized: string | null = null;
  if (/^\d+(?:[.,]\d{1,2})?$/.test(s)) normalized = s.replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s))
    normalized = s.replace(/\./g, "").replace(",", ".");
  if (normalized === null) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Estoque: inteiro >= 0. Retorna null quando inválido (fração, letras, negativo). */
export function parseStock(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

// ---------- GTIN ----------

export type GtinCheck = { ok: true } | { ok: false; reason: string };

/** GTIN-8/12/13/14: valida somente se contém números e uma quantidade aceita de dígitos. */
export function validateGtin(value: string): GtinCheck {
  const v = value.trim();
  if (!/^\d+$/.test(v)) return { ok: false, reason: "O código de barras deve ter apenas números." };
  if (![8, 12, 13, 14].includes(v.length)) {
    return {
      ok: false,
      reason: "O código de barras deve ter 8, 12, 13 ou 14 números.",
    };
  }
  return { ok: true };
}

// ---------- Metadados oficiais ----------

export type MlAttributeMeta = {
  id: string;
  name: string;
  value_type?: string;
  value_max_length?: number;
  values?: Array<{ id: string; name: string }>;
  allowed_units?: Array<{ id: string; name: string }>;
  default_unit?: string;
  tags?: Record<string, boolean | undefined>;
  hint?: string;
  tooltip?: string;
};

export type MlValue = { value_id?: string; value_name?: string; unit?: string };

export type MlSpec = {
  v: 1;
  categoryId: string | null;
  categoryName: string | null;
  condition: string | null;
  listingTypeId: string | null;
  shippingMode: string | null;
  attributes: Record<string, MlValue>;
  saleTerms: Record<string, MlValue>;
  pkg: { weight: string; height: string; width: string; length: string };
};

export function emptySpec(): MlSpec {
  return {
    v: 1,
    categoryId: null,
    categoryName: null,
    condition: null,
    listingTypeId: null,
    shippingMode: null,
    attributes: {},
    saleTerms: {},
    pkg: { weight: "", height: "", width: "", length: "" },
  };
}

export type MlMetadata = {
  categoryId: string;
  categoryName: string;
  listingAllowed: boolean;
  maxTitleLength: number;
  maxPictures: number;
  itemConditions: string[];
  userProducts: boolean;
  listingTypes: Array<{ id: string; name: string }>;
  shippingModes: string[];
  attributes: MlAttributeMeta[];
  saleTerms: MlAttributeMeta[];
};

export type Issue = { field: string; message: string };

const SKIP_TAGS = ["hidden", "read_only", "fixed", "inferred"];
export const PACKAGE_MODES = ["me1", "me2"];

export function isEditable(a: MlAttributeMeta) {
  return !SKIP_TAGS.some((t) => a.tags?.[t]);
}

/** Obrigatório para criação: required sempre; new_required quando condição = new. */
export function isRequired(a: MlAttributeMeta, condition: string | null) {
  if (!isEditable(a)) return false;
  if (a.tags?.["required"]) return true;
  if (a.tags?.["new_required"] && condition === "new") return true;
  return false;
}

function hasValue(v: MlValue | undefined) {
  return !!v && (!!v.value_id || !!v.value_name?.trim());
}

/** Valida um valor contra o tipo/valores/unidades do metadado. */
export function checkValue(meta: MlAttributeMeta, v: MlValue): string | null {
  if (v.value_id) {
    if (!meta.values?.some((x) => x.id === v.value_id)) return "Valor não pertence à lista oficial.";
    return null;
  }
  const name = (v.value_name ?? "").trim();
  if (!name) return null;
  if (meta.value_max_length && name.length > meta.value_max_length)
    return `Máximo de ${meta.value_max_length} caracteres.`;
  switch (meta.value_type) {
    case "number":
      if (!/^\d+(?:[.,]\d+)?$/.test(name)) return "Informe um número.";
      break;
    case "number_unit":
      if (!/^\d+(?:[.,]\d+)?$/.test(name)) return "Informe um número.";
      if (!v.unit) return "Escolha a unidade.";
      if (meta.allowed_units?.length && !meta.allowed_units.some((u) => u.id === v.unit))
        return "Unidade não permitida.";
      break;
    case "boolean":
    case "list":
      if (meta.values?.length) return "Escolha uma opção da lista.";
      break;
  }
  if (meta.id === "GTIN") {
    const g = validateGtin(name);
    if (!g.ok) return g.reason;
  }
  return null;
}

/** Converte o valor do editor no formato de atributo do payload. */
export function toPayloadValue(meta: MlAttributeMeta, v: MlValue) {
  if (v.value_id) return { id: meta.id, value_id: v.value_id };
  const name = (v.value_name ?? "").trim().replace(",", meta.value_type?.startsWith("number") ? "." : ",");
  if (meta.value_type === "number_unit") return { id: meta.id, value_name: `${name} ${v.unit}` };
  return { id: meta.id, value_name: name };
}

export type BasicInput = { title: string; price: string; stock: string; description: string; pictureCount: number };

/** Validação local completa. `conditionalIds` vem da consulta oficial de condicionais. */
export function validateSpec(
  meta: MlMetadata,
  spec: MlSpec,
  basic: BasicInput,
  conditionalIds: string[] = [],
): Issue[] {
  const issues: Issue[] = [];
  if (!meta.listingAllowed)
    issues.push({ field: "category", message: "Esta categoria não aceita anúncios. Escolha uma categoria mais específica." });
  const title = basic.title.trim();
  if (!title) issues.push({ field: "title", message: meta.userProducts ? "Informe o nome da família do produto." : "Informe o título." });
  else if (title.length > meta.maxTitleLength)
    issues.push({ field: "title", message: `Máximo de ${meta.maxTitleLength} caracteres.` });
  if (parsePrice(basic.price) === null) issues.push({ field: "price", message: "Preço inválido. Use por exemplo 19,90." });
  const stock = parseStock(basic.stock);
  if (stock === null || stock <= 0)
    issues.push({ field: "stock", message: "Para publicar, o estoque deve ser um número inteiro maior que zero." });
  if (basic.pictureCount < 1) issues.push({ field: "pictures", message: "Adicione ao menos uma foto ao produto." });
  if (!spec.condition || !meta.itemConditions.includes(spec.condition))
    issues.push({ field: "condition", message: "Escolha a condição do produto." });
  if (!spec.listingTypeId || !meta.listingTypes.some((t) => t.id === spec.listingTypeId))
    issues.push({ field: "listingType", message: "Escolha um tipo de anúncio disponível para sua conta." });
  if (meta.shippingModes.length && (!spec.shippingMode || !meta.shippingModes.includes(spec.shippingMode)))
    issues.push({ field: "shipping", message: "Escolha a forma de envio." });

  const gtinMeta = meta.attributes.find((a) => a.id === "GTIN");
  const reasonMeta = meta.attributes.find((a) => a.id === "EMPTY_GTIN_REASON");
  const hasGtin = hasValue(spec.attributes["GTIN"]);
  const hasReason = hasValue(spec.attributes["EMPTY_GTIN_REASON"]);

  for (const a of meta.attributes) {
    if (!isEditable(a)) continue;
    const v = spec.attributes[a.id];
    const needed = isRequired(a, spec.condition) || conditionalIds.includes(a.id);
    if (hasValue(v)) {
      const err = checkValue(a, v!);
      if (err) issues.push({ field: `attr:${a.id}`, message: `${a.name}: ${err}` });
      continue;
    }
    if (!needed) continue;
    if (a.id === "GTIN" && reasonMeta && hasReason) continue;
    if (a.id === "EMPTY_GTIN_REASON" && hasGtin) continue;
    issues.push({ field: `attr:${a.id}`, message: `${a.name} é obrigatório nesta categoria.` });
  }
  if (gtinMeta && hasGtin && hasReason)
    issues.push({ field: "attr:EMPTY_GTIN_REASON", message: "Remova o motivo de ausência: o código de barras foi informado." });

  for (const t of meta.saleTerms) {
    const v = spec.saleTerms[t.id];
    if (hasValue(v)) {
      const err = checkValue(t, v!);
      if (err) issues.push({ field: `term:${t.id}`, message: `${t.name}: ${err}` });
    } else if (isRequired(t, spec.condition)) {
      issues.push({ field: `term:${t.id}`, message: `${t.name} é obrigatório nesta categoria.` });
    }
  }

  if (spec.shippingMode && PACKAGE_MODES.includes(spec.shippingMode)) {
    for (const k of ["weight", "height", "width", "length"] as const) {
      const n = parseStock(spec.pkg[k]);
      if (n === null || n <= 0)
        issues.push({ field: `pkg:${k}`, message: `Informe ${PKG_LABEL[k]} do pacote (número inteiro).` });
    }
  }
  return issues;
}

export const PKG_LABEL = { weight: "o peso (g)", height: "a altura (cm)", width: "a largura (cm)", length: "o comprimento (cm)" };

/** Monta a lista de atributos enviada, somente com IDs existentes nos metadados. */
export function buildAttributes(meta: MlMetadata, spec: MlSpec) {
  const out: Array<{ id: string; value_id?: string; value_name?: string }> = [];
  for (const a of meta.attributes) {
    if (!isEditable(a)) continue;
    const v = spec.attributes[a.id];
    if (hasValue(v)) out.push(toPayloadValue(a, v!));
  }
  if (spec.shippingMode && PACKAGE_MODES.includes(spec.shippingMode)) {
    out.push(
      { id: "SELLER_PACKAGE_WEIGHT", value_name: `${parseStock(spec.pkg.weight)} g` },
      { id: "SELLER_PACKAGE_HEIGHT", value_name: `${parseStock(spec.pkg.height)} cm` },
      { id: "SELLER_PACKAGE_WIDTH", value_name: `${parseStock(spec.pkg.width)} cm` },
      { id: "SELLER_PACKAGE_LENGTH", value_name: `${parseStock(spec.pkg.length)} cm` },
    );
  }
  return out;
}

export function buildSaleTerms(meta: MlMetadata, spec: MlSpec) {
  return meta.saleTerms
    .filter((t) => hasValue(spec.saleTerms[t.id]))
    .map((t) => toPayloadValue(t, spec.saleTerms[t.id]!));
}

/** Corpo de POST /items: tradicional usa title; User Products usa family_name sem title. */
export function buildItemPayload(p: {
  userProducts: boolean;
  title: string;
  familyName: string;
  categoryId: string;
  price: number;
  stock: number;
  listingTypeId: string;
  condition: string;
  pictures: Array<{ source: string }>;
  attributes: Array<{ id: string; value_id?: string; value_name?: string }>;
  saleTerms?: Array<{ id: string; value_id?: string; value_name?: string }>;
  shippingMode?: string | null;
}) {
  const common: Record<string, unknown> = {
    category_id: p.categoryId,
    price: p.price,
    currency_id: "BRL",
    available_quantity: p.stock,
    buying_mode: "buy_it_now",
    listing_type_id: p.listingTypeId,
    condition: p.condition,
    pictures: p.pictures,
    attributes: p.attributes,
  };
  if (p.saleTerms?.length) common["sale_terms"] = p.saleTerms;
  if (p.shippingMode) common["shipping"] = { mode: p.shippingMode };
  return p.userProducts ? { family_name: p.familyName, ...common } : { title: p.title, ...common };
}

/** Status real do item → status do ECOM. Nunca assume "active" por padrão. */
export function mapItemStatus(status: string | undefined): "active" | "paused" | "publishing" | "error" {
  if (status === "active") return "active";
  if (status === "paused") return "paused";
  if (status === "closed" || status === "inactive" || status === "under_review") return "error";
  return "publishing";
}

/** Extrai IDs de atributos exigidos da resposta de /attributes/conditional (formatos variam). */
export function parseConditionalIds(json: unknown): string[] {
  const pick = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr
          .map((x) => (typeof x === "string" ? x : (x as { id?: string })?.id))
          .filter((x): x is string => typeof x === "string")
      : [];
  if (Array.isArray(json)) return pick(json);
  const o = (json ?? {}) as Record<string, unknown>;
  return [...pick(o["required_attributes"]), ...pick(o["attributes"])];
}
