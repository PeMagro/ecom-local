import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Megaphone, Package, Receipt, ShoppingCart } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/StateBlocks";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePresentation } from "@/hooks/usePresentation";
import { getOverview } from "@/lib/dashboard.functions";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { CONNECTION_STATUS_LABEL, ORDER_STATUS_LABEL } from "@/lib/marketplaces";
import { CHANNELS, CHANNEL_LABEL } from "@/lib/presentation-channels";

export const Route = createFileRoute("/_authenticated/visao-geral")({
  head: () => ({
    meta: [
      { title: "Visão geral | ECOM" },
      {
        name: "description",
        content:
          "Acompanhe vendas, produtos, anúncios, estoque e pedidos dos seus marketplaces em um só lugar.",
      },
      { property: "og:title", content: "Visão geral | ECOM" },
      {
        property: "og:description",
        content:
          "Acompanhe vendas, produtos, anúncios, estoque e pedidos dos seus marketplaces em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { user } = useAuth();
  const presentation = usePresentation();
  const userId = user?.id;
  const query = useQuery({
    queryKey: ["overview", userId],
    enabled: Boolean(userId),
    queryFn: () => getOverview(),
  });

  if (query.isLoading || !presentation.ready) {
    return (
      <PageShell title="Visão geral" description="Dados do catálogo e canais conectados">
        <LoadingState />
      </PageShell>
    );
  }

  if (query.isError) {
    return (
      <PageShell title="Visão geral">
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      </PageShell>
    );
  }

  const data = query.data!;
  const importedProducts = presentation.listings
    .filter((listing) => listing.origin === "imported")
    .filter((listing) => {
      const normalizedName = (listing.productName ?? listing.title).trim().toLowerCase();
      return !data.products.some((product) => product.name.trim().toLowerCase() === normalizedName);
    });
  const productCount = data.productCount + importedProducts.length;
  const products = [
    ...data.products.map((product) => ({ ...product, marketplace: undefined })),
    ...importedProducts.map((listing) => ({
      id: listing.id,
      name: listing.productName ?? listing.title,
      sku: null,
      category: listing.categoryName,
      brand: null,
      price: listing.price,
      marketplace: listing.marketplace,
    })),
  ];
  const existingSales = new Set(
    data.sales.map(
      (sale) => `${sale.marketplace}:${sale.external_order_id ?? sale.order_id ?? ""}`,
    ),
  );
  const presentationSales = presentation.orders
    .filter((order) => order.status === "paid" || order.status === "shipped")
    .filter((order) => !existingSales.has(`${order.marketplace}:${order.external_order_id}`))
    .map((order) => ({
      gross_amount: order.total_amount,
      marketplace: order.marketplace,
      sold_at: order.placed_at,
      external_order_id: order.external_order_id,
    }));
  const sales = [...data.sales, ...presentationSales];
  const listings = [...data.listings, ...presentation.listings];
  const orders = [...data.orders, ...presentation.orders]
    .sort((a, b) => new Date(b.placed_at ?? 0).getTime() - new Date(a.placed_at ?? 0).getTime())
    .slice(0, 6);
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.gross_amount ?? 0), 0);
  const activeListings = listings.filter((item) => item.status === "active").length;
  const pausedListings = listings.filter((item) => item.status === "paused").length;
  const totalUnits = data.balances.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const lowStock = data.balances.filter(
    (item) => (item.quantity ?? 0) <= (item.low_stock_threshold ?? 0),
  ).length;

  return (
    <PageShell
      title="Visão geral"
      description="Dados do catálogo e dos canais conectados neste navegador"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <MetricCard
          icon={Receipt}
          label="Vendas sincronizadas"
          value={sales.length ? formatCurrency(revenue) : "—"}
          hint={
            sales.length
              ? `${formatNumber(sales.length)} vendas registradas`
              : "Nenhuma venda sincronizada"
          }
        />
        <MetricCard
          icon={Package}
          label="Produtos cadastrados"
          value={formatNumber(productCount)}
          hint={productCount ? "Catálogo e anúncios importados" : "Cadastre seu primeiro produto"}
        />
        <MetricCard
          icon={Megaphone}
          label="Anúncios"
          value={listings.length ? `${activeListings} ativos · ${pausedListings} pausados` : "0"}
          hint={
            listings.length
              ? `${formatNumber(listings.length)} anúncios no total`
              : "Nenhum anúncio criado"
          }
        />
        <MetricCard
          icon={Boxes}
          label="Estoque central"
          value={data.balances.length ? `${formatNumber(totalUnits)} un.` : "—"}
          hint={
            data.balances.length ? `${lowStock} itens em estoque baixo` : "Nenhum saldo registrado"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Pedidos recentes"
          action={
            <Button asChild size="sm" variant="ghost">
              <Link to="/pedidos">Ver todos</Link>
            </Button>
          }
        >
          {orders.length === 0 ? (
            <EmptyState
              compact
              icon={ShoppingCart}
              title="Nenhum pedido sincronizado"
              description="Os pedidos aparecem aqui assim que um marketplace estiver conectado."
              action={
                <Button asChild size="sm">
                  <Link to="/integracoes">Conectar marketplace</Link>
                </Button>
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Pedido</th>
                  <th className="pb-2 font-medium">Canal</th>
                  <th className="pb-2 font-medium">Comprador</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={`${order.marketplace}:${order.id}`}
                    className="border-t border-border/70"
                  >
                    <td className="numeric py-3">{order.external_order_id}</td>
                    <td className="py-3">{CHANNEL_LABEL[order.marketplace]}</td>
                    <td className="py-2">{order.buyer_name ?? "—"}</td>
                    <td className="py-2">
                      <Badge variant="default">
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </Badge>
                    </td>
                    <td className="numeric py-3 text-right">
                      {formatCurrency(Number(order.total_amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Alertas e pendências">
          {data.alerts.length === 0 ? (
            <EmptyState
              compact
              icon={AlertTriangle}
              title="Sem pendências"
              description="Alertas de estoque baixo e erros de sincronização aparecem aqui."
            />
          ) : (
            <ul className="space-y-3">
              {data.alerts.map((alert) => (
                <li key={alert.id} className="border-b border-border/60 pb-3 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium">{alert.title}</p>
                    <Badge
                      variant={alert.severity === "critical" ? "destructive" : "secondary"}
                      className="shrink-0"
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  {alert.description ? (
                    <p className="mt-2 text-xs text-muted-foreground">{alert.description}</p>
                  ) : null}
                  <p className="numeric mt-1 text-[10px] text-muted-foreground">
                    {formatDateTime(alert.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Produtos cadastrados"
        action={
          <Button asChild size="sm" variant="ghost">
            <Link to="/produtos">Ver todos</Link>
          </Button>
        }
      >
        {products.length === 0 ? (
          <EmptyState
            compact
            icon={Package}
            title="Nenhum produto cadastrado"
            description="Cadastre produtos para acompanhar o catálogo central nesta tela."
            action={
              <Button asChild size="sm">
                <Link to="/produtos/novo">Cadastrar produto</Link>
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border/70">
            {products.slice(0, 6).map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {[
                      product.brand,
                      product.category,
                      product.sku,
                      product.marketplace ? CHANNEL_LABEL[product.marketplace] : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sem marca, categoria ou SKU"}
                  </p>
                </div>
                <span className="numeric shrink-0 text-sm">
                  {formatCurrency(Number(product.price ?? 0))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Resumo por marketplace"
        action={
          <Button asChild size="sm" variant="ghost">
            <Link to="/integracoes">Gerenciar integrações</Link>
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CHANNELS.map((marketplace) => {
            const localConnection = presentation.channels.find(
              (item) => item.marketplace === marketplace.id,
            );
            const connection = localConnection
              ? {
                  status: "connected",
                  last_sync_at: localConnection.connectedAt,
                }
              : undefined;
            const channelSales = sales.filter((sale) => sale.marketplace === marketplace.id);
            const channelRevenue = channelSales.reduce(
              (sum, sale) => sum + Number(sale.gross_amount ?? 0),
              0,
            );
            const channelListings = listings.filter(
              (item) => item.marketplace === marketplace.id,
            ).length;
            return (
              <div key={marketplace.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{marketplace.label}</p>
                  <Badge variant={connection?.status === "connected" ? "default" : "secondary"}>
                    {CONNECTION_STATUS_LABEL[connection?.status ?? "disconnected"]}
                  </Badge>
                </div>
                <p className="numeric mt-4 text-2xl font-semibold tracking-tight">
                  {channelSales.length ? formatCurrency(channelRevenue) : "—"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {channelListings} anúncios · última sincronização{" "}
                  {connection?.last_sync_at ? formatDateTime(connection.last_sync_at) : "—"}
                </p>
              </div>
            );
          })}
        </div>
      </Panel>
    </PageShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="numeric mt-4 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`glass-panel rounded-xl p-5 ${className ?? ""}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
