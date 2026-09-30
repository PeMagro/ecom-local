import { usePresentation } from "@/hooks/usePresentation";
import { CHANNEL_LABEL as MARKETPLACE_LABEL } from "@/lib/presentation-channels";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Printer } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/StateBlocks";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { getOrderForDocument, listOrdersForDocuments } from "@/lib/documents.functions";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/marketplaces";

const NOT_FISCAL =
  "Documento demonstrativo do pedido — NÃO É NOTA FISCAL e não tem validade fiscal.";

export const Route = createFileRoute("/_authenticated/documentos")({
  validateSearch: (search: Record<string, unknown>) => ({
    orderId: typeof search["orderId"] === "string" ? (search["orderId"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Documentos do pedido | ECOM" },
      {
        name: "description",
        content: "Resumo imprimível de pedidos sincronizados. Não é nota fiscal.",
      },
      { property: "og:title", content: "Documentos do pedido | ECOM" },
      {
        property: "og:description",
        content: "Resumo imprimível de pedidos sincronizados. Não é nota fiscal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

const ni = (v: unknown) =>
  v === null || v === undefined || v === "" ? "não informado" : String(v);

function DocumentsPage() {
  const { orderId } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders: localOrders, ready } = usePresentation();
  const isLocal = orderId?.startsWith("ECOM-") ?? false;

  const orders = useQuery({
    queryKey: ["doc-orders", user?.id],
    enabled: !!user,
    queryFn: () => listOrdersForDocuments(),
  });

  const order = useQuery({
    queryKey: ["doc-order", user?.id, orderId],
    enabled: !!user && !!orderId && !isLocal,
    queryFn: () => getOrderForDocument({ data: { id: orderId! } }),
  });

  const allOrders = [...localOrders, ...(orders.data ?? [])];
  const o = isLocal ? localOrders.find((o) => o.id === orderId) : order.data;
  const addr =
    o?.shipping_address && typeof o.shipping_address === "object"
      ? (o.shipping_address as Record<string, unknown>)
      : null;

  return (
    <PageShell
      title="Emissões fiscais"
      description="Selecione um pedido para gerar o documento sem validade fiscal"
      actions={
        o ? (
          <Button size="sm" onClick={() => window.print()} className="no-print">
            <Printer className="size-3.5" />
            Imprimir / salvar PDF
          </Button>
        ) : null
      }
    >
      <div className="no-print space-y-3">
        <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            A ECOM ainda não emite NF-e autorizada. Isso exigiria uma integração fiscal própria, que
            fica fora deste MVP. Esta página gera apenas um resumo do pedido para impressão ou PDF
            pelo navegador.
          </span>
        </p>
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="doc-order" className="text-xs text-muted-foreground">
            Pedido
          </Label>
          <Select
            value={orderId ?? ""}
            onValueChange={(v) => navigate({ to: "/documentos", search: { orderId: v } })}
          >
            <SelectTrigger id="doc-order">
              <SelectValue placeholder="Escolha um pedido" />
            </SelectTrigger>
            <SelectContent>
              {allOrders.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.external_order_id} · {MARKETPLACE_LABEL[row.marketplace]} ·{" "}
                  {formatDateTime(row.placed_at)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!ready || (orders.isLoading && localOrders.length === 0) ? (
        <LoadingState />
      ) : orders.isError && localOrders.length === 0 ? (
        <ErrorState message={(orders.error as Error).message} onRetry={() => orders.refetch()} />
      ) : allOrders.length === 0 ? (
        <EmptyState
          title="Nenhum pedido disponível"
          description="Conecte um marketplace para carregar os pedidos."
        />
      ) : !orderId ? (
        <EmptyState compact title="Escolha um pedido para ver o resumo" />
      ) : !isLocal && order.isLoading ? (
        <LoadingState />
      ) : !isLocal && order.isError ? (
        <ErrorState message={(order.error as Error).message} onRetry={() => order.refetch()} />
      ) : !o ? (
        <EmptyState compact title="Pedido não encontrado" />
      ) : (
        <article className="print-area mx-auto max-w-3xl rounded-lg border border-border bg-card p-6 text-sm text-card-foreground">
          <p
            role="note"
            className="mb-4 rounded border-2 border-destructive p-2 text-center text-xs font-bold uppercase text-destructive"
          >
            {NOT_FISCAL}
          </p>
          <h2 className="text-lg font-semibold">Documento do pedido — sem validade fiscal</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <DocLine label="Pedido no canal" value={ni(o.external_order_id)} />
            <DocLine label="Canal" value={MARKETPLACE_LABEL[o.marketplace]} />
            <DocLine
              label="Data"
              value={o.placed_at ? formatDateTime(o.placed_at) : "não informado"}
            />
            <DocLine label="Situação" value={ni(ORDER_STATUS_LABEL[o.status])} />
            <DocLine label="Comprador" value={ni(o.buyer_name)} />
            <DocLine label="E-mail" value={ni(o.buyer_email)} />
            <DocLine label="Documento do comprador" value={ni(o.buyer_document)} />
          </dl>

          <h3 className="mt-5 text-xs font-semibold uppercase">Endereço de entrega</h3>
          {addr ? (
            <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              {Object.entries(addr).map(([k, v]) => (
                <DocLine
                  key={k}
                  label={k}
                  value={typeof v === "object" ? ni(v ? JSON.stringify(v) : null) : ni(v)}
                />
              ))}
            </dl>
          ) : (
            <p className="text-xs">não informado</p>
          )}

          <h3 className="mt-5 text-xs font-semibold uppercase">Itens</h3>
          {o.order_items.length === 0 ? (
            <p className="text-xs">não informado</p>
          ) : (
            <table className="mt-1 w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-1">Produto</th>
                  <th className="py-1">SKU</th>
                  <th className="py-1 text-right">Qtd.</th>
                  <th className="py-1 text-right">Unitário</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {o.order_items.map((it) => (
                  <tr key={it.id} className="border-b border-border/60">
                    <td className="py-1">{it.title}</td>
                    <td className="py-1">{ni(it.sku)}</td>
                    <td className="py-1 text-right">{it.quantity}</td>
                    <td className="py-1 text-right">
                      {formatCurrency(Number(it.unit_price), o.currency)}
                    </td>
                    <td className="py-1 text-right">
                      {formatCurrency(Number(it.total_price), o.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <dl className="ml-auto mt-4 w-64 space-y-1 text-xs">
            <DocLine label="Frete" value={formatCurrency(Number(o.shipping_amount), o.currency)} />
            <DocLine
              label="Taxas do canal"
              value={formatCurrency(Number(o.fees_amount), o.currency)}
            />
            <DocLine
              label="Total do pedido"
              value={formatCurrency(Number(o.total_amount), o.currency)}
            />
          </dl>

          <p className="mt-6 border-t border-border pt-2 text-center text-[10px] font-semibold uppercase">
            {NOT_FISCAL}
          </p>
        </article>
      )}
    </PageShell>
  );
}

function DocLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
