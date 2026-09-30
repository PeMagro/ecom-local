/**
 * Modo demonstração do Mercado Livre: dados fictícios guardados apenas no
 * navegador (localStorage), separados por usuário. Nenhuma chamada de rede,
 * nenhum token e nenhuma escrita no banco.
 */
import {
  parsePrice,
  parseStock,
  validateGtin,
  type Issue,
} from "@/lib/ml-validation";

import {
  CHANNEL_LABEL,
  CHANNEL_STORE_NAME,
  seedOrders,
  type PresentationChannel,
  type PresentationOrder,
} from "@/lib/presentation-channels";

const PREFIX = "ecom:mldemo:v1";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type DemoStatus = "active" | "paused" | "draft";
export type DemoListing = {
  id: string;
  title: string;
  price: number;
  stock: number;
  status: DemoStatus;
  categoryId: string;
  categoryName: string;
  origin: "imported" | "created";
  productName: string | null;
  updatedAt: string;
};
export type DemoState = {
  v: 1;
  connectedAt: string;
  nickname: string;
  listings: DemoListing[];
  orders?: PresentationOrder[];
};

export type DemoAttr = { id: string; name: string; values?: string[] };
export type DemoCategory = {
  id: string;
  name: string;
  keywords: string[];
  required: DemoAttr[];
};

export const DEMO_CATEGORIES: DemoCategory[] = [
  {
    id: "DEMO-CEL",
    name: "Celulares e Smartphones",
    keywords: ["celular", "smartphone", "telefone", "iphone", "galaxy"],
    required: [
      { id: "BRAND", name: "Marca" },
      { id: "MODEL", name: "Modelo" },
      {
        id: "STORAGE",
        name: "Memória interna",
        values: ["64 GB", "128 GB", "256 GB"],
      },
    ],
  },
  {
    id: "DEMO-FONE",
    name: "Fones de ouvido",
    keywords: ["fone", "headset", "earbud", "headphone"],
    required: [
      { id: "BRAND", name: "Marca" },
      { id: "MODEL", name: "Modelo" },
      { id: "CONNECTION", name: "Conexão", values: ["Bluetooth", "Com fio"] },
    ],
  },
  {
    id: "DEMO-COOLER",
    name: "Coolers e Ventoinhas",
    keywords: ["cooler", "ventoinha", "fan", "refrigeração"],
    required: [
      { id: "BRAND", name: "Marca" },
      { id: "MODEL", name: "Modelo" },
      {
        id: "PRODUCT_TYPE",
        name: "Tipo de produto",
        values: ["Ventoinha", "Cooler Líquido AIO"],
      },
    ],
  },
  {
    id: "DEMO-TENIS",
    name: "Tênis",
    keywords: ["tênis", "tenis", "sapato", "calçado"],
    required: [
      { id: "BRAND", name: "Marca" },
      { id: "SIZE", name: "Tamanho", values: ["38", "39", "40", "41", "42"] },
      { id: "COLOR", name: "Cor" },
    ],
  },
  {
    id: "DEMO-CASA",
    name: "Utensílios de cozinha",
    keywords: ["panela", "cozinha", "garrafa", "copo", "utensílio"],
    required: [
      { id: "BRAND", name: "Marca" },
      {
        id: "MATERIAL",
        name: "Material",
        values: ["Aço inox", "Alumínio", "Vidro"],
      },
    ],
  },
];

const FIXTURES: Record<
  PresentationChannel,
  Omit<DemoListing, "id" | "updatedAt" | "origin" | "productName">[]
