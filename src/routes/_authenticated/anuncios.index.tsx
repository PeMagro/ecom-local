import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/layout/PageShell";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { DemoListingActions } from "@/components/listings/DemoListingActions";
import { useAuth } from "@/hooks/useAuth";
import { usePresentation } from "@/hooks/usePresentation";
import { deleteListing, listListings } from "@/lib/listings.functions";
import { CHANNELS, CHANNEL_LABEL } from "@/lib/presentation-channels";
import { LISTING_STATUS_LABEL } from "@/lib/marketplaces";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/anuncios/")({
  head: () => ({
    meta: [
      { title: "Anúncios | ECOM" },
      {
        name: "description",
        content: "Gerencie seus anúncios por marketplace.",
      },
    ],
  }),
  component: ListingsPage,
});
function ListingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { listings: local } = usePresentation();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["listings", user?.id],
    enabled: !!user,
    queryFn: () => listListings(),
  });
  const matches = (l: { title: string | null; marketplace: string }) =>
    (channel === "all" || l.marketplace === channel) &&
    (l.title ?? "").toLowerCase().includes(search.toLowerCase());
  const localRows = local.filter(matches);
  const savedRows = (query.data ?? []).filter(matches);
  async function removeSaved() {
    if (!user || !removing || busy) return;
    setBusy(true);
    try {
      await deleteListing({ data: { id: removing } });
      setRemoving(null);
      toast.success("Anúncio removido da ECOM.");
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    } catch (error) {
      toast.error("Não foi possível excluir", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageShell
      title="Anúncios"
      description="Gerencie os anúncios dos seus canais de venda"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Buscar anúncio"
      actions={
        <>
          <select
            aria-label="Filtrar marketplace"
            className="h-8 rounded border border-input bg-background px-2 text-xs"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="all">Todos os canais</option>
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <Button size="sm" asChild>
            <Link to="/anuncios/novo" search={{ productId: undefined }}>
              <Plus className="size-3.5" />
              Novo anúncio
            </Link>
          </Button>
        </>
      }
    >
      {query.isError ? (
        <p role="alert" className="text-xs text-destructive">
          Não foi possível carregar anúncios salvos.{" "}
          <button onClick={() => query.refetch()} className="underline">
            Tentar novamente
          </button>
        </p>
      ) : null}
      {localRows.length + savedRows.length === 0 ? (
        <EmptyState
          title={query.isLoading ? "Carregando anúncios…" : "Nenhum anúncio encontrado"}
          description="Conecte um canal ou cadastre seu primeiro anúncio."
        />
      ) : (
        <div className="glass-panel overflow-x-auto rounded-lg">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-secondary/40 text-left text-muted-foreground">
              <tr>
                {["Anúncio", "Canal", "Preço", "Estoque", "Status", "Ações"].map((t) => (
                  <th key={t} className="px-4 py-3">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {localRows.map((l) => (
                <tr key={`${l.marketplace}:${l.id}`} className="border-b border-border/60">
                  <td className="px-4 py-3">{l.title}</td>
                  <td className="px-4 py-3">{CHANNEL_LABEL[l.marketplace]}</td>
                  <td className="px-4 py-3">{formatCurrency(l.price)}</td>
                  <td className="px-4 py-3">{l.stock}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={l.status === "active" ? "default" : "secondary"}
                      className={
                        l.status === "paused" ? "border-warning/30 bg-warning/10 text-warning" : ""
                      }
                    >
                      {LISTING_STATUS_LABEL[l.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {user ? (
                      <DemoListingActions
                        userId={user.id}
                        listing={l}
                        channel={l.marketplace}
                        onChange={() => {}}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
              {savedRows.map((l) => (
                <tr key={l.id} className="border-b border-border/60">
                  <td className="px-4 py-3">{l.title}</td>
                  <td className="px-4 py-3">{CHANNEL_LABEL[l.marketplace]}</td>
                  <td className="px-4 py-3">{formatCurrency(Number(l.price))}</td>
                  <td className="px-4 py-3">{l.stock}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        l.status === "active" || l.status === "ready"
                          ? "default"
                          : l.status === "error"
                            ? "destructive"
                            : "secondary"
                      }
                      className={
                        l.status === "paused" ? "border-warning/30 bg-warning/10 text-warning" : ""
                      }
                    >
                      {LISTING_STATUS_LABEL[l.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(l.id)}>
                      <Trash2 className="size-3.5" />
                      Excluir da ECOM
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !busy && !open && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anúncio da ECOM?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro será removido da ECOM. Esta ação não encerra uma publicação existente no
              marketplace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button disabled={busy} onClick={removeSaved}>
              {busy ? "Excluindo…" : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
