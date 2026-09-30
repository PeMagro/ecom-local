import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Info, Loader2, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchMlCategories, suggestMlSpecWithAi } from "@/lib/integrations.functions";
import {
  isEditable,
  isRequired,
  PACKAGE_MODES,
  type Issue,
  type MlAttributeMeta,
  type MlMetadata,
  type MlSpec,
  type MlValue,
} from "@/lib/ml-validation";

const CONDITION_LABEL: Record<string, string> = { new: "Novo", used: "Usado", refurbished: "Recondicionado" };
const SHIPPING_LABEL: Record<string, string> = {
  me2: "Mercado Envios",
  me1: "Mercado Envios 1",
  custom: "Envio próprio (personalizado)",
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-[invalid=true]:border-destructive";

type Props = {
  spec: MlSpec;
  onChange: (spec: MlSpec) => void;
  onCategory: (categoryId: string, categoryName: string) => void;
  meta: MlMetadata | undefined;
  metaLoading: boolean;
  metaError: string | null;
  onRetryMeta: () => void;
  issues: Issue[];
  conditionalIds: string[];
  defaultQuery: string;
  /** Contexto do produto usado pela ECO para completar a ficha. */
  aiContext?: { title: string; description: string; brand: string | null };
};

export function MlSpecEditor(p: Props) {
  const search = useServerFn(searchMlCategories);
  const suggest = useServerFn(suggestMlSpecWithAi);
  const [query, setQuery] = useState(p.defaultQuery);
  const [searching, setSearching] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ categoryId: string; categoryName: string }>>([]);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const issueFor = (field: string) => p.issues.find((i) => i.field === field)?.message;

  async function runSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchMsg(null);
    try {
      const r = await search({ data: { query: query.trim() } });
      setResults(r.results);
      setSearchMsg(r.message ?? (r.results.length ? null : "Nenhuma categoria encontrada."));
    } catch (e) {
      setSearchMsg(e instanceof Error ? e.message : "Falha ao buscar.");
    } finally {
      setSearching(false);
    }
  }

  const set = (patch: Partial<MlSpec>) => p.onChange({ ...p.spec, ...patch });
  const setAttr = (id: string, v: MlValue) => set({ attributes: { ...p.spec.attributes, [id]: v } });
  const setTerm = (id: string, v: MlValue) => set({ saleTerms: { ...p.spec.saleTerms, [id]: v } });

  const attrs = (p.meta?.attributes ?? []).filter(isEditable);
  const needed = attrs.filter((a) => isRequired(a, p.spec.condition) || p.conditionalIds.includes(a.id));
  const requiredTerms = (p.meta?.saleTerms ?? []).filter((t) => isEditable(t) && isRequired(t, p.spec.condition));
  const catIssue = issueFor("category");

  async function runAiFill() {
    if (!p.spec.categoryId) return;
    setAiBusy(true);
    setAiMsg(null);
    try {
      const r = await suggest({
        data: {
          categoryId: p.spec.categoryId,
          condition: p.spec.condition,
          conditionalIds: p.conditionalIds,
          title: p.aiContext?.title ?? "",
          description: p.aiContext?.description ?? "",
          brand: p.aiContext?.brand ?? null,
        },
      });
      const filled = (cur: Record<string, MlValue>, add: Record<string, MlValue>) => {
        const out = { ...cur };
        for (const [id, v] of Object.entries(add)) {
          const has = out[id] && (out[id]!.value_id || out[id]!.value_name?.trim());
          if (!has) out[id] = v;
        }
        return out;
      };
      const attributes = filled(p.spec.attributes, r.attributes);
      const saleTerms = filled(p.spec.saleTerms, r.saleTerms);
      p.onChange({ ...p.spec, attributes, saleTerms });
      setAiMsg(r.message);
    } catch (e) {
      setAiMsg(e instanceof Error ? e.message : "Falha ao completar com a ECO.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Info className="size-3.5" aria-hidden />
        Os detalhes específicos do Mercado Livre ficam salvos neste navegador.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="ml-cat-search" className="text-xs text-muted-foreground">
          Categoria oficial do Mercado Livre
        </Label>
        {p.spec.categoryId ? (
          <p className="text-xs">
            <span className="font-medium">{p.spec.categoryName}</span>{" "}
            <span className="numeric text-muted-foreground">({p.spec.categoryId})</span>
          </p>
        ) : null}
        <div className="flex gap-2">
          <Input
            id="ml-cat-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runSearch();
              }
            }}
            placeholder="Descreva o produto ou informe o ID (ex.: MLB1055)"
            aria-invalid={!!catIssue}
            aria-describedby={catIssue ? "ml-cat-err" : undefined}
          />
          <Button type="button" size="sm" variant="outline" onClick={runSearch} disabled={searching}>
            {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
            Buscar
          </Button>
        </div>
        {searchMsg ? <p className="text-[11px] text-warning">{searchMsg}</p> : null}
        {results.length ? (
          <ul className="space-y-1" aria-label="Sugestões de categoria">
            {results.map((r) => (
              <li key={r.categoryId}>
                <button
                  type="button"
                  className="w-full rounded-md border border-border px-3 py-1.5 text-left text-xs hover:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onClick={() => {
                    setResults([]);
                    p.onCategory(r.categoryId, r.categoryName);
                  }}
                >
                  {r.categoryName} <span className="numeric text-muted-foreground">({r.categoryId})</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {catIssue ? <p id="ml-cat-err" className="text-[11px] text-destructive">{catIssue}</p> : null}
      </div>

      {!p.spec.categoryId ? null : p.metaLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Carregando ficha técnica oficial…
        </p>
      ) : p.metaError ? (
        <div className="text-xs text-destructive">
          Não foi possível carregar a ficha da categoria: {p.metaError}{" "}
          <Button type="button" size="sm" variant="link" className="h-auto p-0" onClick={p.onRetryMeta}>
            Tentar novamente
          </Button>
        </div>
      ) : p.meta ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <NativeSelect
              id="ml-condition"
              label="Condição"
              value={p.spec.condition ?? ""}
              options={p.meta.itemConditions.map((c) => ({ id: c, name: CONDITION_LABEL[c] ?? c }))}
              onChange={(v) => set({ condition: v || null })}
              error={issueFor("condition")}
            />
            <NativeSelect
              id="ml-type"
              label="Tipo de anúncio"
              value={p.spec.listingTypeId ?? ""}
              options={p.meta.listingTypes}
              onChange={(v) => set({ listingTypeId: v || null })}
              error={issueFor("listingType")}
            />
            {p.meta.shippingModes.length ? (
              <NativeSelect
                id="ml-shipping"
                label="Envio"
                value={p.spec.shippingMode ?? ""}
                options={p.meta.shippingModes.map((m) => ({ id: m, name: SHIPPING_LABEL[m] ?? m }))}
                onChange={(v) => set({ shippingMode: v || null })}
                error={issueFor("shipping")}
              />
            ) : null}
          </div>

          {p.spec.shippingMode && PACKAGE_MODES.includes(p.spec.shippingMode) ? (
            <fieldset className="space-y-2">
              <legend className="text-xs text-muted-foreground">
                Pacote de envio — confirme as medidas da embalagem (valores do produto são só sugestão)
              </legend>
              <div className="grid grid-cols-4 gap-3">
                {(
                  [
                    ["weight", "Peso (g)"],
                    ["height", "Altura (cm)"],
                    ["width", "Largura (cm)"],
                    ["length", "Comprimento (cm)"],
                  ] as const
                ).map(([k, label]) => (
                  <TextField
                    key={k}
                    id={`ml-pkg-${k}`}
                    label={label}
                    value={p.spec.pkg[k]}
                    inputMode="numeric"
                    onChange={(v) => set({ pkg: { ...p.spec.pkg, [k]: v } })}
                    error={issueFor(`pkg:${k}`)}
                  />
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ficha técnica obrigatória
              </h4>
              {needed.length || p.meta.saleTerms.some((t) => isRequired(t, p.spec.condition)) ? (
                <Button type="button" size="sm" variant="outline" onClick={runAiFill} disabled={aiBusy}>
                  {aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  Completar com IA
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Mostramos só o que o Mercado Livre exige. A ECO pode preencher os campos mais técnicos — revise antes de
              publicar.
            </p>
            {aiMsg ? <p className="text-[11px] text-warning">{aiMsg}</p> : null}
            {needed.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nenhum atributo obrigatório para esta categoria.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {needed.map((a) => (
                  <AttrField key={a.id} meta={a} value={p.spec.attributes[a.id]} onChange={(v) => setAttr(a.id, v)} error={issueFor(`attr:${a.id}`)} />
                ))}
              </div>
            )}
          </div>

          {requiredTerms.length ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Condições de venda</h4>
              <div className="grid grid-cols-2 gap-3">
                {requiredTerms.map((t) => (
                  <AttrField
                    key={t.id}
                    meta={t}
                    required
                    value={p.spec.saleTerms[t.id]}
                    onChange={(v) => setTerm(t.id, v)}
                    error={issueFor(`term:${t.id}`)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function TextField(p: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  inputMode?: "numeric" | "decimal" | "text";
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={p.id} className="text-[11px] text-muted-foreground">{p.label}</Label>
      <Input
        id={p.id}
        value={p.value}
        inputMode={p.inputMode ?? "text"}
        onChange={(e) => p.onChange(e.target.value)}
        aria-invalid={!!p.error}
        aria-describedby={p.error ? `${p.id}-err` : undefined}
      />
      {p.error ? <p id={`${p.id}-err`} className="text-[11px] text-destructive">{p.error}</p> : null}
    </div>
  );
}

function NativeSelect(p: {
  id: string;
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (v: string) => void;
  error?: string | undefined;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={p.id} className="text-[11px] text-muted-foreground">{p.label}</Label>
      <select
        id={p.id}
        className={selectClass}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        aria-invalid={!!p.error}
        aria-describedby={p.error ? `${p.id}-err` : undefined}
      >
        <option value="">Selecione</option>
        {p.options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      {p.error ? <p id={`${p.id}-err`} className="text-[11px] text-destructive">{p.error}</p> : null}
    </div>
  );
}

function AttrField(p: {
  meta: MlAttributeMeta;
  value: MlValue | undefined;
  onChange: (v: MlValue) => void;
  error?: string | undefined;
  required?: boolean;
}) {
  const id = `ml-attr-${p.meta.id}`;
  const v = p.value ?? {};
  const label = `${p.meta.name}${p.required === false ? "" : " *"}`;
  const hint = p.meta.hint ?? p.meta.tooltip;
  const listOnly = (p.meta.value_type === "list" || p.meta.value_type === "boolean") && p.meta.values?.length;

  if (listOnly) {
    return (
      <NativeSelect
        id={id}
        label={label}
        value={v.value_id ?? ""}
        options={p.meta.values!}
        onChange={(val) => p.onChange(val ? { value_id: val } : {})}
        error={p.error}
      />
    );
  }
  const listId = p.meta.values?.length ? `${id}-list` : undefined;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          list={listId}
          value={v.value_id ? (p.meta.values?.find((x) => x.id === v.value_id)?.name ?? "") : (v.value_name ?? "")}
          inputMode={p.meta.value_type?.startsWith("number") || p.meta.id === "GTIN" ? "decimal" : "text"}
          onChange={(e) => {
            const text = e.target.value;
            const match = p.meta.values?.find((x) => x.name === text);
            p.onChange(match ? { value_id: match.id } : { value_name: text, ...(v.unit ? { unit: v.unit } : {}) });
          }}
          aria-invalid={!!p.error}
          aria-describedby={[p.error ? `${id}-err` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined}
        />
        {p.meta.value_type === "number_unit" ? (
          <select
            aria-label={`Unidade de ${p.meta.name}`}
            className={`${selectClass} w-24`}
            value={v.unit ?? ""}
            onChange={(e) => p.onChange({ value_name: v.value_name ?? "", unit: e.target.value })}
          >
            <option value="">un.</option>
            {(p.meta.allowed_units ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        ) : null}
      </div>
      {listId ? (
        <datalist id={listId}>
          {p.meta.values!.map((x) => (
            <option key={x.id} value={x.name} />
          ))}
        </datalist>
      ) : null}
      {hint ? <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">{hint}</p> : null}
      {p.error ? <p id={`${id}-err`} className="text-[11px] text-destructive">{p.error}</p> : null}
    </div>
  );
}
