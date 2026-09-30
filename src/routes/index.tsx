import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  FileText,
  LayoutDashboard,
  Megaphone,
  Package,
  Plug,
  Receipt,
  Search,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ECOM — seus marketplaces em um só lugar" },
      {
        name: "description",
        content:
          "Conheça a ECOM: organize produtos, anúncios, pedidos, vendas e estoque em um painel para vendedores multicanal.",
      },
      {
        property: "og:title",
        content: "ECOM — seus marketplaces em um só lugar",
      },
      {
        property: "og:description",
        content:
          "Uma visão organizada de produtos, anúncios, pedidos, vendas e estoque.",
      },
    ],
  }),
  component: LandingPage,
});

const previewNavigation = [
  { label: "Visão geral", icon: LayoutDashboard, active: true },
  { label: "Vendas", icon: Receipt },
  { label: "Estatísticas", icon: BarChart3 },
  { label: "Pedidos", icon: ShoppingCart },
  { label: "Produtos", icon: Package },
  { label: "Anúncios", icon: Megaphone },
  { label: "Estoque", icon: Boxes },
  { label: "Emissões fiscais", icon: FileText },
  { label: "Integrações", icon: Plug },
];

const metrics = [
  { label: "Vendas sincronizadas", icon: Receipt },
  { label: "Produtos cadastrados", icon: Package },
  { label: "Anúncios", icon: Megaphone },
  { label: "Estoque central", icon: Boxes },
];

const features = [
  {
    title: "Produtos e anúncios",
    text: "Organize o catálogo e prepare anúncios para seus canais de venda.",
    icon: Package,
    color: "text-teal-300",
    background: "bg-teal-400/10",
    border: "border-teal-400/30",
  },
  {
    title: "Pedidos e vendas",
    text: "Acompanhe os pedidos e consulte as vendas em um mesmo painel.",
    icon: ShoppingCart,
    color: "text-sky-300",
    background: "bg-sky-400/10",
    border: "border-sky-400/30",
  },
  {
    title: "Estoque central",
    text: "Visualize os saldos e as movimentações dos seus produtos.",
    icon: Boxes,
    color: "text-orange-300",
    background: "bg-orange-400/10",
    border: "border-orange-400/30",
  },
];

