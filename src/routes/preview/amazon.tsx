import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Keyboard, MapPin, Star } from "lucide-react";

import { DEMO_PRODUCT, type DemoVariant } from "@/lib/demo-marketplace-product";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/preview/amazon")({
  head: () => ({
    meta: [{ title: `${DEMO_PRODUCT.name} · Amazon.com.br (simulação)` }],
  }),
  component: AmazonPreviewPage,
});

function AmazonPreviewPage() {
  const [variant, setVariant] = useState<DemoVariant>(DEMO_PRODUCT.variants[0]);

  return (
    <div className="min-h-screen bg-white font-sans text-[#0f1111]">
      <div className="bg-[#232f3e] px-4 py-2 text-center text-xs text-white">
        Simulação visual gerada a partir do payload da Listings Items API (Amazon SP-API) — nenhum
        anúncio real foi publicado.{" "}
        <Link to="/" className="text-[#ffd814] underline">
          Voltar para a ECOM
        </Link>
      </div>

      <header className="bg-[#131921] text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
          <span className="text-xl font-bold italic">amazon.com.br</span>
          <div className="flex flex-1 items-center rounded-md">
            <input
              readOnly
              value="teclado teste"
              className="w-full rounded-l-md border-none px-3 py-2 text-sm text-black outline-none"
            />
            <button className="rounded-r-md bg-[#febd69] px-4 py-2 text-sm font-medium text-[#0f1111]">
              Buscar
            </button>
          </div>
        </div>
        <div className="bg-[#232f3e] px-4 py-2 text-xs text-white/90">
          <div className="mx-auto max-w-6xl">Todas as categorias · {DEMO_PRODUCT.category}</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <nav className="mb-3 flex items-center gap-1 text-xs text-[#007185]">
          <span>{DEMO_PRODUCT.category}</span>
          <ChevronRight className="size-3 text-[#565959]" />
          <span>Periféricos para computador</span>
          <ChevronRight className="size-3 text-[#565959]" />
          <span className="text-[#0f1111]">{DEMO_PRODUCT.name}</span>
        </nav>

        <div className="grid gap-8 md:grid-cols-[360px_1fr_300px]">
          {/* Galeria */}
          <div>
            <div className="flex aspect-square w-full items-center justify-center rounded border border-[#d5d9d9] bg-white">
              <Keyboard className="size-20 text-[#ccc]" aria-hidden="true" />
            </div>
            <div className="mt-2 flex gap-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className={`flex size-12 items-center justify-center rounded border ${i === 0 ? "border-[#e77600]" : "border-[#d5d9d9]"} bg-white`}
                >
                  <Keyboard className="size-5 text-[#ccc]" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>

          {/* Detalhes centrais */}
          <div>
            <h1 className="text-xl font-medium leading-snug text-[#0f1111]">{DEMO_PRODUCT.name}</h1>
            <p className="mt-1 text-sm text-[#007185]">Visite a loja {DEMO_PRODUCT.brand}</p>

            <div className="mt-1 flex items-center gap-2 text-sm">
              <span className="flex text-[#ffa41c]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5" />
                ))}
              </span>
              <span className="text-[#007185]">0 avaliações</span>
            </div>

            <hr className="my-3 border-[#d5d9d9]" />

            <div className="flex items-baseline gap-1">
              <span className="text-sm text-[#0f1111]">R$</span>
              <span className="text-3xl font-medium text-[#0f1111]">
                {formatCurrency(DEMO_PRODUCT.price).replace("R$", "").trim()}
              </span>
            </div>
            <p className="text-xs text-[#565959]">Frete e outras taxas calculados no checkout</p>

            <hr className="my-3 border-[#d5d9d9]" />

            <div className="flex items-start gap-3 text-sm">
              <span className="w-14 shrink-0 font-medium text-[#0f1111]">Cor:</span>
              <div className="flex gap-2">
                {DEMO_PRODUCT.variants.map((v) => (
                  <button
                    key={v.sku}
                    onClick={() => setVariant(v)}
                    className={`rounded border px-3 py-1.5 text-sm ${
                      variant.sku === v.sku
                        ? "border-[#e77600] ring-1 ring-[#e77600]"
                        : "border-[#d5d9d9] hover:border-[#0f1111]"
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <h2 className="text-sm font-bold text-[#0f1111]">Sobre este item</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#0f1111]">
                <li>{DEMO_PRODUCT.description}</li>
                <li>Marca: {DEMO_PRODUCT.brand}</li>
                <li>Categoria: {DEMO_PRODUCT.category}</li>
                <li>Peso do item: {DEMO_PRODUCT.weightGrams / 1000} kg</li>
              </ul>
            </div>
          </div>

          {/* Buy box */}
          <div className="h-fit rounded border border-[#d5d9d9] p-4">
            <div className="flex items-baseline gap-1">
              <span className="text-sm">R$</span>
              <span className="text-2xl font-medium">
                {formatCurrency(DEMO_PRODUCT.price).replace("R$", "").trim()}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#007600]">Em estoque</p>
            <p className="text-xs text-[#565959]">{DEMO_PRODUCT.stock} unidades disponíveis</p>

            <div className="mt-3 flex items-center gap-2 text-xs text-[#565959]">
              <MapPin className="size-3.5" /> Enviado e vendido por ECOM Store Amazon
            </div>

            <label className="mt-3 block text-xs text-[#0f1111]">
              Quantidade
              <select
                className="mt-1 w-20 rounded border border-[#d5d9d9] px-2 py-1 text-sm"
                defaultValue={1}
                disabled
              >
                <option value={1}>1</option>
              </select>
            </label>

            <button className="mt-3 w-full rounded-full bg-[#ffd814] py-2 text-sm font-medium text-[#0f1111] hover:bg-[#f7ca00]">
              Adicionar ao carrinho
            </button>
            <button className="mt-2 w-full rounded-full bg-[#ffa41c] py-2 text-sm font-medium text-[#0f1111] hover:bg-[#fa8900]">
              Comprar agora
            </button>

            <hr className="my-3 border-[#d5d9d9]" />
            <dl className="space-y-1.5 text-xs text-[#565959]">
              <div className="flex justify-between">
                <dt>SKU do anúncio</dt>
                <dd className="font-mono text-[#0f1111]">{variant.sku}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Vendido por</dt>
                <dd className="text-[#0f1111]">ECOM Store Amazon</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-8 border-t border-[#d5d9d9] pt-4">
          <h2 className="text-lg font-bold text-[#0f1111]">Detalhes do produto</h2>
          <dl className="mt-3 grid max-w-2xl grid-cols-[minmax(0,180px)_1fr] gap-y-2 text-sm">
            <Row label="Marca" value={DEMO_PRODUCT.brand} />
            <Row label="Categoria" value={DEMO_PRODUCT.category} />
            <Row label="SKU" value={DEMO_PRODUCT.sku} />
            <Row label="GTIN/EAN" value={DEMO_PRODUCT.ean} />
            <Row label="Peso do item" value={`${DEMO_PRODUCT.weightGrams / 1000} kg`} />
            <Row label="Condição" value="Novo" />
          </dl>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[#565959]">{label}</dt>
      <dd className="text-[#0f1111]">{value}</dd>
    </>
  );
}
