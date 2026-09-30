import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { usePresentation } from "@/hooks/usePresentation";
import { CHANNEL_LABEL } from "@/lib/presentation-channels";
import { MoreHorizontal, Package, Plus } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/StateBlocks";
import { PageShell } from "@/components/layout/PageShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteProduct, duplicateProduct, listProducts } from "@/lib/products.functions";
import { formatCurrency, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/produtos/")({
  head: () => ({
    meta: [
      { title: "Produtos | ECOM" },
      {
        name: "description",
        content: "Catálogo central de produtos com SKU, variações, fotos e estoque.",
      },
      { property: "og:title", content: "Produtos | ECOM" },
      {
        property: "og:description",
        content: "Catálogo central de produtos com SKU, variações, fotos e estoque.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { listings: connectedListings } = usePresentation();

  const query = useQuery({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProduct({ data: { id } }),
    onSuccess: () => {
      toast.success("Produto excluído.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: Error) =>
      toast.error("Não foi possível excluir", { description: error.message }),
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => (await duplicateProduct({ data: { id } })).id,
    onSuccess: (id) => {
      toast.success("Produto duplicado.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/produtos/$productId", params: { productId: id } });
    },
    onError: (error: Error) =>
      toast.error("Não foi possível duplicar", { description: error.message }),
  });

  const products = (query.data ?? []).filter((product) => {
    const term = search.trim().toLowerCase();
    return (
      (status === "all" || product.status === status) &&
      (!term ||
        [product.name, product.sku, product.barcode, product.brand]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)))
    );
  });

  const productNames = new Set(
    (query.data ?? []).map((product) => product.name.trim().toLowerCase()),
  );
  const importedProducts = connectedListings
    .filter((listing) => listing.origin === "imported")
    .filter(
      (listing) => !productNames.has((listing.productName ?? listing.title).trim().toLowerCase()),
    )
    .filter(
      (listing) =>
        status === "all" ||
        (status === "active" ? listing.status === "active" : listing.status !== "active"),
    )
    .filter((listing) => {
      const term = search.trim().toLowerCase();
      return (
        !term ||
        [listing.productName, listing.title, CHANNEL_LABEL[listing.marketplace]]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    });

  return (
    <PageShell
      title="Produtos"
      description="Catálogo central que alimenta os anúncios de todos os canais"
      searchPlaceholder="Nome, SKU, código de barras"
      searchValue={search}
      onSearchChange={setSearch}
      actions={
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="archived">Arquivados</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild size="sm">
            <Link to="/produtos/novo">
              <Plus className="size-3.5" />
              Novo produto
            </Link>
          </Button>
        </div>
      }
    >
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : products.length + importedProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto cadastrado"
          description="Cadastre o produto uma vez e gere anúncios para Mercado Livre, Shopee e Amazon."
          action={
            <Button asChild size="sm">
              <Link to="/produtos/novo">Cadastrar produto</Link>
            </Button>
          }
        />
      ) : (
        <div className="glass-panel overflow-hidden rounded-lg">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Produto</th>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Marca</th>
                <th className="px-4 py-2.5 text-right font-medium">Preço</th>
                <th className="px-4 py-2.5 text-right font-medium">Estoque</th>
                <th className="px-4 py-2.5 text-right font-medium">Anúncios</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const stock = (product.inventory_balances ?? []).reduce(
                  (sum, balance) => sum + (balance.quantity ?? 0),
                  0,
                );
                return (
                  <tr key={product.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5">
                      <Link
                        to="/produtos/$productId"
                        params={{ productId: product.id }}
                        className="font-medium hover:text-primary"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="numeric px-4 py-2.5">{product.sku ?? "—"}</td>
                    <td className="px-4 py-2.5">{product.brand ?? "—"}</td>
                    <td className="numeric px-4 py-2.5 text-right">
                      {product.price !== null ? formatCurrency(Number(product.price)) : "—"}
                    </td>
                    <td className="numeric px-4 py-2.5 text-right">{formatNumber(stock)}</td>
                    <td className="numeric px-4 py-2.5 text-right">
                      {(product.marketplace_listings ?? []).length}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={product.status === "active" ? "default" : "secondary"}>
                        {product.status === "active"
                          ? "Ativo"
                          : product.status === "inactive"
                            ? "Inativo"
                            : "Arquivado"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="outline"
                            className="size-7 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                            aria-label={`Ações para ${product.name}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            className="text-primary focus:bg-primary/10 focus:text-primary"
                            onSelect={() =>
                              navigate({
                                to: "/produtos/$productId",
                                params: { productId: product.id },
                              })
                            }
                          >
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="focus:bg-primary/10 focus:text-primary"
                            onSelect={() => duplicate.mutate(product.id)}
                          >
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setDeleteId(product.id)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}

              {importedProducts.map((listing) => (
                <tr
                  key={`imported:${listing.marketplace}:${listing.id}`}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{listing.productName ?? listing.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Anúncio importado · {CHANNEL_LABEL[listing.marketplace]}
                    </div>
                  </td>
                  <td className="numeric px-4 py-2.5">—</td>
                  <td className="px-4 py-2.5">—</td>
                  <td className="numeric px-4 py-2.5 text-right">
                    {formatCurrency(listing.price)}
                  </td>
                  <td className="numeric px-4 py-2.5 text-right">{formatNumber(listing.stock)}</td>
                  <td className="numeric px-4 py-2.5 text-right">1</td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={listing.status === "active" ? "default" : "secondary"}
                      className={
                        listing.status === "paused"
                          ? "border-warning/30 bg-warning/10 text-warning"
                          : ""
                      }
                    >
                      {listing.status === "active" ? "Ativo" : "Pausado"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o produto, suas variações, fotos, saldos de estoque e anúncios
              vinculados. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) remove.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