function PreviewDashboard() {
  return (
    <div
      aria-label="Prévia ilustrativa da página Visão geral da ECOM, sem dados de uma conta"
      className="relative min-w-0 overflow-hidden rounded-xl border border-white/15 bg-[#11191e] shadow-[0_28px_90px_-38px_rgba(0,0,0,0.9)]"
    >
      <div className="flex min-h-[365px] sm:min-h-[430px]">
        <div className="hidden w-[150px] shrink-0 border-r border-white/10 bg-[#10161b] p-3 sm:block xl:w-[170px]">
          <div className="mb-5 flex items-center gap-2 border-b border-white/10 pb-4">
            <img
              src="/ecom-logo.png"
              alt=""
              className="size-7 rounded bg-white p-0.5 object-contain"
            />
            <span className="text-xs font-semibold tracking-wider">ECOM</span>
          </div>
          <div className="space-y-0.5">
            {previewNavigation.map(({ label, icon: Icon, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] ${active ? "bg-teal-400/15 text-teal-200" : "text-slate-400"}`}
              >
                <Icon className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex h-11 items-center justify-between gap-2 border-b border-white/10 px-3 sm:px-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-100">
                Visão geral
              </p>
              <p className="hidden text-[8px] text-slate-500 sm:block">
                Seu catálogo e seus canais em uma visão
              </p>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Search className="size-3" aria-hidden="true" />
              <Bell className="size-3" aria-hidden="true" />
              <span className="flex size-5 items-center justify-center rounded-full bg-slate-700 text-[8px] text-white">
                E
              </span>
            </div>
          </div>

          <div className="space-y-3 p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {metrics.map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="min-w-0 rounded-md border border-white/10 bg-white/[0.025] p-2.5"
                >
                  <Icon
                    className="mb-2 size-3.5 text-teal-300"
                    aria-hidden="true"
                  />
                  <p className="min-h-7 text-[9px] leading-tight text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 text-base font-medium text-slate-100">—</p>
                </div>
              ))}
            </div>

            <div className="grid gap-2 xl:grid-cols-[1.2fr_1fr]">
              <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.025] p-3">
                <div className="mb-3 flex items-center justify-between gap-1">
                  <p className="text-[10px] font-medium">Pedidos recentes</p>
                  <span className="text-[9px] text-teal-300">Ver todos</span>
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-white/10 pb-1.5 text-[8px] text-slate-500">
                  <span>Pedido</span>
                  <span>Canal</span>
                  <span>Status</span>
                </div>
                <div className="flex min-h-16 items-center justify-center text-center text-[9px] text-slate-500">
                  Nenhum pedido exibido nesta prévia
                </div>
              </div>
              <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.025] p-3">
                <p className="mb-3 text-[10px] font-medium">
                  Resumo por marketplace
                </p>
                <div className="space-y-2 text-[9px] text-slate-400">
                  {["Mercado Livre", "Shopee", "Amazon"].map((name) => (
                    <div
                      key={name}
                      className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5 last:border-0"
                    >
                      <span>{name}</span>
                      <span aria-label="Sem dados">—</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0d1318] font-sans text-slate-100">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-teal-400 focus:px-4 focus:py-2 focus:text-slate-950"
      >
        Pular para o conteúdo
      </a>
      <header className="border-b border-white/5">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8 xl:px-12">
          <a
            href="#inicio"
            className="flex items-center gap-3"
            aria-label="ECOM, início"
          >
            <img
              src="/ecom-logo.png"
              alt=""
              className="size-10 rounded-md bg-white p-1 object-contain"
            />
            <span className="text-lg font-semibold tracking-[0.14em]">
              ECOM
            </span>
          </a>
          <nav
            aria-label="Navegação da apresentação"
            className="hidden items-center gap-8 text-sm text-slate-300 md:flex"
          >
            <a className="hover:text-teal-300" href="#como-funciona">
              Como funciona
            </a>
            <a className="hover:text-teal-300" href="#recursos">
              Recursos
            </a>
            <a className="hover:text-teal-300" href="#sobre">
              Sobre
            </a>
          </nav>
          <Link
            to="/auth"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-teal-400/80 px-5 text-sm font-medium text-teal-300 transition-colors hover:bg-teal-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main id="conteudo">
        <section
          id="inicio"
          className="relative mx-auto max-w-[1500px] px-5 pt-12 sm:px-8 lg:pt-20 xl:px-12"
        >
          <div
            className="pointer-events-none absolute right-0 top-4 -z-0 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">
            <div className="max-w-xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/5 px-3 py-1.5 text-xs font-medium text-teal-200">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Gestão multicanal em um só painel
              </p>
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl xl:text-6xl">
                Seus marketplaces{" "}
                <span className="text-teal-300">em um só lugar</span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-400 sm:text-lg">
                Organize produtos, anúncios, pedidos, vendas e estoque em uma
                única plataforma.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#recursos"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-teal-400 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Conhecer a ECOM{" "}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
                <Link
                  to="/auth"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-teal-400/70 px-6 text-sm font-medium text-slate-100 transition-colors hover:bg-teal-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
                >
                  Entrar
                </Link>
              </div>
            </div>
            <div className="min-w-0">
              <PreviewDashboard />
              <p className="mt-2 text-right text-[11px] text-slate-500">
                Prévia ilustrativa da interface, sem dados de uma conta.
              </p>
            </div>
          </div>
        </section>

        <section
          id="recursos"
          className="mx-auto max-w-[1500px] px-5 pb-20 pt-16 sm:px-8 xl:px-12"
        >
          <h2 className="sr-only">Recursos da ECOM</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map(
              ({ title, text, icon: Icon, color, background, border }) => (
                <div
                  key={title}
                  className="rounded-xl border border-white/10 bg-[#151e24] p-6"
                >
                  <div
                    className={`mb-5 flex size-12 items-center justify-center rounded-lg border ${border} ${background} ${color}`}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {text}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>

        <section
          id="como-funciona"
          className="border-y border-white/10 bg-[#111a20]"
        >
          <div className="mx-auto max-w-[1500px] px-5 py-16 sm:px-8 xl:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
              Como funciona
            </p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold sm:text-3xl">
              Uma visão mais simples da sua operação
            </h2>
            <div className="mt-9 grid gap-6 md:grid-cols-3">
              {[
                [
                  "01",
                  "Organize produtos",
                  "Cadastre as informações do seu catálogo em um só lugar.",
                ],
                [
                  "02",
                  "Prepare anúncios",
                  "Revise os dados de cada anúncio para o canal escolhido.",
                ],
                [
                  "03",
                  "Acompanhe a operação",
                  "Consulte pedidos, vendas, estatísticas e estoques no painel.",
                ],
              ].map(([number, title, description]) => (
                <div key={number} className="border-l border-teal-400/40 pl-5">
                  <p className="font-mono text-sm text-teal-300">{number}</p>
                  <h3 className="mt-3 text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="sobre"
          className="mx-auto flex max-w-[1500px] flex-col gap-6 px-5 py-16 sm:px-8 md:flex-row md:items-center md:justify-between xl:px-12"
        >
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
              Sobre a ECOM
            </p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
              Feita para quem vende em mais de um canal
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              A ECOM reúne as principais áreas da gestão de e-commerce em uma
              interface clara. Este projeto é uma MVP em evolução; a
              disponibilidade de integrações depende de cada canal.
            </p>
          </div>
          <Link
            to="/auth"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-teal-400 px-5 text-sm font-semibold text-slate-950 hover:bg-teal-300"
          >
            Acessar a ECOM <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-slate-500">
        ECOM · Gestão de e-commerce multicanal
      </footer>
    </div>
  );
}
