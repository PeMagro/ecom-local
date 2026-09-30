import { usePresentation } from "@/hooks/usePresentation";
import {
  CHANNELS as MARKETPLACES,
  CHANNEL_LABEL as MARKETPLACE_LABEL,
} from "@/lib/presentation-channels";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShoppingCart } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/StateBlocks";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listOrders } from "@/lib/orders.functions";
import { useAnyMarketplaceConnected } from "@/hooks/useMarketplaceConnected";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/marketplaces";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({
    meta: [
      { title: "Pedidos | ECOM" },
      {
        name: "description",
        content: "Pedidos importados automaticamente das integrações dos marketplaces.",
      },
      { property: "og:title", content: "Pedidos | ECOM" },
      {
        property: "og:description",
        content: "Pedidos importados automaticamente das integrações dos marketplaces.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { orders: localOrders, ready } = usePresentation();
  const { connected: marketplaceConnected } = useAnyMarketplaceConnected();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");

  const query = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders(),
  });

  const orders = [...localOrders, ...(query.data ?? [])].filter((order) => {
    const term = search.trim().toLowerCase();
    return (
      (channel === "all" || order.marketplace === channel) &&
      (status === "all" ||
        (status === "ongoing"
          ? ["pending", "paid", "shipped"].includes(order.status)
          : order.status === status)) &&
      (!term ||
        [order.external_order_id, order.buyer_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)))
    );
  });

  return (
    <PageShell
      title="Pedidos"
      description="Acompanhe os pedidos e as entregas dos seus canais"
      searchPlaceholder="Número do pedido ou comprador"
      searchValue={search}
      onSearchChange={setSearch}
      actions={
        <div className="flex items-center gap-2">
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              {MARKETPLACES.map((marketplace) => (
                <SelectItem key={marketplace.id} value={marketplace.id}>
                  {marketplace.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="ongoing">Em andamento</SelectItem>
              {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {!ready || (query.isLoading && localOrders.length === 0) ? (
        <LoadingState />
      ) : query.isError && localOrders.length === 0 ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : orders.length === 0 ? (
        marketplaceConnected ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhum pedido sincronizado ainda"
            description="Sua conta está conectada. Sincronize em Integrações para trazer os pedidos recentes, ou aguarde a próxima venda."
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/integracoes">Ir para Integrações</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhum pedido encontrado"
            description="Os pedidos chegam automaticamente dos marketplaces conectados."
            action={
              <Button asChild size="sm">
                <Link to="/integracoes">Conectar marketplace</Link>
              </Button>
            }
          />
        )
      ) : (
        <div className="glass-panel overflow-hidden rounded-lg">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Pedido</th>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Comprador</th>
                <th className="px-4 py-2.5 font-medium">Marketplace</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border/60 last:border-0">
                  <td className="numeric px-4 py-2.5">{order.external_order_id}</td>
                  <td className="numeric px-4 py-2.5">{formatDateTime(order.placed_at)}</td>
                  <td className="px-4 py-2.5">{order.buyer_name ?? "—"}</td>
                  <td className="px-4 py-2.5">{MARKETPLACE_LABEL[order.marketplace]}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary">{ORDER_STATUS_LABEL[order.status]}</Badge>
                  </td>
                  <td className="numeric px-4 py-2.5 text-right">
                    {formatCurrency(Number(order.total_amount))}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/pedidos/$orderId" params={{ orderId: order.id }}>
                        Detalhes
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
