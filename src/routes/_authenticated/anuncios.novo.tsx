import { CHANNELS, CHANNEL_LABEL, type PresentationChannel } from "@/lib/presentation-channels";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { DemoBanner } from "@/components/common/DemoBanner";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { listProductsForListingPicker } from "@/lib/listings.functions";
import {
  DEMO_CATEGORIES,
  draftSignature,
  loadDemo,
  loadDemoDraft,
  publishDemo,
  saveDemoDraft,
  searchDemoCategories,
  validateDemo,
  type DemoDraft,
} from "@/lib/ml-demo";
import type { Issue } from "@/lib/ml-validation";

export const Route = createFileRoute("/_authenticated/anuncios/novo")({
  validateSearch: (search: Record<string, unknown>) => ({
    productId:
      typeof search["productId"] === "string" ? (search["productId"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Novo anúncio | ECOM" },
      { name: "description", content: "Prepare anúncios para seus canais de venda." },
      { property: "og:title", content: "Novo anúncio | ECOM" },
      { property: "og:description", content: "Prepare anúncios para seus canais de venda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemoEditor,
});

const EMPTY: DemoDraft = {
  productId: null,
  title: "",
  description: "",
  price: "",
  stock: "",
  gtin: "",
  pictureCount: 0,
  categoryId: null,
  attributes: {},
};

function DemoEditor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { productId: initialProductId } = Route.useSearch();
  const [channel, setChannel] = useState<PresentationChannel>("mercado_livre");
  const preselected = useRef(false);
  const [draft, setDraft] = useState<DemoDraft>(EMPTY);
  const [loadedFor, setLoadedFor] = useState("");
  const scope = `${user?.id ?? ""}:${channel}`;
  const loaded = loadedFor === scope;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const [saveFailed, setSaveFailed] = useState(false);
  const [catQuery, setCatQuery] = useState("");
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [approved, setApproved] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const lock = useRef(false);
  const connected = user ? loadDemo(user.id, undefined, channel) !== null : false;

  const products = useQuery({
    queryKey: ["listing-products", user?.id],
    enabled: !!user,
    queryFn: () => listProductsForListingPicker(),
  });

  useEffect(() => {
    if (!user) return;
    const d = loadDemoDraft(user.id, undefined, channel);
    setDraft(d ?? EMPTY);
    setApproved(null);
    setIssues(null);
    setLoadedFor(scope);
  }, [user?.id, channel]);

  useEffect(() => {
    if (!user || !loaded) return;
    setSaveFailed(!saveDemoDraft(user.id, draft, undefined, channel));
  }, [draft, user, loaded]);

  useEffect(() => {
    if (!loaded || preselected.current || !initialProductId || !products.data) return;
    preselected.current = true;
    if (draft.productId !== initialProductId) pickProduct(initialProductId);
  }, [loaded, initialProductId, products.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const sig = draftSignature(draft);
  const isApproved = approved === sig;
  const category = DEMO_CATEGORIES.find((c) => c.id === draft.categoryId) ?? null;
  const matches = useMemo(() => searchDemoCategories(catQuery), [catQuery]);
  const fieldErr = (f: string) =>
    issues && !isApproved ? issues.find((i) => i.field === f)?.message : undefined;
  const set = (patch: Partial<DemoDraft>) => setDraft((d) => ({ ...d, ...patch }));

  function pickProduct(id: string) {
    const p = products.data?.find((x) => x.id === id);
    if (!p) return;
    setDraft({
      ...EMPTY,
      productId: p.id,
      title: p.name.slice(0, 60),
      description: p.description ?? "",
      price: p.price != null ? String(p.price).replace(".", ",") : "",
      gtin: p.barcode ?? "",
      pictureCount: p.product_images?.length ?? 0,
      attributes: p.brand ? { BRAND: p.brand } : {},
    });
    setIssues(null);
  }

  async function suggestDescription() {
    if (aiBusy || !draft.title.trim()) return;
    setAiBusy(true);
    const requestScope = scope;
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Sugira somente uma descrição de anúncio para ${CHANNEL_LABEL[channel]}, usando os dados a seguir. Não invente peso, dimensões, certificações ou especificações. Dados: ${JSON.stringify({ title: draft.title, description: draft.description, attributes: draft.attributes })}`,
            },
          ],
        }),
      });
      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ error: "A ECO não está disponível agora." }));
        throw new Error(payload.error ?? "A ECO não conseguiu responder.");
      }
      const suggestion = (await response.text()).trim();
      if (!suggestion) throw new Error("A ECO retornou uma resposta vazia.");
      if (scopeRef.current !== requestScope) return;
      set({ description: suggestion });
      toast.success("Descrição sugerida. Revise antes de publicar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao consultar a ECO.");
    } finally {
      setAiBusy(false);
    }
  }

  function validate() {
    const found = validateDemo(draft);
    setIssues(found);
    if (found.length === 0) {
      setApproved(sig);
      toast.success("Validação aprovada");
    } else {
      setApproved(null);
      toast.error(`${found.length} pendência(s) na validação`);
    }
  }

  function publish() {
    if (!user || lock.current) return;
    lock.current = true;
    setPublishing(true);
    const productName = products.data?.find((p) => p.id === draft.productId)?.name ?? null;
    const r = publishDemo(user.id, draft, approved, productName, undefined, channel);
    if (r.ok) {
      toast.success("Anúncio publicado", { description: CHANNEL_LABEL[channel] });
      setDraft(EMPTY);
      navigate({ to: "/anuncios" });
    } else {
      toast.error(r.message);
      lock.current = false;
      setPublishing(false);
    }
  }

  const err = (f: string) => {
    const m = fieldErr(f);
    return m ? <p className="mt-1 text-[11px] text-destructive">{m}</p> : null;
  };

  return (
    <PageShell title="Novo anúncio" description="Personalize os dados para o canal de destino">
      <label className="block max-w-sm space-y-1 text-xs">
        <span>Marketplace de destino</span>
        <select
          className="h-9 w-full rounded border border-input bg-background px-2"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as PresentationChannel);
          }}
        >
          {CHANNELS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {!connected ? (
        <p className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-xs">
          Conecte {CHANNEL_LABEL[channel]} na tela{" "}
          <Link to="/integracoes" className="text-primary underline">
            Integrações
          </Link>{" "}
          para publicar.
        </p>
      ) : null}
      {saveFailed ? (
        <p className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Não foi possível salvar o rascunho neste navegador. Suas alterações não estão guardadas.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          O rascunho fica salvo apenas neste navegador.
        </p>
      )}

      <div className="glass-panel grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-lg p-5 text-xs">
        <label className="sm:col-span-2 space-y-1">
          <span className="text-muted-foreground">Produto do catálogo</span>
          <select
            className="h-8 w-full rounded-md border border-input bg-background px-2"
            value={draft.productId ?? ""}
            onChange={(e) => pickProduct(e.target.value)}
          >
            <option value="">Selecione…</option>
            {(products.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {err("pictures")}
        </label>
        <label className="sm:col-span-2 space-y-1">
          <span className="text-muted-foreground">Título ({draft.title.length}/60)</span>
          <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          {err("title")}
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Preço (R$)</span>
          <Input
            value={draft.price}
            placeholder="19,90"
            onChange={(e) => set({ price: e.target.value })}
          />
          {err("price")}
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Estoque</span>
          <Input
            value={draft.stock}
            inputMode="numeric"
            onChange={(e) => set({ stock: e.target.value })}
          />
          {err("stock")}
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Código de barras (GTIN)</span>
          <Input value={draft.gtin} onChange={(e) => set({ gtin: e.target.value })} />
          {err("gtin")}
        </label>
        <div className="space-y-1">
          <span className="text-muted-foreground">Fotos do produto</span>
          <p className="numeric pt-2">{draft.pictureCount}</p>
        </div>
        <label className="sm:col-span-2 space-y-1">
          <span className="flex items-center justify-between text-muted-foreground">
            Descrição
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={aiBusy || !draft.title.trim()}
              onClick={suggestDescription}
            >
              {aiBusy ? "ECO está escrevendo…" : "Apoio da ECO"}
            </Button>
          </span>
          <Textarea
            rows={3}
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </label>
      </div>

      <div className="glass-panel space-y-3 rounded-lg p-5 text-xs">
        <h2 className="text-sm font-medium">Categoria</h2>
        {category ? (
          <p>
            Selecionada: <span className="font-medium">{category.name}</span>{" "}
            <button
              className="text-primary underline"
              onClick={() => set({ categoryId: null, attributes: {} })}
            >
              trocar
            </button>
          </p>
        ) : (
          <>
            <Input
              placeholder="Ex.: fone, celular, cooler, tênis, panela"
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
            />
            {catQuery.trim().length >= 2 && matches.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhuma categoria para esse termo. Categorias disponíveis:{" "}
                {DEMO_CATEGORIES.map((c) => c.name).join(", ")}.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {matches.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() =>
                    set({
                      categoryId: c.id,
                      attributes: draft.attributes["BRAND"]
                        ? { BRAND: draft.attributes["BRAND"] }
                        : {},
                    })
                  }
                >
                  {c.name}
                </Button>
              ))}
            </div>
          </>
        )}
        {err("category")}

        {category ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
            <h3 className="sm:col-span-2 font-medium">Ficha técnica obrigatória</h3>
            {category.required.map((a) => (
              <label key={a.id} className="space-y-1">
                <span className="text-muted-foreground">{a.name}</span>
                {a.values ? (
                  <select
                    className="h-8 w-full rounded-md border border-input bg-background px-2"
                    value={draft.attributes[a.id] ?? ""}
                    onChange={(e) =>
                      set({ attributes: { ...draft.attributes, [a.id]: e.target.value } })
                    }
                  >
                    <option value="">Selecione…</option>
                    {a.values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={draft.attributes[a.id] ?? ""}
                    onChange={(e) =>
                      set({ attributes: { ...draft.attributes, [a.id]: e.target.value } })
                    }
                  />
                )}
                {err(`attr:${a.id}`)}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        {isApproved ? (
          <span className="flex items-center gap-1 text-xs text-primary">
            <CheckCircle2 className="size-3.5" />
            Validação aprovada
          </span>
        ) : null}
        <Button size="sm" variant="outline" onClick={validate}>
          <ShieldCheck className="size-3.5" />
          Validar anúncio
        </Button>
        <Button size="sm" onClick={publish} disabled={!isApproved || !connected || publishing}>
          {publishing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          Publicar anúncio
        </Button>
      </div>
    </PageShell>
  );
}
