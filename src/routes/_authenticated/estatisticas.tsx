import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  Package,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageShell } from "@/components/layout/PageShell";
import { LoadingState } from "@/components/common/StateBlocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { MARKETPLACE_LABEL } from "@/lib/marketplaces";
import { usePresentation } from "@/hooks/usePresentation";
import { useAnyMarketplaceConnected } from "@/hooks/useMarketplaceConnected";
import type { PresentationChannel } from "@/lib/presentation-channels";

export const Route = createFileRoute("/_authenticated/estatisticas")({
  head: () => ({
    meta: [
      { title: "Estatísticas | ECOM" },
      {
        name: "description",
        content: "Acompanhe vendas, pedidos e produtos dos seus marketplaces.",
      },
    ],
  }),
  component: StatisticsPage,
});

type Range = { from: Date; to: Date };
type PeriodKey = "today" | "7d" | "30d" | "3m" | "6m" | "1y" | "custom";
type MetricKey = "revenue" | "orders" | "products";
type StatsOrder = {
  id: string;
  marketplace: string;
  status: string;
  total_amount: number;
  placed_at: string | null;
};
type StatsItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  title: string;
  sku: string | null;
  quantity: number;
  total_price: number;
};
type StatsProduct = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  low_stock_threshold: number;
};
type InventoryBalance = {
  product_id: string;
  quantity: number;
  reserved: number;
  low_stock_threshold: number;
};
type MarketplaceConnection = { marketplace: string; status: string };
type MarketplaceListing = { product_id: string; marketplace: string };
type StatsData = {
  orders: StatsOrder[];
  items: StatsItem[];
  products: StatsProduct[];
  balances: InventoryBalance[];
  connections: MarketplaceConnection[];
  listings: MarketplaceListing[];
};
type FilteredOrder = StatsOrder & { items: StatsItem[] };

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "3m", label: "Últimos 3 meses" },
  { key: "6m", label: "Últimos 6 meses" },
  { key: "1y", label: "Último ano" },
  { key: "custom", label: "Personalizado" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Aguardando pagamento" },
  { value: "paid", label: "Pagamento aprovado" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregues" },
  { value: "cancelled", label: "Cancelados" },
  { value: "refunded", label: "Reembolsados" },
];

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "revenue", label: "Faturamento" },
  { key: "orders", label: "Pedidos" },
  { key: "products", label: "Produtos vendidos" },
];

const isRevenueStatus = (status: string) =>
  ["paid", "shipped", "delivered"].includes(status);
function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function dateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeFor(
  period: PeriodKey,
  fromValue: string,
  toValue: string,
): Range {
  const now = new Date();
  const to = endOfDay(now);
  const from = startOfDay(now);

  if (period === "custom") {
    const customFrom = fromValue ? new Date(`${fromValue}T00:00:00`) : from;
    const customTo = toValue ? new Date(`${toValue}T23:59:59.999`) : to;
    return customFrom <= customTo
      ? { from: customFrom, to: customTo }
      : { from: customTo, to: customFrom };
  }

  if (period === "today") return { from, to };
  if (period === "7d") from.setDate(from.getDate() - 6);
  if (period === "30d") from.setDate(from.getDate() - 29);
  if (period === "3m") from.setMonth(from.getMonth() - 3);
  if (period === "6m") from.setMonth(from.getMonth() - 6);
  if (period === "1y") from.setFullYear(from.getFullYear() - 1);
  return { from, to };
}

function precedingRange(range: Range): Range {
  const duration = range.to.getTime() - range.from.getTime() + 1;
  return {
    from: new Date(range.from.getTime() - duration),
    to: new Date(range.from.getTime() - 1),
  };
}

function inRange(value: string | null, range: Range) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= range.from.getTime() && time <= range.to.getTime();
}

