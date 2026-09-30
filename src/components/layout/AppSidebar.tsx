import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  FileText,
  LayoutDashboard,
  Megaphone,
  Package,
  Plug,
  Receipt,
  ShoppingCart,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/visao-geral", label: "Visão geral", icon: LayoutDashboard },
  { to: "/vendas", label: "Vendas", icon: Receipt },
  { to: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/anuncios", label: "Anúncios", icon: Megaphone },
  { to: "/estoque", label: "Estoque", icon: Boxes },
  { to: "/documentos", label: "Emissões fiscais", icon: FileText },
  { to: "/integracoes", label: "Integrações", icon: Plug },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      <div className="no-print sticky top-0 z-30 border-b border-sidebar-border bg-sidebar md:hidden">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <img src="/ecom-logo.png" alt="Logo ECOM" className="size-9 rounded bg-white p-1 object-contain" />
          <span className="text-sm font-semibold tracking-[0.18em] text-sidebar-foreground">ECOM</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">Multicanal</span>
        </div>
        <nav aria-label="Seções" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:thin]">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <aside
      aria-label="Navegação principal"
      className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex"
    >
      <div className="flex h-[72px] items-center gap-2.5 border-b border-sidebar-border px-5">
        <img
          src="/ecom-logo.png"
          alt="Logo ECOM"
          className="size-10 rounded bg-white p-1 object-contain"
        />
        <div className="leading-none">
          <p className="text-sm font-semibold tracking-[0.18em] text-sidebar-foreground">
            ECOM
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Multicanal
          </p>
        </div>
      </div>

      <nav
        aria-label="Seções"
        className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 pb-20"
      >
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "size-4",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-3">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Ambiente de apresentação · dados de marketplaces fictícios.
        </p>
      </div>
      </aside>
    </>
  );
}
