import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Keyboard, MapPin, Star, Store } from "lucide-react";

import { DEMO_PRODUCT, type DemoVariant } from "@/lib/demo-marketplace-product";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/preview/shopee")({
  head: () => ({
    meta: [{ title: `${DEMO_PRODUCT.name} · Shopee (simulação)` }],
  }),
  component: ShopeePreviewPage,
});

function ShopeePreviewPage() {
  const [variant, setVariant] = useState<DemoVariant>(DEMO_PRODUCT.variants[0]);

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans text-[#222]">
      <div className="bg-[#fef6f5] px-4 py-2 text-center text-xs text-[#ee4d2d]">
        Simulação visual gerada a partir do payload de criação de anúncio da Shopee — nenhum anúncio
        real foi publicado.{" "}
        <Link to="/" className="underline">
          Voltar para a ECOM
        </Link>
      </div>

      <header className="bg-[#ee4d2d]">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <span className="text-2xl font-bold italic text-white">Shopee</span>
          <div className="flex flex-1 items-center rounded-sm bg-white px-3 py-2">
            <input
              readOnly
              value="teclado teste"
              className="w-full bg-transparent text-sm text-[#222] outline-none"
            />
            <button className="rounded-sm bg-[#ee4d2d] px-4 py-1 text-sm font-medium text-white">
              Buscar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4">
        <nav className="mb-3 flex items-center gap-1 text-xs text-[#555]">
          <span>Shopee</span>
          <ChevronRight className="size-3" />
          <span>{DEMO_PRODUCT.category}</span>
          <ChevronRight className="size-3" />
          <span className="text-[#ee4d2d]">{DEMO_PRODUCT.name}</span>
        </nav>

        <div className="grid gap-6 bg-white p-4 md:grid-cols-[380px_1fr]">
          {/* Galeria */}
          <div>
            <div className="flex aspect-square w-full items-center justify-center rounded-sm border border-[#eee] bg-[#fafafa]">
              <Keyboard className="size-20 text-[#ccc]" aria-hidden="true" />
            </div>
            <div className="mt-2 flex gap-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className={`flex size-16 items-center justify-center rounded-sm border ${i === 0 ? "border-[#ee4d2d]" : "border-[#eee]"} bg-[#fafafa]`}
                >
                  <Keyboard className="size-6 text-[#ccc]" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>

          {/* Detalhes */}
          <div>
            <h1 className="text-lg font-normal leading-snug text-[#222]">{DEMO_PRODUCT.name}</h1>

            <div className="mt-2 flex items-center gap-3 text-xs text-[#999]">
              <span className="flex items-center gap-1 border-r border-[#e6e6e6] pr-3">
                <span className="text-[#ee4d2d]">0.0</span>
                <span className="flex text-[#ee4d2d]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-3" />
                  ))}
                </span>
              </span>
              <span className="border-r border-[#e6e6e6] pr-3">0 avaliações</span>
              <span>0 vendidos</span>
            </div>

            <div className="mt-3 bg-[#fef6f5] px-4 py-3">
              <span className="text-2xl font-medium text-[#ee4d2d]">
                {formatCurrency(DEMO_PRODUCT.price)}
              </span>
            </div>

            <div className="mt-4 flex items-start gap-4 text-sm">
              <span className="w-20 shrink-0 text-[#999]">Cor</span>
              <div className="flex gap-2">
                {DEMO_PRODUCT.variants.map((v) => (
                  <button
                    key={v.sku}
                    onClick={() => setVariant(v)}
                    className={`rounded-sm border px-4 py-1.5 text-sm ${
                      variant.sku === v.sku
                        ? "border-[#ee4d2d] bg-[#fef6f5] text-[#ee4d2d]"
                        : "border-[#e6e6e6] text-[#222] hover:border-[#ee4d2d]"
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="w-20 shrink-0 text-[#999]">SKU</span>
              <span className="font-mono text-[#222]">{variant.sku}</span>
            </div>

            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="w-20 shrink-0 text-[#999]">Estoque</span>
              <span className="text-[#222]">{DEMO_PRODUCT.stock} unidades disponíveis</span>
            </div>

            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="w-20 shrink-0 text-[#999]">Quantidade</span>
              <div className="flex items-center rounded-sm border border-[#e6e6e6]">
                <button className="px-3 py-1 text-[#999]">-</button>
                <span className="w-10 border-x border-[#e6e6e6] py-1 text-center">1</span>
                <button className="px-3 py-1 text-[#999]">+</button>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button className="rounded-sm border border-[#ee4d2d] px-8 py-3 text-sm font-medium text-[#ee4d2d] hover:bg-[#fef6f5]">
                Adicionar ao carrinho
              </button>
              <button className="rounded-sm bg-[#ee4d2d] px-8 py-3 text-sm font-medium text-white hover:bg-[#d6431f]">
                Comprar agora
              </button>
            </div>
          </div>
        </div>

        {/* Loja */}
        <div className="mt-3 flex items-center justify-between bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-[#ee4d2d] text-white">
              <Store className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#222]">Loja ECOM Shopee</p>
              <p className="flex items-center gap-1 text-xs text-[#999]">
                <MapPin className="size-3" /> Campinas, SP
              </p>
            </div>
          </div>
          <button className="rounded-sm border border-[#ee4d2d] px-4 py-1.5 text-xs font-medium text-[#ee4d2d]">
            Ver loja
          </button>
        </div>

        {/* Detalhes do produto */}
        <div className="mt-3 bg-white p-4">
          <h2 className="border-b border-[#e6e6e6] pb-3 text-sm font-medium text-[#222]">
            Detalhes do produto
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Categoria" value={DEMO_PRODUCT.category} />
            <Row label="Marca" value={DEMO_PRODUCT.brand} />
            <Row label="SKU do anúncio" value={DEMO_PRODUCT.sku} />
            <Row label="Código de barras (EAN)" value={DEMO_PRODUCT.ean} />
            <Row label="Peso" value={`${DEMO_PRODUCT.weightGrams / 1000} kg`} />
            <Row label="Condição" value="Novo" />
          </dl>
        </div>

        <div className="mt-3 bg-white p-4">
          <h2 className="border-b border-[#e6e6e6] pb-3 text-sm font-medium text-[#222]">
            Descrição do produto
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#555]">{DEMO_PRODUCT.description}</p>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-44 shrink-0 text-[#999]">{label}</dt>
      <dd className="text-[#222]">{value}</dd>
    </div>
  );
}
