import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";

import { AccessibilityWidget } from "@/components/layout/AccessibilityWidget";
import { Sparkles } from "lucide-react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { getCurrentUser } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const bare = pathname.startsWith("/onboarding");

  if (bare) return <Outlet />;

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <AppSidebar />
      <div className="md:pl-64">
        <Outlet />
      </div>
      <AccessibilityWidget />
      {pathname !== "/ia" ? (
        <Link
          to="/ia"
          aria-label="Abrir assistente ECO"
          title="Assistente ECO"
          className="no-print fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-background/70 transition-transform hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sparkles className="size-6" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