> = {
  mercado_livre: [
    {
      title: "Fone Bluetooth Sem Fio Com Estojo",
      price: 89.9,
      stock: 34,
      status: "active",
      categoryId: "DEMO-FONE",
      categoryName: "Fones de ouvido",
    },
    {
      title: "Smartphone 128 GB Tela 6.5",
      price: 1299,
      stock: 8,
      status: "active",
      categoryId: "DEMO-CEL",
      categoryName: "Celulares e Smartphones",
    },
    {
      title: "Air Cooler Ventoinha 120mm RGB",
      price: 64.5,
      stock: 0,
      status: "paused",
      categoryId: "DEMO-COOLER",
      categoryName: "Coolers e Ventoinhas",
    },
    {
      title: "Tênis Corrida Masculino Leve",
      price: 179.9,
      stock: 21,
      status: "active",
      categoryId: "DEMO-TENIS",
      categoryName: "Tênis",
    },
  ],
  shopee: [
    {
      title: "Kit 3 Potes Organizadores de Cozinha",
      price: 42.9,
      stock: 18,
      status: "active",
      categoryId: "DEMO-CASA",
      categoryName: "Organização da casa",
    },
    {
      title: "Luminária LED de Mesa Articulada",
      price: 69.9,
      stock: 12,
      status: "active",
      categoryId: "DEMO-CASA",
      categoryName: "Iluminação",
    },
    {
      title: "Capa Protetora para Celular Antichoque",
      price: 29.9,
      stock: 0,
      status: "paused",
      categoryId: "DEMO-CEL",
      categoryName: "Acessórios para celular",
    },
    {
      title: "Mochila Casual para Notebook",
      price: 119.9,
      stock: 7,
      status: "active",
      categoryId: "DEMO-CASA",
      categoryName: "Bolsas e mochilas",
    },
  ],
  amazon: [
    {
      title: "Teclado Mecânico Compacto ABNT2",
      price: 219.9,
      stock: 14,
      status: "active",
      categoryId: "DEMO-CASA",
      categoryName: "Informática",
    },
    {
      title: "Suporte Ajustável para Notebook",
      price: 99.9,
      stock: 9,
      status: "active",
      categoryId: "DEMO-CASA",
      categoryName: "Acessórios de informática",
    },
    {
      title: "Hub USB-C com 5 Portas",
      price: 119.9,
      stock: 0,
      status: "paused",
      categoryId: "DEMO-CASA",
      categoryName: "Informática",
    },
    {
      title: "Headset Gamer com Microfone",
      price: 159.9,
      stock: 6,
      status: "active",
      categoryId: "DEMO-FONE",
      categoryName: "Fones de ouvido",
    },
  ],
  aliexpress: [
    {
      title: "Mini Projetor Portátil HD",
      price: 289.9,
      stock: 5,
      status: "active",
      categoryId: "DEMO-CASA",
      categoryName: "Eletrônicos",
    },
    {
      title: "Fita LED RGB 5 Metros",
      price: 39.9,
      stock: 26,
      status: "active",
      categoryId: "DEMO-CASA",
      categoryName: "Iluminação",
    },
    {
      title: "Relógio Digital de Mesa",
      price: 54.9,
      stock: 0,
      status: "paused",
      categoryId: "DEMO-CASA",
      categoryName: "Casa e decoração",
    },
    {
      title: "Fone Sem Fio Esportivo",
      price: 74.9,
      stock: 11,
      status: "active",
      categoryId: "DEMO-FONE",
      categoryName: "Áudio",
    },
  ],
  tiktok_shop: [
    {
      title: "Smartwatch Esportivo com Pulseira",
      price: 149.9,
      stock: 20,
      status: "active",
      categoryId: "DEMO-CEL",
      categoryName: "Eletrônicos vestíveis",
    },
    {
      title: "Garrafa Motivacional 1 Litro",
      price: 34.9,
      stock: 31,
      status: "active",
      categoryId: "DEMO-CASA",
      categoryName: "Acessórios esportivos",
    },
    {
      title: "Kit Skincare Facial Diário",
      price: 79.9,
      stock: 0,
      status: "paused",
      categoryId: "DEMO-CASA",
      categoryName: "Beleza",
    },
    {
      title: "Ring Light de Mesa com Suporte",
      price: 59.9,
      stock: 16,
      status: "active",
      categoryId: "DEMO-CASA",
      categoryName: "Acessórios para vídeo",
    },
  ],
};

function defaultStore(): Store | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
export const demoKey = (
  userId: string,
  channel: PresentationChannel = "mercado_livre",
) => `${PREFIX}:${userId}${channel === "mercado_livre" ? "" : `:${channel}`}`;
export const demoDraftKey = (
  userId: string,
  channel: PresentationChannel = "mercado_livre",
) => `${demoKey(userId, channel)}:draft`;

