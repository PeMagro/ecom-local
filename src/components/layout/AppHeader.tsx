import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Settings, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth.functions";
import { listUnreadAlerts } from "@/lib/alerts.functions";
import { formatDateTime } from "@/lib/format";

export function AppHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: alerts } = useQuery({
    queryKey: ["alerts", "unread"],
    queryFn: () => listUnreadAlerts(),
  });

  async function handleSignOut() {
    await logout();
    navigate({ to: "/auth" });
  }

  return (
    <header className="no-print glass-header sticky top-0 z-20 flex min-h-14 items-center justify-between gap-4 border-b border-border px-5 md:h-[72px] md:px-8">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="shrink-0 text-muted-foreground">Workspace</span>
        <span aria-hidden="true" className="text-border-strong">
          /
        </span>
        <span className="truncate font-semibold text-foreground">{title}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-9"
              aria-label="Notificações"
            >
              <Bell className="size-4" />
              {alerts && alerts.length > 0 ? (
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!alerts || alerts.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nenhuma notificação por enquanto.
              </p>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="px-2 py-2.5">
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  {alert.description ? (
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                  ) : null}
                  <p className="numeric mt-1 text-[11px] text-muted-foreground">
                    {formatDateTime(alert.created_at)}
                  </p>
                </div>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-2.5 text-sm"
          aria-label="Abrir configurações"
          onClick={() => navigate({ to: "/configuracoes" })}
        >
          <Settings className="size-4" />
          <span className="hidden sm:inline">Configurações</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Conta: perfil e sair"
            >
              <UserIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate text-sm font-normal text-muted-foreground">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOut className="size-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
