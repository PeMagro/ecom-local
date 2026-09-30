import { emptySpec, type MlSpec } from "@/lib/ml-validation";

const PREFIX = "ecom:mlspec:v1";

export const draftKey = {
  listing: (userId: string, listingId: string) => `${PREFIX}:${userId}:listing:${listingId}`,
  product: (userId: string, productId: string) => `${PREFIX}:${userId}:product:${productId}:mercado_livre`,
};

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Lê o rascunho local; ignora dados corrompidos ou de outra versão. */
export function loadSpec(key: string, s: Store | null = store()): MlSpec | null {
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MlSpec>;
    if (parsed?.v !== 1) return null;
    return { ...emptySpec(), ...parsed, pkg: { ...emptySpec().pkg, ...(parsed.pkg ?? {}) } } as MlSpec;
  } catch {
    return null;
  }
}

/** Retorna true só quando a gravação realmente ocorreu. */
export function saveSpec(key: string, spec: MlSpec, s: Store | null = store()): boolean {
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(spec));
    return true;
  } catch {
    return false;
  }
}

export function removeSpec(key: string, s: Store | null = store()) {
  try {
    s?.removeItem(key);
  } catch {
    /* armazenamento indisponível: nada a limpar */
  }
}

/** Move o rascunho da chave por produto para a chave do anúncio salvo. */
export function migrateSpec(from: string, to: string, s: Store | null = store()): boolean {
  const spec = loadSpec(from, s);
  if (!spec) return false;
  if (!saveSpec(to, spec, s)) return false;
  removeSpec(from, s);
  return true;
}
