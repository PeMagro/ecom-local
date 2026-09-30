import { usePresentation } from "@/hooks/usePresentation";
import { CHANNEL_LABEL as MARKETPLACE_LABEL } from "@/lib/presentation-channels";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/StateBlocks";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getOrder } from "@/lib/orders.functions";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/marketplaces";

export const Route = createFileRoute("/_authenticated/pedidos/$orderId")({
  head: () => ({
    meta: [
      { title: "Detalhes do pedido | ECOM" },
      {
        name: "description",
        content: "Itens, valores, comprador e histórico de um pedido sincronizado.",
      },
      { property: "og:title", content: "Detalhes do pedido | ECOM" },
      {
        property: "og:description",
        content: "Itens, valores, comprador e histórico de um pedido sincronizado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = useParams({ from: "/_authenticated/pedidos/$orderId" });

  const { orders: localOrders, ready } = usePresentation();
  const isLocal = orderId.startsWith("ECOM-");
  const query = useQuery({
    enabled: !isLocal,
    queryKey: ["order", orderId],
    queryFn: () => getOrder({ data: { id: orderId } }),
  });

  const order = isLocal ? localOrders.find((o) => o.id === orderId) : query.data;

  return (
    <PageShell
      title="Detalhes do pedido"
      description={order ? MARKETPLACE_LABEL[order.marketplace] : undefined}
      actions={
        <>
          <Button asChild size="sm" variant="outline">
            <Link to="/documentos" search={{ orderId }}>
              <Printer className="size-3.5" />
              Gerar documento
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/pedidos">
              <ArrowLeft className="size-3.5" />
              Voltar
            </Link>
          </Button>
        </>
      }
    >
      {!ready || (!isLocal && query.isLoading) ? (
        <LoadingState />
      ) : !isLocal && query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : !order ? (
        <EmptyState
          title="Pedido não encontrado"
          description="Este pedido pode ter sido removido ou ainda não foi sincronizado."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <section className="glass-panel rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="numeric text-sm">{order.external_order_id}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDateTime(order.placed_at)}
                  </p>
                </div>
                <Badge variant="secondary">{ORDER_STATUS_LABEL[order.status]}</Badge>
              </div>
            </section>

            <section className="glass-panel rounded-lg p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Itens
              </h2>
              {order.order_items.length === 0 ? (
                <EmptyState compact title="Sem itens sincronizados" />
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-left text-[11px] uppercase text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Produto</th>
                      <th className="pb-2 font-medium">SKU</th>
                      <th className="pb-2 text-right font-medium">Qtd.</th>
                      <th className="pb-2 text-right font-medium">Unitário</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.order_items.map((item) => (
                      <tr key={item.id} className="border-t border-border/60">
                        <td className="py-2">{item.title}</td>
                        <td className="numeric py-2">{item.sku ?? "—"}</td>
                        <td className="numeric py-2 text-right">{item.quantity}</td>
                        <td className="numeric py-2 text-right">
                          {formatCurrency(Number(item.unit_price))}
                        </td>
                        <td className="numeric py-2 text-right">
                          {formatCurrency(Number(item.total_price))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="glass-panel rounded-lg p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Histórico
              </h2>
              {Array.isArray(order.history) && order.history.length > 0 ? (
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {(order.history as { at?: string; label?: string }[]).map((entry, index) => (
                    <li key={index} className="flex justify-between">
                      <span>{entry.label ?? "Atualização"}</span>
                      <span className="numeric">{formatDateTime(entry.at ?? null)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="Sem histórico registrado" />
              )}
            </section>
          </div>

          <div className="space-y-4">
            <section className="glass-panel rounded-lg p-4 text-xs">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Comprador
              </h2>
              <Line label="Nome" value={order.buyer_name} />
              <Line label="E-mail" value={order.buyer_email} />
              <Line label="Documento" value={order.buyer_document} />
            </section>

            <section className="glass-panel rounded-lg p-4 text-xs">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Valores
              </h2>
              <Line label="Total" value={formatCurrency(Number(order.total_amount))} />
              <Line label="Frete" value={formatCurrency(Number(order.shipping_amount))} />
              <Line label="Taxas" value={formatCurrency(Number(order.fees_amount))} />
            </section>

            <section className="glass-panel rounded-lg p-4 text-xs">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Entrega
              </h2>
              {order.shipping_address ? (
                <pre className="numeric whitespace-pre-wrap text-[11px] text-muted-foreground">
                  {JSON.stringify(order.shipping_address, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">
                  Endereço não disponibilizado por esta integração.
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function Line({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span>{value ?? "—"}</span>
    </div>
  );
}
