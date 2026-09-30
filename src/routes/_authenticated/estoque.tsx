import { createFileRoute, Link } from "@tanstack/react-router";
import { parsePositiveInt } from "@/lib/numbers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Boxes, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/StateBlocks";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adjustInventory,
  listInventoryBalances,
  listInventoryMovements,
} from "@/lib/inventory.functions";
import { usePresentation } from "@/hooks/usePresentation";
import { CHANNEL_LABEL } from "@/lib/presentation-channels";
import { formatDateTime, formatNumber } from "@/lib/format";
import { MARKETPLACE_LABEL, MOVEMENT_TYPE_LABEL } from "@/lib/marketplaces";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque | ECOM" },
      {
        name: "description",
        content: "Estoque central por produto e variação, com movimentações e alertas.",
      },
      { property: "og:title", content: "Estoque | ECOM" },
      {
        property: "og:description",
        content: "Estoque central por produto e variação, com movimentações e alertas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InventoryPage,
});

type AdjustTarget = {
  productId: string;
  variantId: string | null;
  label: string;
};

function InventoryPage() {
  const queryClient = useQueryClient();
  const presentation = usePresentation();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<AdjustTarget | null>(null);
  const [type, setType] = useState("entry");
  const [quantity, setQuantity] = useState("");
  const [qtyError, setQtyError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const movementLock = useRef(false);

  const balances = useQuery({
    queryKey: ["inventory", "balances"],
    queryFn: () => listInventoryBalances(),
  });

  const movements = useQuery({
    queryKey: ["inventory", "movements"],
    queryFn: () => listInventoryMovements(),
  });

  const rows = (balances.data ?? []).filter((row) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [row.products?.name, row.products?.sku, row.product_variants?.name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const lowStock = rows.filter((row) => row.quantity <= (row.low_stock_threshold ?? 5));
  const marketplaceRows = presentation.listings
    .map((listing) => ({
      id: listing.id,
      title: listing.productName ?? listing.title,
      marketplace: listing.marketplace,
      stock: listing.stock,
      status: listing.status,
      updatedAt: listing.updatedAt,
    }))
    .filter((listing) => {
      const term = search.trim().toLowerCase();
      return (
        !term ||
        [listing.title, CHANNEL_LABEL[listing.marketplace]]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    });
  const marketplaceUnits = marketplaceRows.reduce((sum, listing) => sum + listing.stock, 0);

  async function applyMovement() {
    if (!target || movementLock.current) return;
    const value = parsePositiveInt(quantity);
    if (value === null) {
      setQtyError("Informe um número inteiro maior que zero.");
      return;
    }
    setQtyError(null);
    movementLock.current = true;
    setSaving(true);
    try {
      await adjustInventory({
        data: {
          productId: target.productId,
          variantId: target.variantId,
          type: type as "entry" | "out" | "adjustment" | "return",
          quantity: value,
          reason: reason.trim() || null,
        },
      });
      toast.success("Movimentação registrada.");
      setTarget(null);
      setQuantity("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
    } catch (error) {
      toast.error("Não foi possível registrar", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSaving(false);
      movementLock.current = false;
    }
  }

  return (
    <PageShell
      title="Estoque"
      description="Consulte o saldo central e os estoques publicados em cada marketplace"
      searchPlaceholder="Produto ou SKU"
      searchValue={search}
      onSearchChange={setSearch}
    >
      {balances.isLoading ? (
        <LoadingState />
      ) : balances.isError && marketplaceRows.length === 0 ? (
        <ErrorState
          message={(balances.error as Error).message}
          onRetry={() => balances.refetch()}
        />
      ) : rows.length === 0 && marketplaceRows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Nenhum saldo de estoque"
          description="Cadastre produtos e registre a entrada inicial para começar a controlar o estoque central."
          action={
            <Button asChild size="sm">
              <Link to="/produtos/novo">Cadastrar produto</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {lowStock.length > 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
              <TriangleAlert className="mt-0.5 size-4 text-warning" />
              <div className="text-xs">
                <p className="font-medium text-foreground">
                  {lowStock.length} item(ns) com estoque baixo
                </p>
                <p className="text-muted-foreground">
                  Reponha o estoque para evitar rupturas nos canais conectados.
                </p>
              </div>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="glass-panel overflow-hidden rounded-lg">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Produto</th>
                    <th className="px-4 py-2.5 font-medium">Variação</th>
                    <th className="px-4 py-2.5 text-right font-medium">Disponível</th>
                    <th className="px-4 py-2.5 text-right font-medium">Reservado</th>
                    <th className="px-4 py-2.5 font-medium">Situação</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const low = row.quantity <= (row.low_stock_threshold ?? 5);
                    return (
                      <tr key={row.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2.5 font-medium">{row.products?.name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {row.product_variants?.name ?? "Principal"}
                        </td>
                        <td className="numeric px-4 py-2.5 text-right">
                          {formatNumber(row.quantity)}
                        </td>
                        <td className="numeric px-4 py-2.5 text-right text-muted-foreground">
                          {formatNumber(row.reserved ?? 0)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={low ? "destructive" : "default"}>
                            {low ? "Estoque baixo" : "Normal"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setTarget({
                                productId: row.product_id,
                                variantId: row.variant_id,
                                label: `${row.products?.name ?? ""} ${
                                  row.product_variants?.name ?? ""
                                }`.trim(),
                              });
                              setType("entry");
                            }}
                          >
                            Movimentar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              compact
              icon={Boxes}
              title="Sem saldo no estoque central"
              description="Os saldos dos anúncios conectados aparecem na tabela abaixo."
            />
          )}

          <section className="glass-panel rounded-lg p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Estoque nos marketplaces
                </h2>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Quantidades exibidas por anúncio e canal conectado.
                </p>
              </div>
              <Badge variant="outline">{formatNumber(marketplaceUnits)} un.</Badge>
            </div>
            {marketplaceRows.length === 0 ? (
              <EmptyState
                compact
                title="Nenhum estoque de marketplace"
                description="Conecte um canal para visualizar os estoques dos anúncios."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Produto</th>
                      <th className="px-4 py-2.5 font-medium">Marketplace</th>
                      <th className="px-4 py-2.5 font-medium">Situação</th>
                      <th className="px-4 py-2.5 text-right font-medium">Estoque</th>
                      <th className="px-4 py-2.5 text-right font-medium">Atualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketplaceRows.map((listing) => {
                      const low = listing.stock <= 5;
                      return (
                        <tr
                          key={`${listing.marketplace}:${listing.id}`}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="px-4 py-2.5 font-medium">{listing.title}</td>
                          <td className="px-4 py-2.5">{CHANNEL_LABEL[listing.marketplace]}</td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant={
                                low
                                  ? "destructive"
                                  : listing.status === "active"
                                    ? "default"
                                    : "secondary"
                              }
                            >
                              {low
                                ? "Estoque baixo"
                                : listing.status === "active"
                                  ? "Normal"
                                  : "Anúncio pausado"}
                            </Badge>
                          </td>
                          <td className="numeric px-4 py-2.5 text-right">
                            {formatNumber(listing.stock)}
                          </td>
                          <td className="numeric px-4 py-2.5 text-right text-muted-foreground">
                            {formatDateTime(listing.updatedAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="glass-panel rounded-lg p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Movimentações recentes
            </h2>
            {movements.isLoading ? (
              <LoadingState />
            ) : (movements.data ?? []).length === 0 ? (
              <EmptyState
                compact
                title="Sem movimentações"
                description="Entradas, vendas e ajustes aparecem aqui."
              />
            ) : (
              <ul className="divide-y divide-border text-xs">
                {(movements.data ?? []).map((movement) => (
                  <li key={movement.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">{movement.products?.name ?? "Produto"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {movement.type === "adjustment" &&
                        movement.reason?.startsWith("Saída manual:")
                          ? "Saída"
                          : MOVEMENT_TYPE_LABEL[movement.type]}
                        {movement.marketplace
                          ? ` · ${MARKETPLACE_LABEL[movement.marketplace]}`
                          : ""}
                        {movement.reason ? ` · ${movement.reason}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="numeric font-medium">
                        {movement.quantity > 0 ? "+" : ""}
                        {formatNumber(movement.quantity)}
                      </p>
                      <p className="numeric text-[11px] text-muted-foreground">
                        {formatDateTime(movement.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentar estoque</DialogTitle>
            <DialogDescription>{target?.label}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entrada</SelectItem>
                  <SelectItem value="out">Saída</SelectItem>
                  <SelectItem value="adjustment">Ajuste</SelectItem>
                  <SelectItem value="return">Devolução</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quantidade</Label>
              <Input
                value={quantity}
                inputMode="numeric"
                aria-invalid={qtyError ? true : undefined}
                onChange={(event) => setQuantity(event.target.value)}
              />
              {qtyError ? (
                <p className="text-[11px] text-destructive" role="alert">
                  {qtyError}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Motivo</Label>
              <Input value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={applyMovement} disabled={saving}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
