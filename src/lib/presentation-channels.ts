import { MARKETPLACES, type MarketplaceChannel } from "@/lib/marketplaces";

export type PresentationChannel =
  MarketplaceChannel | "aliexpress" | "tiktok_shop";
export const CHANNELS: {
  id: PresentationChannel;
  label: string;
  short: string;
}[] = [
  ...MARKETPLACES,
  { id: "aliexpress", label: "AliExpress", short: "ALI" },
  { id: "tiktok_shop", label: "TikTok Shop", short: "TK" },
];
export const CHANNEL_LABEL = Object.fromEntries(
  CHANNELS.map((channel) => [channel.id, channel.label]),
) as Record<PresentationChannel, string>;
export const CHANNEL_STORE_NAME: Record<PresentationChannel, string> = {
  mercado_livre: "Loja ECOM Mercado Livre",
  shopee: "Loja ECOM Shopee",
  amazon: "ECOM Store Amazon",
  aliexpress: "ECOM Store AliExpress",
  tiktok_shop: "ECOM Shop TikTok Shop",
};
export function isChannel(value: unknown): value is PresentationChannel {
  return CHANNELS.some((channel) => channel.id === value);
}
export type PresentationOrder = {
  id: string;
  external_order_id: string;
  marketplace: PresentationChannel;
  placed_at: string;
  status: "pending" | "paid" | "shipped";
  buyer_name: string;
  buyer_email: string;
  buyer_document: null;
  currency: string;
  total_amount: number;
  shipping_amount: number;
  fees_amount: number;
  shipping_address: Record<string, string>;
  history: { at: string; label: string }[];
  order_items: {
    id: string;
    title: string;
    sku: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
};

type SeedProduct = { title: string; sku: string; price: number; qty: number };
const ORDER_PRODUCTS: Record<PresentationChannel, SeedProduct[]> = {
  mercado_livre: [
    { title: "Fone Bluetooth Sem Fio", sku: "ML-FONE-01", price: 89.9, qty: 2 },
    {
      title: "Garrafa Térmica Inox 1 Litro",
      sku: "ML-GARRAFA-01",
      price: 59.9,
      qty: 1,
    },
    { title: "Tênis Corrida Leve", sku: "ML-TENIS-01", price: 179.9, qty: 1 },
  ],
  shopee: [
    {
      title: "Kit 3 Potes Organizadores",
      sku: "SHP-POTES-03",
      price: 42.9,
      qty: 1,
    },
    { title: "Luminária LED de Mesa", sku: "SHP-LUZ-02", price: 69.9, qty: 1 },
    {
      title: "Capa Protetora para Celular",
      sku: "SHP-CAPA-05",
      price: 29.9,
      qty: 2,
    },
  ],
  amazon: [
    {
      title: "Teclado Mecânico Compacto",
      sku: "AMZ-TEC-01",
      price: 219.9,
      qty: 1,
    },
    {
      title: "Suporte Ajustável para Notebook",
      sku: "AMZ-SUP-02",
      price: 99.9,
      qty: 1,
    },
    {
      title: "Hub USB-C com 5 Portas",
      sku: "AMZ-HUB-05",
      price: 119.9,
      qty: 1,
    },
  ],
  aliexpress: [
    {
      title: "Mini Projetor Portátil HD",
      sku: "ALI-PROJ-01",
      price: 289.9,
      qty: 1,
    },
    { title: "Fita LED RGB 5 Metros", sku: "ALI-LED-05", price: 39.9, qty: 2 },
    {
      title: "Relógio Digital de Mesa",
      sku: "ALI-REL-03",
      price: 54.9,
      qty: 1,
    },
  ],
  tiktok_shop: [
    {
      title: "Smartwatch Esportivo com Pulseira",
      sku: "TT-SMART-01",
      price: 149.9,
      qty: 1,
    },
    {
      title: "Garrafa Motivacional 1 Litro",
      sku: "TT-GARRAFA-02",
      price: 34.9,
      qty: 2,
    },
    { title: "Kit Skincare Facial", sku: "TT-SKIN-03", price: 79.9, qty: 1 },
  ],
};
const BUYERS: Record<PresentationChannel, string[]> = {
  mercado_livre: ["Marina Oliveira", "Rafael Santos", "Bruna Almeida"],
  shopee: ["Camila Souza", "Pedro Lima", "Júlia Costa"],
  amazon: ["Lucas Martins", "Beatriz Rocha", "André Ferreira"],
  aliexpress: ["Fernanda Alves", "Diego Ribeiro", "Isabela Gomes"],
  tiktok_shop: ["Letícia Cardoso", "Gustavo Nunes", "Sofia Barros"],
};
const CITIES: Record<PresentationChannel, string> = {
  mercado_livre: "São Paulo",
  shopee: "Campinas",
  amazon: "Curitiba",
  aliexpress: "Belo Horizonte",
  tiktok_shop: "Rio de Janeiro",
};

export function seedOrders(
  channel: PresentationChannel,
  connectedAt: string,
): PresentationOrder[] {
  const products = ORDER_PRODUCTS[channel];
  const base = new Date(connectedAt).getTime();
  return products.map((product, index) => {
    const at = new Date(base - index * 3600000).toISOString();
    const id = `ECOM-${channel}-${index + 1}`;
    const status = (["paid", "shipped", "pending"] as const)[index]!;
    const subtotal = Math.round(product.price * product.qty * 100) / 100;
    return {
      id,
      external_order_id: `${CHANNELS.find((item) => item.id === channel)!.short}-${channel === "mercado_livre" ? "2" : channel === "shopee" ? "3" : channel === "amazon" ? "4" : channel === "aliexpress" ? "5" : "6"}00${index + 1}`,
      marketplace: channel,
      placed_at: at,
      status,
      buyer_name: BUYERS[channel][index]!,
      buyer_email: `cliente.${channel}.${index + 1}@example.invalid`,
      buyer_document: null,
      currency: "BRL",
      total_amount: Math.round((subtotal + 12.9) * 100) / 100,
      shipping_amount: 12.9,
      fees_amount: Math.round(subtotal * 0.12 * 100) / 100,
      shipping_address: {
        Endereço: `Rua ${BUYERS[channel][index]!.split(" ")[0]}, ${100 + index}`,
        Cidade: CITIES[channel],
        Estado: "SP",
      },
      history: [
        { at, label: "Pedido recebido" },
        ...(status === "pending" ? [] : [{ at, label: "Pagamento aprovado" }]),
        ...(status === "shipped" ? [{ at, label: "Em transporte" }] : []),
      ],
      order_items: [
        {
          id: `${id}-item-1`,
          title: product.title,
          sku: product.sku,
          quantity: product.qty,
          unit_price: product.price,
          total_price: subtotal,
        },
      ],
    };
  });
}