function dateLabel(range: Range) {
  const format = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  return `${format.format(range.from)} – ${format.format(range.to)}`;
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? null : undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatPercent(value: number | null | undefined) {
  if (value === undefined) return "Nova base";
  if (value === null) return "Sem variação";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function sumItems(items: StatsItem[]) {
  return items.reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function buildPresentationStatisticsData(
  channels: {
    marketplace: PresentationChannel;
    listings: {
      id: string;
      title: string;
      stock: number;
      categoryName: string;
      productName: string | null;
    }[];
    orders?: {
      id: string;
      marketplace: PresentationChannel;
      status: string;
      total_amount: number;
      placed_at: string;
      order_items: {
        id: string;
        title: string;
        sku: string;
        quantity: number;
        total_price: number;
      }[];
    }[];
  }[],
): StatsData {
  const productIdFor = (name: string, sku?: string | null) =>
    sku?.trim()
      ? `sku:${sku.trim().toLocaleLowerCase("pt-BR")}`
      : `name:${name.trim().toLocaleLowerCase("pt-BR")}`;
  const products = new Map<string, StatsProduct>();
  const stockByProduct = new Map<string, number>();
  const listings: MarketplaceListing[] = [];
  const orders: StatsOrder[] = [];
  const items: StatsItem[] = [];

  for (const channel of channels) {
    for (const listing of channel.listings) {
      const name = listing.productName?.trim() || listing.title;
      const productId = productIdFor(name);
      const existing = products.get(productId);
      products.set(productId, {
        id: productId,
        name,
        sku: null,
        category: listing.categoryName || null,
        // The local marketplace fixtures do not provide a configured threshold.
        // Treat only zero stock as low stock instead of making up a threshold.
        low_stock_threshold: 0,
      });
      const previousStock = stockByProduct.get(productId);
      stockByProduct.set(
        productId,
        previousStock === undefined
          ? listing.stock
          : Math.min(previousStock, listing.stock),
      );
      listings.push({
        product_id: productId,
        marketplace: channel.marketplace,
      });
      if (!existing?.category && listing.categoryName) {
        products.set(productId, {
          ...products.get(productId)!,
          category: listing.categoryName,
        });
      }
    }

    for (const order of channel.orders ?? []) {
      orders.push({
        id: order.id,
        marketplace: order.marketplace,
        status: order.status,
        total_amount: order.total_amount,
        placed_at: order.placed_at,
      });
      for (const item of order.order_items) {
        const itemWords = item.title
          .toLocaleLowerCase("pt-BR")
          .split(/[^\p{L}\p{N}]+/u)
          .filter(Boolean);
        const matchedListing = [...products.values()].find((product) => {
          if (!product.id.startsWith("name:")) return false;
          const listingWords = product.name
            .toLocaleLowerCase("pt-BR")
            .split(/[^\p{L}\p{N}]+/u)
            .filter(Boolean);
          const [shorter, longer] =
            itemWords.length <= listingWords.length
              ? [itemWords, listingWords]
              : [listingWords, itemWords];
          return (
            shorter.length > 1 && shorter.every((word) => longer.includes(word))
          );
        });
        const productId =
          matchedListing?.id ?? productIdFor(item.title, item.sku);
        items.push({
          id: item.id,
          order_id: order.id,
          product_id: productId,
          title: item.title,
          sku: item.sku || null,
          quantity: item.quantity,
          total_price: item.total_price,
        });
        if (!products.has(productId)) {
          products.set(productId, {
            id: productId,
            name: item.title,
            sku: item.sku || null,
            category: null,
            low_stock_threshold: 0,
          });
        } else if (!products.get(productId)?.sku && item.sku) {
          products.set(productId, {
            ...products.get(productId)!,
            sku: item.sku,
          });
        }
      }
    }
  }

  return {
    orders,
    items,
    products: [...products.values()],
    balances: [...stockByProduct].map(([product_id, quantity]) => ({
      product_id,
      quantity,
      reserved: 0,
      low_stock_threshold: 0,
    })),
    connections: channels.map(({ marketplace }) => ({
      marketplace,
      status: "connected",
    })),
    listings,
  };
}

function StatisticsPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState(
    dateInputValue(startOfDay(new Date())),
  );
  const [customTo, setCustomTo] = useState(dateInputValue(new Date()));
  const [marketplace, setMarketplace] = useState("all");
  const [productId, setProductId] = useState("all");
  const [category, setCategory] = useState("all");
  const [orderStatus, setOrderStatus] = useState("all");
  const [metric, setMetric] = useState<MetricKey>("revenue");
  const [productView, setProductView] = useState<
    "best" | "decline" | "none" | "low"
  >("best");

  const presentation = usePresentation();
  const { connected: marketplaceConnected } = useAnyMarketplaceConnected();
  const data = useMemo(
    () => buildPresentationStatisticsData(presentation.channels),
    [presentation.channels],
  );
  const refreshLocalData = () =>
    window.dispatchEvent(new Event("ecom:channels-changed"));

  const productsById = useMemo(
    () =>
      new Map((data?.products ?? []).map((product) => [product.id, product])),
    [data?.products],
  );
  const itemsByOrder = useMemo(() => {
    const grouped = new Map<string, StatsItem[]>();
    for (const item of data?.items ?? []) {
      const group = grouped.get(item.order_id) ?? [];
      group.push(item);
      grouped.set(item.order_id, group);
    }
    return grouped;
  }, [data?.items]);

  const range = rangeFor(period, customFrom, customTo);
  const previous = precedingRange(range);
  const marketplaces = useMemo(() => {
    const values = new Set<string>();
    for (const connection of data?.connections ?? []) {
      if (connection.status === "connected") values.add(connection.marketplace);
    }
    for (const order of data?.orders ?? []) values.add(order.marketplace);
    return Array.from(values).sort((a, b) =>
      (
        MARKETPLACE_LABEL[a as keyof typeof MARKETPLACE_LABEL] ?? a
      ).localeCompare(
        MARKETPLACE_LABEL[b as keyof typeof MARKETPLACE_LABEL] ?? b,
        "pt-BR",
      ),
    );
  }, [data?.connections, data?.orders]);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          (data?.products ?? [])
            .map((product) => product.category?.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => String(a).localeCompare(String(b), "pt-BR")),
    [data?.products],
  );

  const filterOrders = (selectedRange: Range): FilteredOrder[] =>
    (data?.orders ?? [])
      .filter((order) => inRange(order.placed_at, selectedRange))
      .filter(
        (order) => marketplace === "all" || order.marketplace === marketplace,
      )
      .filter((order) => orderStatus === "all" || order.status === orderStatus)
      .map((order) => {
        const items = itemsByOrder.get(order.id) ?? [];
        const matchingItems = items.filter((item) => {
          if (productId !== "all" && item.product_id !== productId)
            return false;
          if (category !== "all") {
            const itemCategory = item.product_id
              ? productsById.get(item.product_id)?.category
              : null;
            if (itemCategory !== category) return false;
          }
          return true;
        });
        return { ...order, items: matchingItems };
      })
      .filter(
        (order) =>
          (productId === "all" && category === "all") || order.items.length > 0,
      );

  const currentOrders = filterOrders(range);
  const previousOrders = filterOrders(previous);

  const calculateMetrics = useCallback(
    (orders: FilteredOrder[]) => {
      const confirmed = orders.filter((order) => isRevenueStatus(order.status));
      const revenue = confirmed.reduce((total, order) => {
        if (productId !== "all" || category !== "all") {
          return (
            total +
            order.items.reduce(
              (sum, item) => sum + Number(item.total_price || 0),
              0,
            )
          );
        }
        return total + Number(order.total_amount || 0);
      }, 0);
      const productsSold = confirmed.reduce(
        (total, order) => total + sumItems(order.items),
        0,
      );
      const cancellations = orders.filter(
        (order) => order.status === "cancelled",
      ).length;
      const ongoing = orders.filter((order) =>
        ["pending", "paid", "shipped"].includes(order.status),
      ).length;
      return {
        revenue,
        orders: confirmed.length,
        products: productsSold,
        cancellations,
        ongoing,
        averageTicket: confirmed.length ? revenue / confirmed.length : 0,
      };
    },
    [productId, category],
  );

  const currentMetrics = calculateMetrics(currentOrders);
  const previousMetrics = calculateMetrics(previousOrders);

  const productStats = useMemo(() => {
    const current = new Map<
      string,
      { quantity: number; revenue: number; channels: Set<string> }
    >();
    const before = new Map<string, number>();
    const addPeriod = (
      orders: FilteredOrder[],
      target:
        | Map<
            string,
            { quantity: number; revenue: number; channels: Set<string> }
          >
        | Map<string, number>,
      isCurrent: boolean,
    ) => {
      for (const order of orders) {
        if (!isRevenueStatus(order.status)) continue;
        for (const item of order.items) {
          const key = item.product_id ?? `snapshot:${item.sku ?? item.title}`;
          if (isCurrent) {
            const currentTarget = target as Map<
              string,
              { quantity: number; revenue: number; channels: Set<string> }
            >;
            const row = currentTarget.get(key) ?? {
              quantity: 0,
              revenue: 0,
              channels: new Set<string>(),
            };
            row.quantity += Number(item.quantity || 0);
            row.revenue += Number(item.total_price || 0);
            row.channels.add(order.marketplace);
            currentTarget.set(key, row);
          } else {
            const previousTarget = target as Map<string, number>;
            previousTarget.set(
              key,
              (previousTarget.get(key) ?? 0) + Number(item.quantity || 0),
            );
          }
        }
      }
    };
    addPeriod(currentOrders, current, true);
    addPeriod(previousOrders, before, false);

    const stock = new Map<string, number>();
    for (const balance of data?.balances ?? []) {
      stock.set(
        balance.product_id,
        (stock.get(balance.product_id) ?? 0) + Number(balance.quantity || 0),
      );
    }
    return (data?.products ?? [])
      .filter(
        (product) =>
          marketplace === "all" ||
          (current.get(product.id)?.channels.has(marketplace) ?? false) ||
          (data?.listings ?? []).some(
            (listing) =>
              listing.product_id === product.id &&
              listing.marketplace === marketplace,
          ),
      )
      .filter((product) => productId === "all" || product.id === productId)
      .filter((product) => category === "all" || product.category === category)
      .map((product) => {
        const sales = current.get(product.id);
        const availableStock = stock.has(product.id)
          ? stock.get(product.id)!
          : null;
        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          quantity: sales?.quantity ?? 0,
          revenue: sales?.revenue ?? 0,
          previousQuantity: before.get(product.id) ?? 0,
          channels: Array.from(
            new Set([
              ...Array.from(sales?.channels ?? []),
              ...(data?.listings ?? [])
                .filter((listing) => listing.product_id === product.id)
                .map((listing) => listing.marketplace),
            ]),
          ),
          stock: availableStock,
          threshold: product.low_stock_threshold,
        };
      });
  }, [
    data?.balances,
    data?.listings,
    data?.products,
    currentOrders,
    previousOrders,
    marketplace,
    productId,
    category,
  ]);

  const marketplaceStats = useMemo(() => {
    const previousByMarket = new Map<string, FilteredOrder[]>();
    for (const order of previousOrders) {
      const list = previousByMarket.get(order.marketplace) ?? [];
      list.push(order);
      previousByMarket.set(order.marketplace, list);
    }
    return marketplaces
      .filter((channel) => marketplace === "all" || channel === marketplace)
      .map((channel) => {
        const nowOrders = currentOrders.filter(
          (order) => order.marketplace === channel,
        );
        const oldOrders = previousByMarket.get(channel) ?? [];
        const now = calculateMetrics(nowOrders);
        const old = calculateMetrics(oldOrders);
        return {
          channel,
          orders: nowOrders.length,
          revenue: now.revenue,
          share: currentMetrics.revenue
            ? (now.revenue / currentMetrics.revenue) * 100
            : 0,
          ticket: now.averageTicket,
          change: percentChange(now.revenue, old.revenue),
        };
      })
      .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
  }, [
    marketplaces,
    marketplace,
    currentOrders,
    previousOrders,
    currentMetrics.revenue,
    calculateMetrics,
  ]);

  const trend = useMemo(() => {
    const daySpan = Math.ceil(
      (range.to.getTime() - range.from.getTime()) / 86_400_000,
    );
    const mode = daySpan <= 31 ? "day" : daySpan <= 180 ? "week" : "month";
    const bucketStart = (date: Date) => {
      const point = new Date(date);
      point.setHours(0, 0, 0, 0);
      if (mode === "week") {
        const weekday = (point.getDay() + 6) % 7;
        point.setDate(point.getDate() - weekday);
      } else if (mode === "month") {
        point.setDate(1);
      }
      return point;
    };
    const aggregate = new Map<
      string,
      { revenue: number; orders: number; products: number; date: Date }
    >();
    const first = bucketStart(range.from);
    const last = bucketStart(range.to);
    for (const point = new Date(first); point <= last;) {
      aggregate.set(dateInputValue(point), {
        revenue: 0,
        orders: 0,
        products: 0,
        date: new Date(point),
      });
      if (mode === "day") point.setDate(point.getDate() + 1);
      else if (mode === "week") point.setDate(point.getDate() + 7);
      else point.setMonth(point.getMonth() + 1);
    }
    for (const order of currentOrders) {
      if (!order.placed_at || !isRevenueStatus(order.status)) continue;
      const orderDate = new Date(order.placed_at);
      const point = bucketStart(orderDate);
      const key = dateInputValue(point);
      const row = aggregate.get(key) ?? {
        revenue: 0,
        orders: 0,
        products: 0,
        date: point,
      };
      row.orders += 1;
      row.products += sumItems(order.items);
      row.revenue +=
        productId !== "all" || category !== "all"
          ? order.items.reduce(
              (sum, item) => sum + Number(item.total_price || 0),
              0,
            )
          : Number(order.total_amount || 0);
      aggregate.set(key, row);
    }
    return Array.from(aggregate.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((row) => ({
        label:
          mode === "month"
            ? new Intl.DateTimeFormat("pt-BR", {
                month: "short",
                year: "2-digit",
              }).format(row.date)
            : new Intl.DateTimeFormat("pt-BR", {
                day: "2-digit",
                month: "short",
              }).format(row.date),
        ...row,
      }));
  }, [currentOrders, range, productId, category]);

  const statusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of currentOrders)
      counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
    return Array.from(counts, ([value, count]) => ({
      status:
        STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value,
      count,
      position: STATUS_OPTIONS.findIndex((option) => option.value === value),
    }))
      .sort(
        (a, b) =>
          (a.position < 0 ? Infinity : a.position) -
          (b.position < 0 ? Infinity : b.position),
      )
      .map(({ status, count }) => ({ status, count }));
  }, [currentOrders]);

  const maxMarketplaceRevenue = Math.max(
    1,
    ...marketplaceStats.map((item) => item.revenue),
  );
  const productRows = useMemo(() => {
    if (productView === "best")
      return [...productStats]
        .filter((p) => p.quantity > 0)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 8);
    if (productView === "decline")
      return [...productStats]
        .filter(
          (p) => p.previousQuantity > p.quantity && p.previousQuantity > 0,
        )
        .sort(
          (a, b) =>
            b.previousQuantity - b.quantity - (a.previousQuantity - a.quantity),
        )
        .slice(0, 8);
    if (productView === "none")
      return productStats.filter((p) => p.quantity === 0).slice(0, 8);
    return productStats
      .filter((p) => p.stock !== null && p.stock <= p.threshold)
      .sort((a, b) => Number(a.stock) - Number(b.stock))
      .slice(0, 8);
  }, [productStats, productView]);

  if (!presentation.ready)
    return (
      <PageShell
        title="Estatísticas"
        description="Desempenho dos canais conectados neste navegador"
      >
        <LoadingState />
      </PageShell>
    );

  const metrics = [
    {
      label: "Faturamento",
      value: formatCurrency(currentMetrics.revenue),
      prior: currentMetrics.revenue - previousMetrics.revenue,
      icon: CircleDollarSign,
      change: percentChange(currentMetrics.revenue, previousMetrics.revenue),
      money: true,
    },
    {
      label: "Vendas",
      value: currentMetrics.orders.toLocaleString("pt-BR"),
      prior: currentMetrics.orders - previousMetrics.orders,
      icon: ShoppingCart,
      change: percentChange(currentMetrics.orders, previousMetrics.orders),
    },
    {
      label: "Ticket médio",
      value: formatCurrency(currentMetrics.averageTicket),
      prior: currentMetrics.averageTicket - previousMetrics.averageTicket,
      icon: Activity,
      change: percentChange(
        currentMetrics.averageTicket,
        previousMetrics.averageTicket,
      ),
      money: true,
    },
    {
      label: "Produtos vendidos",
      value: currentMetrics.products.toLocaleString("pt-BR"),
      prior: currentMetrics.products - previousMetrics.products,
      icon: Package,
      change: percentChange(currentMetrics.products, previousMetrics.products),
    },
    {
      label: "Cancelados",
      value: currentMetrics.cancellations.toLocaleString("pt-BR"),
      prior: currentMetrics.cancellations - previousMetrics.cancellations,
      icon: TrendingDown,
      change: percentChange(
        currentMetrics.cancellations,
        previousMetrics.cancellations,
      ),
      reverse: true,
    },
    {
      label: "Em andamento",
      value: currentMetrics.ongoing.toLocaleString("pt-BR"),
      prior: currentMetrics.ongoing - previousMetrics.ongoing,
      icon: ShoppingBag,
      change: percentChange(currentMetrics.ongoing, previousMetrics.ongoing),
    },
    {
      label: "Crescimento",
      value: formatPercent(
        percentChange(currentMetrics.revenue, previousMetrics.revenue),
      ),
      prior: currentMetrics.revenue - previousMetrics.revenue,
      icon: TrendingUp,
      change: percentChange(currentMetrics.revenue, previousMetrics.revenue),
      isGrowth: true,
    },
  ];

  const trendDataKey =
    metric === "revenue"
      ? "revenue"
      : metric === "orders"
        ? "orders"
        : "products";
  const trendFormat = (value: number) =>
    metric === "revenue"
      ? formatCurrency(value)
      : value.toLocaleString("pt-BR");
  const trendMetricLabel =
    METRICS.find((item) => item.key === metric)?.label ?? "Faturamento";

  return (
    <PageShell
      title="Estatísticas"
      description="Desempenho dos canais conectados neste navegador"
    >
      <section
        aria-label="Filtros das estatísticas"
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-card/40 p-3"
      >
        <div className="min-w-44 space-y-1">
          <label className="text-[11px] text-muted-foreground">Período</label>
          <Select
            value={period}
            onValueChange={(value) => setPeriod(value as PeriodKey)}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FilterSelect
          label="Marketplace"
          value={marketplace}
          onChange={setMarketplace}
          options={marketplaces.map((value) => [
            value,
            MARKETPLACE_LABEL[value as keyof typeof MARKETPLACE_LABEL] ?? value,
          ])}
        />
        <FilterSelect
          label="Produto"
          value={productId}
          onChange={setProductId}
          options={data.products.map((product) => [product.id, product.name])}
        />
        <FilterSelect
          label="Categoria"
          value={category}
          onChange={setCategory}
          options={categories.map((value) => [String(value), String(value)])}
        />
        <FilterSelect
          label="Status do pedido"
          value={orderStatus}
          onChange={setOrderStatus}
          options={STATUS_OPTIONS.map((item) => [item.value, item.label])}
        />
        {period === "custom" ? (
          <div className="flex flex-wrap gap-2">
            <DateField label="De" value={customFrom} onChange={setCustomFrom} />
            <DateField label="Até" value={customTo} onChange={setCustomTo} />
          </div>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={refreshLocalData}
          aria-label="Atualizar estatísticas"
        >
          <RefreshCw className="size-3.5" /> Atualizar
        </Button>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <p>
          Período analisado:{" "}
          <span className="font-medium text-foreground">
            {dateLabel(range)}
          </span>
        </p>
        <p>Comparação: período anterior equivalente ({dateLabel(previous)})</p>
      </div>

      <section
        aria-label="Indicadores de vendas"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </section>

      {currentOrders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-5 py-4 text-xs text-muted-foreground">
          {marketplaceConnected ? (
            <>
              Sua conta está conectada, mas não há pedidos neste período e com
              os filtros selecionados.{" "}
              <Link to="/integracoes" className="font-medium text-foreground underline underline-offset-2">
                Sincronize em Integrações
              </Link>{" "}
              para trazer os pedidos recentes.
            </>
          ) : (
            <>
              Não há pedidos neste período e com os filtros selecionados. Os
              indicadores acompanham os pedidos dos canais conectados nesta
              sessão.{" "}
              <Link to="/integracoes" className="font-medium text-foreground underline underline-offset-2">
                Conectar marketplace
              </Link>
              .
            </>
          )}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <Card className="glass-panel border-border/70 shadow-none">
          <CardHeader className="flex-col items-stretch justify-between gap-3 px-4 pb-2 pt-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="text-sm">Desempenho no período</CardTitle>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Dados agregados dos pedidos registrados
              </p>
            </div>
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-border/70 p-1">
              {METRICS.map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant={metric === item.key ? "secondary" : "ghost"}
                  className="h-7 px-2 text-[10px]"
                  onClick={() => setMetric(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4 pt-2">
            {currentOrders.some((order) => isRevenueStatus(order.status)) ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                  data={trend}
                  margin={{ top: 8, right: 16, left: 4, bottom: 2 }}
                >
                  <defs>
                    <linearGradient
                      id="statsTrendFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--primary)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--primary)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                    }}
                    minTickGap={24}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={68}
                    tick={{
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                    }}
                    tickFormatter={(value) =>
                      metric === "revenue"
                        ? `R$ ${Number(value).toLocaleString("pt-BR")}`
                        : String(value)
                    }
                  />
                  <Tooltip
                    formatter={(value) => trendFormat(Number(value ?? 0))}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={trendDataKey}
                    name={trendMetricLabel}
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#statsTrendFill)"
                    dot={{ r: 3 }}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty />
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/70 shadow-none">
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="text-sm">Status dos pedidos</CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Pedidos dentro do período e filtros atuais
            </p>
          </CardHeader>
          <CardContent className="px-2 pb-4 pt-0">
            {statusData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={statusData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="status"
                    width={142}
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      fontSize: 11,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Pedidos"
                    fill="var(--primary)"
                    radius={[0, 4, 4, 0]}
                    barSize={12}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty />
            )}
            <p className="px-3 text-[10px] text-muted-foreground">
              A integração atual não registra “em preparação” como status
              separado.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <Card className="glass-panel border-border/70 shadow-none">
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="text-sm">Vendas por marketplace</CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Ranking por pedidos confirmados, calculado a partir dos pedidos
              registrados
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {marketplaceStats.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-xs">
                  <thead className="border-y border-border/60 bg-secondary/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Canal</th>
                      <th className="px-3 py-2.5 text-right">Pedidos</th>
                      <th className="px-3 py-2.5 text-right">Faturamento</th>
                      <th className="px-3 py-2.5 text-right">Participação</th>
                      <th className="px-3 py-2.5 text-right">Ticket médio</th>
                      <th className="px-4 py-2.5 text-right">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketplaceStats.map((row, index) => (
                      <tr
                        key={row.channel}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="size-5 justify-center p-0 text-[9px]"
                            >
                              {index + 1}
                            </Badge>
                            <span className="font-medium">
                              {MARKETPLACE_LABEL[
                                row.channel as keyof typeof MARKETPLACE_LABEL
                              ] ?? row.channel}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${(row.revenue / maxMarketplaceRevenue) * 100}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="numeric px-3 py-3 text-right">
                          {row.orders}
                        </td>
                        <td className="numeric px-3 py-3 text-right">
                          {formatCurrency(row.revenue)}
                        </td>
                        <td className="numeric px-3 py-3 text-right">
                          {row.share.toLocaleString("pt-BR", {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </td>
                        <td className="numeric px-3 py-3 text-right">
                          {formatCurrency(row.ticket)}
                        </td>
                        <td className="numeric px-4 py-3 text-right">
                          {formatPercent(row.change)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ChartEmpty label="Nenhum marketplace integrado ou com pedidos encontrados." />
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/70 shadow-none">
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="text-sm">Comparação de períodos</CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Período atual × anterior equivalente
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            <div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-2 text-[10px] text-muted-foreground">
              <span>Indicador</span>
              <span className="text-right">Atual</span>
              <span className="text-right">Anterior</span>
            </div>
            <div className="space-y-3">
              <ComparisonRow
                label="Faturamento"
                current={currentMetrics.revenue}
                previous={previousMetrics.revenue}
                currency
              />
              <ComparisonRow
                label="Vendas"
                current={currentMetrics.orders}
                previous={previousMetrics.orders}
              />
              <ComparisonRow
                label="Produtos vendidos"
                current={currentMetrics.products}
                previous={previousMetrics.products}
              />
              <ComparisonRow
                label="Ticket médio"
                current={currentMetrics.averageTicket}
                previous={previousMetrics.averageTicket}
                currency
              />
              <ComparisonRow
                label="Cancelamentos"
                current={currentMetrics.cancellations}
                previous={previousMetrics.cancellations}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="glass-panel border-border/70 shadow-none">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4">
          <div>
            <CardTitle className="text-sm">Desempenho dos produtos</CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Vendas e estoque atuais dos anúncios e pedidos dos canais
              conectados
            </p>
          </div>
          <FilterSelect
            label="Visão"
            value={productView}
            onChange={(value) => setProductView(value as typeof productView)}
            options={[
              ["best", "Mais vendidos"],
              ["decline", "Queda nas vendas"],
              ["none", "Sem vendas no período"],
              ["low", "Estoque baixo"],
            ]}
          />
        </CardHeader>
        <CardContent className="p-0">
          {productRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-xs">
                <thead className="border-y border-border/60 bg-secondary/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Produto</th>
                    <th className="px-3 py-2.5">SKU</th>
                    <th className="px-3 py-2.5">Marketplace</th>
                    <th className="px-3 py-2.5 text-right">Qtd. vendida</th>
                    <th className="px-3 py-2.5 text-right">Faturamento</th>
                    <th className="px-4 py-2.5 text-right">Estoque atual</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{product.name}</td>
                      <td className="numeric px-3 py-3 text-muted-foreground">
                        {product.sku || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {product.channels.length
                          ? product.channels
                              .map(
                                (channel) =>
                                  MARKETPLACE_LABEL[
                                    channel as keyof typeof MARKETPLACE_LABEL
                                  ] ?? channel,
                              )
                              .join(", ")
                          : "—"}
                      </td>
                      <td className="numeric px-3 py-3 text-right">
                        {product.quantity}
                      </td>
                      <td className="numeric px-3 py-3 text-right">
                        {formatCurrency(product.revenue)}
                      </td>
                      <td className="numeric px-4 py-3 text-right">
                        {product.stock === null ? (
                          "—"
                        ) : (
                          <span
                            className={
                              product.stock <= product.threshold
                                ? "text-amber-500"
                                : ""
                            }
                          >
                            {product.stock}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ChartEmpty label="Nenhum produto se enquadra nesta visão com os filtros selecionados." />
          )}
        </CardContent>
      </Card>
      <p className="text-[10px] text-muted-foreground">
        Os indicadores consideram pedidos com pagamento aprovado, enviados ou
        entregues. Pedidos cancelados e reembolsados não entram no faturamento.
        Os dados vêm do modo local de apresentação da plataforma neste
        navegador.
      </p>
    </PageShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: (readonly [string, string] | [string, string])[];
}) {
  return (
    <div className="min-w-40 space-y-1">
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-[11px] text-muted-foreground">
      <span className="block">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground"
      />
    </label>
  );
}

function MetricCard({
  label,
  value,
  prior,
  icon: Icon,
  change,
  money,
  reverse,
  isGrowth,
}: {
  label: string;
  value: string;
  prior: number;
  icon: typeof Activity;
  change: number | null | undefined;
  money?: boolean;
  reverse?: boolean;
  isGrowth?: boolean;
}) {
  const positive = (change ?? 0) >= 0;
  const favorable = reverse ? !positive : positive;
  const TrendIcon = positive ? ArrowUpRight : ArrowDownRight;
  const priorText = money
    ? formatCurrency(Math.abs(prior))
    : Math.abs(prior).toLocaleString("pt-BR");
  return (
    <Card className="glass-panel border-border/70 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <Icon className="size-4 text-primary" />
        </div>
        <p className="numeric mt-2 text-xl font-semibold tracking-tight">
          {value}
        </p>
        <div
          className={`mt-2 flex flex-wrap items-center gap-1 text-[10px] ${favorable ? "text-emerald-500" : "text-rose-500"}`}
        >
          {change === undefined ? (
            <span>Sem base anterior</span>
          ) : change === null ? (
            <span>Sem variação</span>
          ) : (
            <>
              <TrendIcon className="size-3" />
              <span>{formatPercent(change)} vs. anterior</span>
            </>
          )}
          {!isGrowth ? (
            <span className="text-muted-foreground">
              · {priorText} de diferença
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonRow({
  label,
  current,
  previous,
  currency,
}: {
  label: string;
  current: number;
  previous: number;
  currency?: boolean;
}) {
  const difference = current - previous;
  const change = percentChange(current, previous);
  const formatter = (value: number) =>
    currency
      ? formatCurrency(value)
      : value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const positive = difference >= 0;
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="numeric text-right text-xs font-medium">
        {formatter(current)}
      </span>
      <span className="numeric text-right text-xs text-muted-foreground">
        {formatter(previous)}
      </span>
      <span className="col-span-3 flex items-center justify-end gap-1 text-[10px]">
        {positive ? (
          <ArrowUpRight className="size-3 text-emerald-500" />
        ) : (
          <ArrowDownRight className="size-3 text-rose-500" />
        )}
        <span className={positive ? "text-emerald-500" : "text-rose-500"}>
          {positive ? "+" : "−"}
          {formatter(Math.abs(difference))}
        </span>
        <span className="text-muted-foreground">({formatPercent(change)})</span>
      </span>
    </div>
  );
}

function ChartEmpty({
  label = "Sem dados para exibir com os filtros selecionados.",
}: {
  label?: string;
}) {
  return (
    <div className="flex h-[245px] flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground">
      <BarChart3 className="size-5 opacity-50" />
      <span>{label}</span>
    </div>
  );
}
