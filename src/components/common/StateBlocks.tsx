import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Carregando…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border border-border bg-card/40 px-6 py-12 text-sm text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-5 text-destructive" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {message ? (
          <p className="max-w-lg text-xs text-muted-foreground">{message}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