export function loadDemo(
  userId: string,
  s: Store | null = defaultStore(),
  channel: PresentationChannel = "mercado_livre",
): DemoState | null {
  if (!s) return null;
  try {
    const raw = s.getItem(demoKey(userId, channel));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoState;
    return parsed?.v === 1 && Array.isArray(parsed.listings)
      ? {
          ...parsed,
          orders: parsed.orders ?? seedOrders(channel, parsed.connectedAt),
        }
      : null;
  } catch {
    return null;
  }
}

function save(
  userId: string,
  state: DemoState,
  s: Store | null,
  channel: PresentationChannel,
): boolean {
  if (!s) return false;
  try {
    s.setItem(demoKey(userId, channel), JSON.stringify(state));
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("ecom:channels-changed"));
    return true;
  } catch {
    return false;
  }
}

/** Conecta (simulado). Idempotente: se já existe, não duplica a coleção. */
export function connectDemo(
  userId: string,
  s: Store | null = defaultStore(),
  channel: PresentationChannel = "mercado_livre",
): DemoState | null {
  const existing = loadDemo(userId, s, channel);
  if (existing) return existing;
  const now = new Date().toISOString();
  const state: DemoState = {
    v: 1,
    connectedAt: now,
    nickname: CHANNEL_STORE_NAME[channel],
    orders: seedOrders(channel, now),
    listings: FIXTURES[channel].map((f, i) => ({
      ...f,
      id: `ECOM-${channel}-${String(900001 + i)}`,
      origin: "imported",
      productName: f.title,
      updatedAt: now,
    })),
  };
  return save(userId, state, s, channel) ? state : null;
}

export function disconnectDemo(
  userId: string,
  s: Store | null = defaultStore(),
  channel: PresentationChannel = "mercado_livre",
) {
  try {
    s?.removeItem(demoKey(userId, channel));
    s?.removeItem(demoDraftKey(userId, channel));
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("ecom:channels-changed"));
  } catch {
    /* armazenamento indisponível */
  }
}

export function searchDemoCategories(query: string): DemoCategory[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return DEMO_CATEGORIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.keywords.some((k) => q.includes(k) || k.includes(q)),
  );
}

export type DemoDraft = {
  productId: string | null;
  title: string;
  description: string;
  price: string;
  stock: string;
  gtin: string;
  pictureCount: number;
  categoryId: string | null;
  attributes: Record<string, string>;
};

