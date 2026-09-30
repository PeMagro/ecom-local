import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/layout/PageShell";
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
import { useAuth } from "@/hooks/useAuth";
import { usePresentation } from "@/hooks/usePresentation";
import {
  disconnectMarketplace,
  getMarketplaceConnection,
  startMarketplaceConnection,
  syncMarketplace,
} from "@/lib/integrations.functions";
import { connectDemo, disconnectDemo } from "@/lib/ml-demo";
import { CHANNELS, CHANNEL_LABEL, type PresentationChannel } from "@/lib/presentation-channels";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações | ECOM" },
      { name: "description", content: "Gerencie seus canais de venda em um único lugar." },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { channels } = usePresentation();
  const [disconnecting, setDisconnecting] = useState<PresentationChannel | null>(null);
  const [connecting, setConnecting] = useState<PresentationChannel | null>(null);
  const [syncing, setSyncing] = useState(false);

  const mlConnectionQuery = useQuery({
    queryKey: ["marketplace-connection", user?.id, "mercado_livre"],
    enabled: Boolean(user?.id),
    queryFn: () => getMarketplaceConnection({ data: { marketplace: "mercado_livre" } }),
  });

  async function connect(channel: PresentationChannel) {
    if (!user) return;
    if (channel === "mercado_livre") {
      setConnecting(channel);
      try {
        const result = await startMarketplaceConnection({
          data: { marketplace: "mercado_livre" },
        });
        if (result.message || !result.authorizationUrl) {
          toast.error("Mercado Livre ainda não está configurado", {
            description: result.message ?? "Configure as credenciais OAuth do servidor.",
          });
          await mlConnectionQuery.refetch();
          setConnecting(null);
          return;
        }
        window.location.assign(result.authorizationUrl);
      } catch (error) {
        toast.error("Não foi possível iniciar a conexão", {
          description: error instanceof Error ? error.message : "Tente novamente.",
        });
        setConnecting(null);
      }
      return;
    }

    const state = connectDemo(user.id, undefined, channel);
    if (!state) {
      toast.error("Não foi possível salvar. Verifique o armazenamento do navegador.");
      return;
    }
    toast.success(`${CHANNEL_LABEL[channel]} conectado`, {
      description: `${state.listings.length} anúncios e ${state.orders?.length ?? 0} pedidos disponíveis.`,
    });
  }

  async function syncMercadoLivre() {
    setSyncing(true);
    try {
      const result = await syncMarketplace({
        data: { marketplace: "mercado_livre" },
      });
      if (result.message) {
        toast.error("Não foi possível sincronizar pedidos", { description: result.message });
        return;
      }
      toast.success("Pedidos do Mercado Livre sincronizados", {
        description: `${result.synced} pedidos atualizados.`,
      });
      await Promise.all([
        mlConnectionQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["overview", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["orders", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["sales", user?.id] }),
      ]);
    } catch (error) {
      toast.error("Falha ao sincronizar pedidos", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function confirmDisconnect() {
    if (!disconnecting || !user) return;
    const channel = disconnecting;
    setDisconnecting(null);
    try {
      if (channel === "mercado_livre") {
        await disconnectMarketplace({ data: { marketplace: "mercado_livre" } });
        await mlConnectionQuery.refetch();
      } else {
        disconnectDemo(user.id, undefined, channel);
      }
      toast.success(`${CHANNEL_LABEL[channel]} desconectado.`);
    } catch (error) {
      toast.error("Não foi possível desconectar o canal", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    }
  }

  return (
    <PageShell title="Integrações" description="Conecte e gerencie seus canais de venda">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CHANNELS.map((channel) => {
          const isMercadoLivre = channel.id === "mercado_livre";
          const liveConnection = isMercadoLivre ? mlConnectionQuery.data : null;
          const demoConnection = isMercadoLivre
            ? undefined
            : channels.find((item) => item.marketplace === channel.id);
          const connected = isMercadoLivre
            ? liveConnection?.status === "connected"
            : Boolean(demoConnection);
          const connectedAt = isMercadoLivre
            ? liveConnection?.connected_at
            : demoConnection?.connectedAt;

          return (
            <section key={channel.id} className="glass-panel space-y-4 rounded-xl p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold">{channel.label}</h2>
                <Badge variant={connected ? "default" : "secondary"}>
                  {connected ? "Conectado" : "Desconectado"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Anúncios, pedidos e estoque em um único painel.
              </p>
              {connected ? (
                <>
                  {isMercadoLivre ? (
                    <p className="text-sm">
                      {liveConnection?.account_name ?? `Conta ${liveConnection?.account_id ?? ""}`}{" "}
                      · API oficial
                    </p>
                  ) : (
                    <p className="text-sm">
                      {demoConnection?.nickname} · {demoConnection?.listings.length} anúncios ·{" "}
                      {demoConnection?.orders?.length ?? 0} pedidos
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {connectedAt ? `Conectado em ${formatDateTime(connectedAt)}` : "Conexão ativa"}
                    {isMercadoLivre && liveConnection?.last_sync_at
                      ? ` · Última sincronização: ${formatDateTime(liveConnection.last_sync_at)}`
                      : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isMercadoLivre && syncing}
                      onClick={() =>
                        isMercadoLivre
                          ? void syncMercadoLivre()
                          : toast.success("Dados de apresentação atualizados")
                      }
                    >
                      <RefreshCw className="size-3.5" />
                      {isMercadoLivre
                        ? syncing
                          ? "Sincronizando…"
                          : "Sincronizar pedidos"
                        : "Sincronizar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDisconnecting(channel.id)}>
                      Desconectar
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/pedidos">Ver pedidos</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  size="sm"
                  disabled={connecting === channel.id}
                  onClick={() => void connect(channel.id)}
                >
                  <Link2 className="size-3.5" />
                  {connecting === channel.id ? "Conectando…" : "Conectar conta"}
                </Button>
              )}
            </section>
          );
        })}
      </div>
      <AlertDialog
        open={disconnecting !== null}
        onOpenChange={(open) => !open && setDisconnecting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Desconectar {disconnecting ? CHANNEL_LABEL[disconnecting] : "canal"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {disconnecting === "mercado_livre"
                ? "A autorização e os tokens do Mercado Livre serão removidos. Será necessário conectar novamente para continuar sincronizando."
                : "Os anúncios e pedidos de apresentação deste canal serão removidos deste navegador. Seu catálogo de produtos será mantido."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDisconnect()}>
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
