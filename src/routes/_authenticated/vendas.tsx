import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { usePresentation } from "@/hooks/usePresentation";
import { CHANNELS, CHANNEL_LABEL, type PresentationChannel } from "@/lib/presentation-channels";
import { Receipt } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/StateBlocks";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listSales } from "@/lib/sales.functions";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/marketplaces";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas | ECOM" },
      {
        name: "description",
        content: "Todas as vendas sincronizadas dos seus marketplaces em uma lista objetiva.",
      },
      { property: "og:title", content: "Vendas | ECOM" },
      {
        property: "og:description",
        content: "Todas as vendas sincronizadas dos seus marketplaces em uma lista objetiva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  const { orders: connectedOrders, ready } = usePresentation();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["sales"],
    queryFn: () => listSales(),
  });

  const existingOrders = new Set(
    (query.data ?? []).map(
      (sale) => `${sale.marketplace}:${sale.external_order_id ?? sale.order_id ?? sale.id}`,
    ),
  );
  const presentationSales = connectedOrders
    .filter((order) => order.status === "paid" || order.status === "shipped")
    .filter((order) => !existingOrders.has(`${order.marketplace}:${order.external_order_id}`))
    .map((order) => ({
      id: order.id,
      order_id: order.id,
      external_order_id: order.external_order_id,
      product_title: order.order_items.map((item) => item.title).join(", "),
      marketplace: order.marketplace as NonNullable<typeof query.data>[number]["marketplace"],
      sold_at: order.placed_at,
      buyer_name: order.buyer_name,
      gross_amount: order.total_amount,
      fees_amount: order.fees_amount,
      net_amount: order.total_amount - order.fees_amount,
      quantity: order.order_items.reduce((sum, item) => sum + item.quantity, 0),
      status: order.status,
      orders: {
        buyer_email: order.buyer_email,
        buyer_document: order.buyer_document,
        shipping_address: order.shipping_address,
        history: order.history,
        order_items: order.order_items.map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          total_price: item.total_price,
        })),
      },
    })) as unknown as NonNullable<typeof query.data>;
  const allSales = [...(query.data ?? []), ...presentationSales];
  const sales = allSales.filter((sale) => {
    const matchesChannel = channel === "all" || sale.marketplace === channel;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      [sale.external_order_id, sale.buyer_name, sale.product_title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    return matchesChannel && matchesSearch;
  });

  const openSale = sales.find((sale) => sale.id === openSaleId) ?? null;

  return (
    <PageShell
      title="Vendas"
      description="Vendas sincronizadas dos marketplaces conectados"
      searchPlaceholder="Pedido, comprador ou produto"
      searchValue={search}
      onSearchChange={setSearch}
      actions={
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Marketplace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            {CHANNELS.map((marketplace) => (
              <SelectItem key={marketplace.id} value={marketplace.id}>
                {marketplace.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {query.isLoading && !ready ? (
        <LoadingState />
      ) : query.isError && presentationSales.length === 0 ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : sales.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma venda sincronizada"
          description="As vendas são importadas automaticamente dos marketplaces conectados. Não é possível lançar vendas manualmente."
          action={
            <Button asChild size="sm">
              <Link to="/integracoes">Conectar marketplace</Link>
            </Button>
          }
        />
      ) : (
        <div className="glass-panel overflow-hidden rounded-lg">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Pedido</th>
                <th className="px-4 py-2.5 font-medium">Produto</th>
                <th className="px-4 py-2.5 font-medium">Comprador</th>
                <th className="px-4 py-2.5 font-medium">Marketplace</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-border/60 last:border-0">
                  <td className="numeric px-4 py-2.5">{formatDateTime(sale.sold_at)}</td>
                  <td className="numeric px-4 py-2.5">{sale.external_order_id ?? "—"}</td>
                  <td className="px-4 py-2.5">{sale.product_title ?? "—"}</td>
                  <td className="px-4 py-2.5">{sale.buyer_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {CHANNEL_LABEL[sale.marketplace as PresentationChannel]}
                  </td>
                  <td className="numeric px-4 py-2.5 text-right">
                    {formatCurrency(Number(sale.gross_amount))}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="default">{ORDER_STATUS_LABEL[sale.status]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setOpenSaleId(sale.id)}>
                      Abrir venda
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={Boolean(openSale)} onOpenChange={(open) => !open && setOpenSaleId(null)}>
        <SheetContent className="w-[480px] overflow-y-auto sm:max-w-[480px]">
          {openSale ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">
                  Venda {openSale.external_order_id ?? openSale.id.slice(0, 8)}
                </SheetTitle>
                <SheetDescription>
                  {CHANNEL_LABEL[openSale.marketplace as PresentationChannel]} ·{" "}
                  {formatDateTime(openSale.sold_at)}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-6 text-xs">
                <DetailBlock title="Comprador">
                  <Row label="Nome" value={openSale.buyer_name ?? "Não informado pelo canal"} />
                  <Row
                    label="E-mail"
                    value={openSale.orders?.buyer_email ?? "Não informado pelo canal"}
                  />
                  <Row
                    label="Documento"
                    value={openSale.orders?.buyer_document ?? "Não informado pelo canal"}
                  />
                </DetailBlock>

                <DetailBlock title="Itens">
                  {openSale.orders?.order_items?.length ? (
                    openSale.orders.order_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0"
                      >
                        <span>
                          {item.title}
                          <span className="numeric ml-2 text-muted-foreground">
                            ×{item.quantity}
                          </span>
                        </span>
                        <span className="numeric">{formatCurrency(Number(item.total_price))}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">
                      {openSale.product_title ?? "Itens não disponíveis nesta integração."}
                    </p>
                  )}
                </DetailBlock>

                <DetailBlock title="Valores">
                  <Row label="Bruto" value={formatCurrency(Number(openSale.gross_amount))} />
                  <Row label="Taxas" value={formatCurrency(Number(openSale.fees_amount))} />
                  <Row
                    label="Líquido"
                    value={
                      openSale.net_amount !== null
                        ? formatCurrency(Number(openSale.net_amount))
                        : "—"
                    }
                  />
                </DetailBlock>

                <DetailBlock title="Endereço de entrega">
                  {openSale.orders?.shipping_address ? (
                    <pre className="numeric whitespace-pre-wrap text-[11px] text-muted-foreground">
                      {JSON.stringify(openSale.orders.shipping_address, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground">
                      Endereço não disponibilizado por esta integração.
                    </p>
                  )}
                </DetailBlock>

                <DetailBlock title="Histórico do pedido">
                  {Array.isArray(openSale.orders?.history) && openSale.orders.history.length > 0 ? (
                    <ul className="space-y-1.5 text-muted-foreground">
                      {(
                        openSale.orders.history as {
                          at?: string;
                          label?: string;
                        }[]
                      ).map((entry, index) => (
                        <li key={index} className="flex justify-between gap-3">
                          <span>{entry.label ?? "Atualização"}</span>
                          <span className="numeric">{formatDateTime(entry.at ?? null)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Sem histórico registrado.</p>
                  )}
                </DetailBlock>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="rounded-md border border-border p-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