export function loadDemoDraft(
  userId: string,
  s: Store | null = defaultStore(),
  channel: PresentationChannel = "mercado_livre",
): DemoDraft | null {
  if (!s) return null;
  try {
    const raw = s.getItem(demoDraftKey(userId, channel));
    return raw ? (JSON.parse(raw) as DemoDraft) : null;
  } catch {
    return null;
  }
}
export function saveDemoDraft(
  userId: string,
  d: DemoDraft,
  s: Store | null = defaultStore(),
  channel: PresentationChannel = "mercado_livre",
): boolean {
  if (!s) return false;
  try {
    s.setItem(demoDraftKey(userId, channel), JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

/** Validação local da demonstração (campos básicos + atributos da categoria simulada). */
export function validateDemo(d: DemoDraft): Issue[] {
  const issues: Issue[] = [];
  const title = d.title.trim();
  if (!title) issues.push({ field: "title", message: "Informe o título." });
  else if (title.length > 60)
    issues.push({
      field: "title",
      message: "Título com no máximo 60 caracteres.",
    });
  if (!d.description.trim())
    issues.push({
      field: "description",
      message: "Informe a descrição do anúncio.",
    });
  if (parsePrice(d.price) === null)
    issues.push({
      field: "price",
      message: "Preço inválido. Use 19,90 ou 19.90.",
    });
  const stock = parseStock(d.stock);
  if (stock === null || stock <= 0)
    issues.push({
      field: "stock",
      message: "Estoque deve ser um número inteiro maior que zero.",
    });
  if (d.pictureCount < 1)
    issues.push({
      field: "pictures",
      message: "O produto precisa de ao menos uma foto.",
    });
  const gtin = d.gtin.trim();
  if (gtin) {
    const check = validateGtin(gtin);
    if (!check.ok) issues.push({ field: "gtin", message: check.reason });
  }
  const cat = DEMO_CATEGORIES.find((c) => c.id === d.categoryId);
  if (!cat)
    issues.push({ field: "category", message: "Escolha uma categoria." });
  else
    for (const a of cat.required) {
      const v = (d.attributes[a.id] ?? "").trim();
      if (!v)
        issues.push({
          field: `attr:${a.id}`,
          message: `${a.name} é obrigatório nesta categoria.`,
        });
      else if (a.values && !a.values.includes(v))
        issues.push({
          field: `attr:${a.id}`,
          message: `${a.name}: escolha uma opção da lista.`,
        });
    }
  return issues;
}

/** Assinatura dos campos que invalidam a aprovação quando mudam. */
export function draftSignature(d: DemoDraft): string {
  return JSON.stringify([
    d.productId,
    d.title.trim(),
    d.description.trim(),
    d.price.trim(),
    d.stock.trim(),
    d.pictureCount,
    d.categoryId,
    d.gtin.trim(),
    d.attributes,
  ]);
}

export type PublishResult =
  { ok: true; listing: DemoListing } | { ok: false; message: string };

/** Publica somente no armazenamento local, após revalidar. Bloqueia duplicidade pela assinatura. */
export function publishDemo(
  userId: string,
  d: DemoDraft,
  approvedSignature: string | null,
  productName: string | null,
  s: Store | null = defaultStore(),
  channel: PresentationChannel = "mercado_livre",
): PublishResult {
  const state = loadDemo(userId, s, channel);
  if (!state)
    return {
      ok: false,
      message: `Conecte ${CHANNEL_LABEL[channel]} em Integrações primeiro.`,
    };
  if (validateDemo(d).length > 0)
    return { ok: false, message: "Revise as pendências antes de publicar." };
  const sig = draftSignature(d);
  if (approvedSignature !== sig)
    return {
      ok: false,
      message: "Valide novamente: o anúncio mudou após a validação.",
    };
  if (
    state.listings.some(
      (l) =>
        l.origin === "created" &&
        (l as DemoListing & { sig?: string }).sig === sig,
    )
  )
    return { ok: false, message: "Este anúncio já foi publicado." };
  const cat = DEMO_CATEGORIES.find((c) => c.id === d.categoryId)!;
  const listing: DemoListing & { sig: string } = {
    id: `ECOM-${channel}-${crypto.randomUUID()}`,
    title: d.title.trim(),
    price: parsePrice(d.price)!,
    stock: parseStock(d.stock)!,
    status: "active",
    categoryId: cat.id,
    categoryName: cat.name,
    origin: "created",
    productName,
    updatedAt: new Date().toISOString(),
    sig,
  };
  const next = { ...state, listings: [listing, ...state.listings] };
  if (!save(userId, next, s, channel))
    return {
      ok: false,
      message: "Não foi possível salvar neste navegador. Nada foi publicado.",
    };
  return { ok: true, listing };
}

/** Edita um anúncio de demonstração (só localStorage). Retorna o novo estado ou null se falhar. */
export function updateDemoListing(
  userId: string,
  id: string,
  patch: Pick<DemoListing, "title" | "price" | "stock" | "status">,
  s: Store | null = defaultStore(),
  channel: PresentationChannel = "mercado_livre",
): DemoState | null {
  const state = loadDemo(userId, s, channel);
  if (!state) return null;
  const next: DemoState = {
    ...state,
    listings: state.listings.map((l) =>
      l.id === id ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l,
    ),
  };
  return save(userId, next, s, channel) ? next : null;
}

/** Exclui um anúncio de demonstração (só localStorage). */
export function deleteDemoListing(
  userId: string,
  id: string,
  s: Store | null = defaultStore(),
  channel: PresentationChannel = "mercado_livre",
): DemoState | null {
  const state = loadDemo(userId, s, channel);
  if (!state) return null;
  const next: DemoState = {
    ...state,
    listings: state.listings.filter((l) => l.id !== id),
  };
  return save(userId, next, s, channel) ? next : null;
}
