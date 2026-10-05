import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  getListingDraftsForProduct,
  listProductsForListingPicker,
  upsertListingDraft,
} from "@/lib/listings.functions";
import {
  getMarketplaceConnection,
  getMlCategoryMetadata,
  publishListingToMercadoLivre,
  searchMlCategories,
  suggestMlSpecWithAi,
  validateMlListing,
} from "@/lib/integrations.functions";
import { MARKETPLACE_LABEL, MARKETPLACES, type MarketplaceChannel } from "@/lib/marketplaces";
import type { Json } from "@/lib/sqlite/json";
import {
  emptySpec,
  isRequired,
  PACKAGE_MODES,
  parsePrice,
  parseStock,
  type Issue,
  type MlAttributeMeta,
  type MlMetadata,
  type MlSpec,
  type MlValue,
} from "@/lib/ml-validation";

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
  component: NewListingPage,
});

// Only Mercado Livre actually publishes today. Shopee/Amazon are listed (and
// selectable in the DB/UI model) but disabled here — turning one on later is
// "add its section + its publish call", not a redesign of this page.
const IMPLEMENTED: Partial<Record<MarketplaceChannel, true>> = { mercado_livre: true };

type CoreDraft = {
  productId: string | null;
  title: string;
  description: string;
  price: string;
  stock: string;
  gtin: string;
  pictureCount: number;
};
const EMPTY_CORE: CoreDraft = {
  productId: null,
  title: "",
  description: "",
  price: "",
  stock: "",
  gtin: "",
  pictureCount: 0,
};

/** What gets saved to marketplace_listings.platform_data for a Mercado Livre row — category lives in its own columns instead. */
function mlPlatformData(spec: MlSpec): Record<string, Json> {
  const { categoryId: _categoryId, categoryName: _categoryName, v: _v, ...rest } = spec;
  return rest as unknown as Record<string, Json>;
}

function specFromPlatformData(
  data: Record<string, Json>,
  categoryId: string | null,
  categoryName: string | null,
): MlSpec {
  return { ...emptySpec(), ...data, categoryId, categoryName } as MlSpec;
}

function hasAnyValue(v: MlValue | undefined) {
  return !!v && (!!v.value_id || !!v.value_name?.trim());
}

function NewListingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { productId: initialProductId } = Route.useSearch();
  const preselected = useRef(false);

  const [platforms, setPlatforms] = useState<Set<MarketplaceChannel>>(
    new Set<MarketplaceChannel>(["mercado_livre"]),
  );
  const [core, setCore] = useState<CoreDraft>(EMPTY_CORE);
  const setCorePatch = (patch: Partial<CoreDraft>) => setCore((c) => ({ ...c, ...patch }));
  const [aiBusy, setAiBusy] = useState(false);
  const productIdRef = useRef(core.productId);
  productIdRef.current = core.productId;

  const products = useQuery({
    queryKey: ["listing-products", user?.id],
    enabled: !!user,
    queryFn: () => listProductsForListingPicker(),
  });

  const draftsQuery = useQuery({
    queryKey: ["listing-drafts", user?.id, core.productId],
    enabled: Boolean(user?.id && core.productId),
    queryFn: () => getListingDraftsForProduct({ data: { productId: core.productId! } }),
  });

  const mlConnectionQuery = useQuery({
    queryKey: ["marketplace-connection", user?.id, "mercado_livre"],
    enabled: Boolean(user?.id) && platforms.has("mercado_livre"),
    queryFn: () => getMarketplaceConnection({ data: { marketplace: "mercado_livre" } }),
  });
  const mlConnected = mlConnectionQuery.data?.status === "connected";

  // Estado da seção do Mercado Livre: categoria oficial, atributos, validação
  // e publicação via API. Cada plataforma futura teria seu próprio bloco
  // assim, independente deste.
  const [mlCategoryQuery, setMlCategoryQuery] = useState("");
  const [mlCategoryResults, setMlCategoryResults] = useState<
    Array<{ categoryId: string; categoryName: string }>
  >([]);
  const [mlSearching, setMlSearching] = useState(false);
  const [mlMeta, setMlMeta] = useState<MlMetadata | null>(null);
  const [mlLoadingMeta, setMlLoadingMeta] = useState(false);
  const [mlSpec, setMlSpec] = useState<MlSpec>(emptySpec());
  const [mlConditionalIds, setMlConditionalIds] = useState<string[]>([]);
  const [mlIssues, setMlIssues] = useState<Issue[] | null>(null);
  const [mlApproved, setMlApproved] = useState(false);
  const [mlValidating, setMlValidating] = useState(false);
  const [mlAiBusy, setMlAiBusy] = useState(false);
  const [mlListingId, setMlListingId] = useState<string | null>(null);
  const [mlPublishing, setMlPublishing] = useState(false);
  // Atributos que já apareceram no formulário (obrigatórios, condicionais ou
  // digitados pelo usuário) continuam visíveis mesmo se o valor for apagado
  // para corrigir — sem isso, limpar o campo pra digitar de novo fazia o
  // campo sumir inteiro (ex.: corrigir um GTIN rejeitado pelo ML).
  const [mlTouchedAttrs, setMlTouchedAttrs] = useState<Set<string>>(new Set());
  // Peso/dimensões já cadastrados no produto — usados pra pré-preencher o
  // pacote quando o envio exigir essas medidas (me1/me2).
  const [mlProductDims, setMlProductDims] = useState({
    weight: "",
    height: "",
    width: "",
    length: "",
  });
  const mlErr = (field: string) => mlIssues?.find((i) => i.field === field)?.message;
  // Campos compartilhados (título/preço/estoque/fotos) também entram na
  // validação oficial do Mercado Livre — mostra a pendência aqui se for o
  // caso. Com mais plataformas implementadas, isto viraria "primeira
  // pendência entre as plataformas selecionadas" em vez de só ML.
  const coreErr = (field: string) => {
    const message = platforms.has("mercado_livre") ? mlErr(field) : undefined;
    return message ? <p className="mt-1 text-[11px] text-destructive">{message}</p> : null;
  };

  function pickProduct(id: string) {
    const p = products.data?.find((x) => x.id === id);
    if (!p) return;
    setCore({
      productId: p.id,
      title: p.name.slice(0, 60),
      description: p.description ?? "",
      price: p.price != null ? String(p.price).replace(".", ",") : "",
      stock: "",
      gtin: p.barcode ?? "",
      pictureCount: p.product_images?.length ?? 0,
    });
    setMlProductDims({
      weight: p.weight_grams != null ? String(Math.round(p.weight_grams)) : "",
      height: p.height_cm != null ? String(Math.round(p.height_cm)) : "",
      width: p.width_cm != null ? String(Math.round(p.width_cm)) : "",
      length: p.length_cm != null ? String(Math.round(p.length_cm)) : "",
    });
    // Reseta o estado por plataforma — reidratado abaixo se já houver
    // rascunho salvo para este produto.
    setMlMeta(null);
    setMlSpec(emptySpec());
    setMlCategoryResults([]);
    setMlConditionalIds([]);
    setMlIssues(null);
    setMlApproved(false);
    setMlListingId(null);
    setMlTouchedAttrs(new Set());
  }

  // Reabre a tela já preenchida quando o produto selecionado já tem um
  // rascunho salvo (marketplace_listings) para alguma plataforma.
  useEffect(() => {
    const rows = draftsQuery.data;
    if (!rows) return;
    const mlDraft = rows.find((r) => r.marketplace === "mercado_livre" && !r.external_id);
    if (!mlDraft) return;
    setPlatforms((prev) => new Set(prev).add("mercado_livre"));
    setMlListingId(mlDraft.id);
    setMlSpec(
      specFromPlatformData(
        mlDraft.platform_data,
        mlDraft.external_category_id,
        mlDraft.category_path,
      ),
    );
    if (mlDraft.external_category_id) {
      getMlCategoryMetadata({ data: { categoryId: mlDraft.external_category_id } })
        .then(setMlMeta)
        .catch(() => {
          // Categoria pode ter mudado/sumido do lado do ML — segue sem metadados; o usuário troca a categoria se precisar.
        });
    }
  }, [draftsQuery.data]);

  useEffect(() => {
    if (preselected.current || !initialProductId || !products.data) return;
    preselected.current = true;
    pickProduct(initialProductId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductId, products.data]);

  function togglePlatform(id: MarketplaceChannel) {
    if (!IMPLEMENTED[id]) return;
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function suggestDescription() {
    if (aiBusy || !core.title.trim()) return;
    setAiBusy(true);
    const requestProductId = productIdRef.current;
    try {
      const targets = Array.from(platforms)
        .map((id) => MARKETPLACE_LABEL[id])
        .join(" e ");
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Sugira somente uma descrição de anúncio para ${targets || "o anúncio"}, usando os dados a seguir. Não invente peso, dimensões, certificações ou especificações. Dados: ${JSON.stringify({ title: core.title, description: core.description })}`,
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
      if (productIdRef.current !== requestProductId) return;
      setCorePatch({ description: suggestion });
      toast.success("Descrição sugerida. Revise antes de publicar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao consultar a ECO.");
    } finally {
      setAiBusy(false);
    }
  }

  async function searchMlCat() {
    if (mlCategoryQuery.trim().length < 2) return;
    setMlSearching(true);
    try {
      const r = await searchMlCategories({ data: { query: mlCategoryQuery.trim() } });
      if (r.message) toast.error(r.message);
      setMlCategoryResults(r.results);
    } finally {
      setMlSearching(false);
    }
  }

  async function pickMlCategory(categoryId: string) {
    setMlLoadingMeta(true);
    try {
      const meta = await getMlCategoryMetadata({ data: { categoryId } });
      setMlMeta(meta);
      let prefilledGtin = false;
      setMlSpec((s) => {
        const next = { ...s, categoryId: meta.categoryId, categoryName: meta.categoryName };
        const gtinMeta = meta.attributes.find((a) => a.id === "GTIN");
        if (gtinMeta && core.gtin.trim() && !hasAnyValue(next.attributes["GTIN"])) {
          next.attributes = { ...next.attributes, GTIN: { value_name: core.gtin.trim() } };
          prefilledGtin = true;
        }
        return next;
      });
      setMlConditionalIds([]);
      setMlIssues(null);
      setMlApproved(false);
      setMlTouchedAttrs(prefilledGtin ? new Set(["GTIN"]) : new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar a categoria.");
    } finally {
      setMlLoadingMeta(false);
    }
  }

  function setMlCondition(condition: string) {
    setMlSpec((s) => ({ ...s, condition }));
    setMlIssues(null);
    setMlApproved(false);
  }

  function setMlShippingMode(mode: string) {
    setMlSpec((s) => {
      const next = { ...s, shippingMode: mode };
      // Entrando num modo que exige peso/dimensões: pré-preenche com o que
      // já está cadastrado no produto (só os campos ainda vazios — não
      // sobrescreve o que o usuário já digitou).
      if (PACKAGE_MODES.includes(mode)) {
        next.pkg = {
          weight: s.pkg.weight || mlProductDims.weight,
          height: s.pkg.height || mlProductDims.height,
          width: s.pkg.width || mlProductDims.width,
          length: s.pkg.length || mlProductDims.length,
        };
      }
      return next;
    });
    setMlApproved(false);
  }

  function setMlAttr(id: string, value: MlValue, scope: "attributes" | "saleTerms" = "attributes") {
    setMlSpec((s) => ({ ...s, [scope]: { ...s[scope], [id]: value } }));
    setMlTouchedAttrs((prev) => new Set(prev).add(id));
    setMlApproved(false);
  }

  async function suggestWithEco() {
    if (!mlSpec.categoryId || mlAiBusy) return;
    setMlAiBusy(true);
    try {
      const r = await suggestMlSpecWithAi({
        data: {
          categoryId: mlSpec.categoryId,
          condition: mlSpec.condition,
          conditionalIds: mlConditionalIds,
          title: core.title,
          description: core.description,
          brand: null,
        },
      });
      if (r.message) toast.info(r.message);
      setMlSpec((s) => ({
        ...s,
        attributes: { ...s.attributes, ...r.attributes },
        saleTerms: { ...s.saleTerms, ...r.saleTerms },
      }));
    } finally {
      setMlAiBusy(false);
    }
  }

  /** Cria/atualiza o rascunho em marketplace_listings para o Mercado Livre — exigido antes de validar/publicar. */
  async function ensureMlListingId(): Promise<string | null> {
    if (!core.productId) {
      toast.error("Selecione um produto do catálogo.");
      return null;
    }
    const r = await upsertListingDraft({
      data: {
        productId: core.productId,
        marketplace: "mercado_livre",
        title: core.title,
        description: core.description,
        price: parsePrice(core.price),
        stock: parseStock(core.stock),
        categoryPath: mlSpec.categoryName,
        externalCategoryId: mlSpec.categoryId,
        platformData: mlPlatformData(mlSpec),
      },
    });
    setMlListingId(r.id);
    return r.id;
  }

  async function validateMl() {
    if (!mlSpec.categoryId) {
      toast.error("Escolha a categoria oficial do Mercado Livre.");
      return;
    }
    const id = await ensureMlListingId();
    if (!id) return;
    setMlValidating(true);
    try {
      const r = await validateMlListing({ data: { listingId: id, spec: mlSpec } });
      setMlConditionalIds(r.conditionalIds);
      setMlIssues(r.issues);
      setMlApproved(r.ok);
      if (r.ok) toast.success("Validação aprovada");
      else toast.error(`${r.issues.length} pendência(s) na validação oficial`);
    } finally {
      setMlValidating(false);
    }
  }

  /** Valida (se preciso) e publica de fato no Mercado Livre via POST /items. */
  async function publishMlFlow(): Promise<{ ok: boolean; message: string }> {
    if (!mlSpec.categoryId) return { ok: false, message: "Escolha a categoria oficial." };
    const id = await ensureMlListingId();
    if (!id) return { ok: false, message: "Selecione um produto." };
    const v = await validateMlListing({ data: { listingId: id, spec: mlSpec } });
    setMlConditionalIds(v.conditionalIds);
    setMlIssues(v.issues);
    setMlApproved(v.ok);
    if (!v.ok) return { ok: false, message: `${v.issues.length} pendência(s) de validação` };
    const r = await publishListingToMercadoLivre({ data: { listingId: id, spec: mlSpec } });
    if (!r.ok) return { ok: false, message: r.message ?? "Falha ao publicar." };
    setMlListingId(null);
    setMlApproved(false);
    return { ok: true, message: r.warning ?? "Publicado." };
  }

  /**
   * Identifica as plataformas selecionadas e publica em cada uma, uma API por
   * vez, com o payload adaptado para aquela plataforma. Hoje só o Mercado
   * Livre está implementado; as demais entram aqui como mais um `if`.
   */
  async function publishAll() {
    const targets = Array.from(platforms);
    if (!targets.length) {
      toast.error("Selecione ao menos uma plataforma.");
      return;
    }
    setMlPublishing(true);
    try {
      const results: Array<{ marketplace: MarketplaceChannel; ok: boolean; message: string }> = [];
      for (const marketplace of targets) {
        if (marketplace === "mercado_livre") {
          const r = await publishMlFlow();
          results.push({ marketplace, ...r });
        } else {
          results.push({
            marketplace,
            ok: false,
            message: "Publicação direta ainda não disponível (em breve).",
          });
        }
      }
      const okCount = results.filter((r) => r.ok).length;
      const summary = results
        .map((r) => `${MARKETPLACE_LABEL[r.marketplace]}: ${r.ok ? "publicado" : r.message}`)
        .join(" · ");
      if (okCount > 0) {
        toast.success(
          okCount === results.length ? "Anúncio publicado." : "Anúncio publicado parcialmente.",
          { description: summary },
        );
        navigate({ to: "/anuncios" });
      } else {
        toast.error("Não foi possível publicar.", { description: summary });
      }
    } finally {
      setMlPublishing(false);
    }
  }

  const anyImplementedSelected = Array.from(platforms).some((p) => IMPLEMENTED[p]);
  const publishDisabled =
    !anyImplementedSelected || mlPublishing || (platforms.has("mercado_livre") && !mlConnected);

  return (
    <PageShell
      title="Novo anúncio"
      description="Escolha as plataformas e preencha os dados do anúncio"
    >
      <div className="glass-panel space-y-3 rounded-lg p-5 text-xs">
        <h2 className="text-sm font-medium">Plataformas de destino</h2>
        <div className="flex flex-wrap gap-2">
          {MARKETPLACES.map((m) => {
            const implemented = Boolean(IMPLEMENTED[m.id]);
            const checked = platforms.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                disabled={!implemented}
                onClick={() => togglePlatform(m.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                  checked ? "border-primary bg-primary/10" : "border-input"
                } ${implemented ? "hover:bg-accent" : "cursor-not-allowed opacity-50"}`}
              >
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  }`}
                >
                  {checked ? <CheckCircle2 className="size-3" /> : null}
                </span>
                <span>{m.label}</span>
                {!implemented ? (
                  <span className="text-[10px] text-muted-foreground">(em breve)</span>
                ) : null}
              </button>
            );
          })}
        </div>
        {platforms.has("mercado_livre") && !mlConnected ? (
          <p className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
            Conecte o Mercado Livre na tela{" "}
            <Link to="/integracoes" className="text-primary underline">
              Integrações
            </Link>{" "}
            para publicar.
          </p>
        ) : null}
      </div>

      <div className="glass-panel grid grid-cols-1 gap-4 rounded-lg p-5 text-xs sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-muted-foreground">Produto do catálogo</span>
          <select
            className="h-8 w-full rounded-md border border-input bg-background px-2"
            value={core.productId ?? ""}
            onChange={(e) => pickProduct(e.target.value)}
          >
            <option value="">Selecione…</option>
            {(products.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-muted-foreground">Título ({core.title.length}/60)</span>
          <Input value={core.title} onChange={(e) => setCorePatch({ title: e.target.value })} />
          {coreErr("title")}
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Preço (R$)</span>
          <Input
            value={core.price}
            placeholder="19,90"
            onChange={(e) => setCorePatch({ price: e.target.value })}
          />
          {coreErr("price")}
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Estoque</span>
          <Input
            value={core.stock}
            inputMode="numeric"
            onChange={(e) => setCorePatch({ stock: e.target.value })}
          />
          {coreErr("stock")}
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Código de barras (GTIN)</span>
          <Input value={core.gtin} onChange={(e) => setCorePatch({ gtin: e.target.value })} />
        </label>
        <div className="space-y-1">
          <span className="text-muted-foreground">Fotos do produto</span>
          <p className="numeric pt-2">{core.pictureCount}</p>
          {coreErr("pictures")}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Descrição</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={aiBusy || !core.title.trim()}
              onClick={suggestDescription}
            >
              {aiBusy ? "ECO está escrevendo…" : "Apoio da ECO"}
            </Button>
          </div>
          <Textarea
            rows={3}
            value={core.description}
            onChange={(e) => setCorePatch({ description: e.target.value })}
          />
        </div>
      </div>

      {platforms.has("mercado_livre") ? (
        <MercadoLivreCategoryAndSpec
          mlMeta={mlMeta}
          mlSpec={mlSpec}
          mlCategoryQuery={mlCategoryQuery}
          setMlCategoryQuery={setMlCategoryQuery}
          mlCategoryResults={mlCategoryResults}
          mlSearching={mlSearching}
          mlLoadingMeta={mlLoadingMeta}
          mlConditionalIds={mlConditionalIds}
          mlTouchedAttrs={mlTouchedAttrs}
          mlErr={mlErr}
          onSearch={searchMlCat}
          onPickCategory={pickMlCategory}
          onChangeCategory={() => {
            setMlMeta(null);
            setMlSpec((s) => ({ ...s, categoryId: null, categoryName: null }));
            setMlIssues(null);
            setMlApproved(false);
          }}
          onCondition={setMlCondition}
          onListingType={(id) => setMlSpec((s) => ({ ...s, listingTypeId: id }))}
          onShippingMode={setMlShippingMode}
          onAttr={setMlAttr}
          onPkg={(k, v) => setMlSpec((s) => ({ ...s, pkg: { ...s.pkg, [k]: v } }))}
          extra={
            <Button
              size="sm"
              variant="outline"
              disabled={!mlSpec.categoryId || mlAiBusy}
              onClick={suggestWithEco}
            >
              {mlAiBusy ? "ECO está completando…" : "Completar com a ECO"}
            </Button>
          }
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {mlApproved ? (
          <span className="flex items-center gap-1 text-xs text-primary">
            <CheckCircle2 className="size-3.5" />
            Mercado Livre validado
          </span>
        ) : null}
        {platforms.has("mercado_livre") ? (
          <Button size="sm" variant="outline" onClick={validateMl} disabled={mlValidating}>
            {mlValidating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            Validar anúncio
          </Button>
        ) : null}
        <Button size="sm" onClick={publishAll} disabled={publishDisabled}>
          {mlPublishing ? (
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

function MercadoLivreCategoryAndSpec({
  mlMeta,
  mlSpec,
  mlCategoryQuery,
  setMlCategoryQuery,
  mlCategoryResults,
  mlSearching,
  mlLoadingMeta,
  mlConditionalIds,
  mlTouchedAttrs,
  mlErr,
  onSearch,
  onPickCategory,
  onChangeCategory,
  onCondition,
  onListingType,
  onShippingMode,
  onAttr,
  onPkg,
  extra,
}: {
  mlMeta: MlMetadata | null;
  mlSpec: MlSpec;
  mlCategoryQuery: string;
  setMlCategoryQuery: (v: string) => void;
  mlCategoryResults: Array<{ categoryId: string; categoryName: string }>;
  mlSearching: boolean;
  mlLoadingMeta: boolean;
  mlConditionalIds: string[];
  mlTouchedAttrs: Set<string>;
  mlErr: (field: string) => string | undefined;
  onSearch: () => void;
  onPickCategory: (categoryId: string) => void;
  onChangeCategory: () => void;
  onCondition: (condition: string) => void;
  onListingType: (id: string) => void;
  onShippingMode: (mode: string) => void;
  onAttr: (id: string, value: MlValue, scope?: "attributes" | "saleTerms") => void;
  onPkg: (key: "weight" | "height" | "width" | "length", value: string) => void;
  extra?: React.ReactNode;
}) {
  const wantedAttrs = mlMeta
    ? mlMeta.attributes.filter(
        (a) =>
          isRequired(a, mlSpec.condition) ||
          mlConditionalIds.includes(a.id) ||
          mlTouchedAttrs.has(a.id) ||
          hasAnyValue(mlSpec.attributes[a.id]),
      )
    : [];
  const wantedTerms = mlMeta
    ? mlMeta.saleTerms.filter(
        (t) =>
          isRequired(t, mlSpec.condition) ||
          mlTouchedAttrs.has(t.id) ||
          hasAnyValue(mlSpec.saleTerms[t.id]),
      )
    : [];

  return (
    <div className="glass-panel space-y-3 rounded-lg p-5 text-xs">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Mercado Livre</h2>
        {extra}
      </div>
      {mlSpec.categoryId ? (
        <p>
          Categoria: <span className="font-medium">{mlSpec.categoryName}</span>{" "}
          <span className="text-muted-foreground">({mlSpec.categoryId})</span>{" "}
          <button className="text-primary underline" onClick={onChangeCategory}>
            trocar
          </button>
        </p>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="Ex.: fone de ouvido bluetooth"
            value={mlCategoryQuery}
            onChange={(e) => setMlCategoryQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
          />
          <Button size="sm" variant="outline" onClick={onSearch} disabled={mlSearching}>
            {mlSearching ? <Loader2 className="size-3.5 animate-spin" /> : "Buscar"}
          </Button>
        </div>
      )}
      {!mlSpec.categoryId && mlCategoryResults.length ? (
        <div className="flex flex-col gap-1">
          {mlCategoryResults.map((c) => (
            <button
              key={c.categoryId}
              className="rounded border border-input px-2 py-1.5 text-left hover:bg-accent"
              onClick={() => onPickCategory(c.categoryId)}
            >
              {c.categoryName}
            </button>
          ))}
        </div>
      ) : null}
      {mlLoadingMeta ? <p className="text-muted-foreground">Carregando categoria…</p> : null}
      {mlErr("category") ? (
        <p className="text-[11px] text-destructive">{mlErr("category")}</p>
      ) : null}
      {mlErr("official") ? (
        <p className="text-[11px] text-destructive">{mlErr("official")}</p>
      ) : null}

      {mlMeta ? (
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-muted-foreground">Condição</span>
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2"
              value={mlSpec.condition ?? ""}
              onChange={(e) => onCondition(e.target.value)}
            >
              <option value="">Selecione…</option>
              {mlMeta.itemConditions.map((c) => (
                <option key={c} value={c}>
                  {c === "new" ? "Novo" : c === "used" ? "Usado" : c}
                </option>
              ))}
            </select>
            {mlErr("condition") ? (
              <p className="mt-1 text-[11px] text-destructive">{mlErr("condition")}</p>
            ) : null}
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Tipo de anúncio</span>
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2"
              value={mlSpec.listingTypeId ?? ""}
              onChange={(e) => onListingType(e.target.value)}
            >
              <option value="">Selecione…</option>
              {mlMeta.listingTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {mlErr("listingType") ? (
              <p className="mt-1 text-[11px] text-destructive">{mlErr("listingType")}</p>
            ) : null}
          </label>
          {mlMeta.shippingModes.length ? (
            <label className="space-y-1">
              <span className="text-muted-foreground">Envio</span>
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2"
                value={mlSpec.shippingMode ?? ""}
                onChange={(e) => onShippingMode(e.target.value)}
              >
                <option value="">Selecione…</option>
                {mlMeta.shippingModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {mlErr("shipping") ? (
                <p className="mt-1 text-[11px] text-destructive">{mlErr("shipping")}</p>
              ) : null}
            </label>
          ) : null}

          {mlSpec.shippingMode && PACKAGE_MODES.includes(mlSpec.shippingMode)
            ? (["weight", "height", "width", "length"] as const).map((k) => (
                <label key={k} className="space-y-1">
                  <span className="text-muted-foreground">
                    {k === "weight"
                      ? "Peso (g)"
                      : k === "height"
                        ? "Altura (cm)"
                        : k === "width"
                          ? "Largura (cm)"
                          : "Comprimento (cm)"}
                  </span>
                  <Input
                    value={mlSpec.pkg[k]}
                    onChange={(e) => onPkg(k, e.target.value)}
                    inputMode="numeric"
                  />
                  {mlErr(`pkg:${k}`) ? (
                    <p className="mt-1 text-[11px] text-destructive">{mlErr(`pkg:${k}`)}</p>
                  ) : null}
                </label>
              ))
            : null}

          {wantedAttrs.length ? (
            <h3 className="pt-2 font-medium sm:col-span-2">Ficha técnica obrigatória</h3>
          ) : null}
          {wantedAttrs.map((a) => (
            <AttrField
              key={a.id}
              meta={a}
              value={mlSpec.attributes[a.id]}
              error={mlErr(`attr:${a.id}`)}
              onChange={(v) => onAttr(a.id, v)}
            />
          ))}

          {wantedTerms.length ? (
            <h3 className="pt-2 font-medium sm:col-span-2">Condições de venda</h3>
          ) : null}
          {wantedTerms.map((t) => (
            <AttrField
              key={t.id}
              meta={t}
              value={mlSpec.saleTerms[t.id]}
              error={mlErr(`term:${t.id}`)}
              onChange={(v) => onAttr(t.id, v, "saleTerms")}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AttrField({
  meta,
  value,
  error,
  onChange,
}: {
  meta: MlAttributeMeta;
  value: MlValue | undefined;
  error?: string | undefined;
  onChange: (v: MlValue) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-muted-foreground">{meta.name}</span>
      {meta.values?.length ? (
        <select
          className="h-8 w-full rounded-md border border-input bg-background px-2"
          value={value?.value_id ?? ""}
          onChange={(e) => onChange({ value_id: e.target.value })}
        >
          <option value="">Selecione…</option>
          {meta.values.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      ) : meta.value_type === "number_unit" ? (
        <div className="flex gap-2">
          <Input
            value={value?.value_name ?? ""}
            onChange={(e) =>
              onChange({
                value_name: e.target.value,
                ...(value?.unit ? { unit: value.unit } : {}),
              })
            }
            inputMode="decimal"
          />
          <select
            className="h-8 rounded-md border border-input bg-background px-2"
            value={value?.unit ?? ""}
            onChange={(e) =>
              onChange({
                unit: e.target.value,
                ...(value?.value_name ? { value_name: value.value_name } : {}),
              })
            }
          >
            <option value="">Unidade…</option>
            {meta.allowed_units?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <Input
          value={value?.value_name ?? ""}
          onChange={(e) => onChange({ value_name: e.target.value })}
        />
      )}
      {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
    </label>
  );
}
