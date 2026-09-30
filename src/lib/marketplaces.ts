export type MarketplaceChannel = "mercado_livre" | "shopee" | "amazon";

export const MARKETPLACES: {
  id: MarketplaceChannel;
  label: string;
  short: string;
  description: string;
  docsLabel: string;
}[] = [
  {
    id: "mercado_livre",
    label: "Mercado Livre",
    short: "ML",
    description: "Sincronize anúncios, pedidos e estoque da sua conta do Mercado Livre.",
    docsLabel: "Aplicação Mercado Livre Developers",
  },
  {
    id: "shopee",
    label: "Shopee",
    short: "SH",
    description: "Conecte sua loja Shopee para importar pedidos e enviar estoque.",
    docsLabel: "Shopee Open Platform",
  },
  {
    id: "amazon",
    label: "Amazon",
    short: "AMZ",
    description: "Integre com o Amazon Seller Central via Selling Partner API.",
    docsLabel: "Amazon Selling Partner API",
  },
];

export const MARKETPLACE_LABEL: Record<MarketplaceChannel, string> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
};

export const CONNECTION_STATUS_LABEL: Record<string, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando",
  connected: "Conectado",
  error: "Erro",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export const LISTING_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  ready: "Pronto para publicar",
  publishing: "Publicando",
  active: "Ativo",
  paused: "Pausado",
  error: "Erro",
};

export const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  entry: "Entrada",
  sale: "Venda",
  adjustment: "Ajuste",
  return: "Devolução",
  reservation: "Reserva",
  release: "Liberação",
};
