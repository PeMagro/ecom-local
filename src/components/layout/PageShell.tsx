import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { AppHeader } from "@/components/layout/AppHeader";
import { Input } from "@/components/ui/input";

export function PageShell({
  title,
  description,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  actions,
  children,
}: {
  title: string;
  description?: string | undefined;
  searchPlaceholder?: string | undefined;
  searchValue?: string | undefined;
  onSearchChange?: ((value: string) => void) | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <div className="page-shell flex min-h-screen flex-col">
      <AppHeader title={title} />
      <main id="conteudo-principal" tabIndex={-1} className="min-w-0 flex-1 px-5 py-6 pb-24 outline-none md:px-9 md:py-8 md:pb-20">
        <div className="mx-auto w-full max-w-[1500px] space-y-6">
          <div className="flex flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Central de operações
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            {onSearchChange || actions ? (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:justify-end">
                {onSearchChange ? (
                  <div className="relative w-full sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchValue ?? ""}
                      onChange={(event) => onSearchChange(event.target.value)}
                      placeholder={searchPlaceholder ?? "Pesquisar"}
                      className="h-10 pl-9 text-sm"
                    />
                  </div>
                ) : null}
                {actions}
              </div>
            ) : null}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
