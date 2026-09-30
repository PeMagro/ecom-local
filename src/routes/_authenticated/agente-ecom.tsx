import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendEcomAgentMessage } from "@/lib/agent-ecom/agent.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agente-ecom")({
  head: () => ({ meta: [{ title: "Agente ECOM (teste) | ECOM" }] }),
  component: AgenteEcomPage,
});

const SUGESTOES = [
  "Quais produtos estão com estoque baixo?",
  "Tem algum produto parado, sem vender?",
  "O que falta no cadastro de produtos pra ficar completo?",
];

type AwaitedReturn<T> = T extends (...args: never[]) => Promise<infer R> ? R : never;
type AgentResponse = AwaitedReturn<typeof sendEcomAgentMessage>;

interface Turn {
  role: "user" | "assistant";
  content: string;
  debug?: Pick<AgentResponse, "structured" | "toolCalls">;
}

/**
 * Página de teste do agente v1 (src/lib/agent-ecom/) — não é o fluxo de produção
 * (esse é o "ECO" em /ia). Aqui dá pra ver, por turno, as tools que o modelo
 * chamou e a saída estruturada (alerta_v1/sugestao_campo_v1), pra validar o
 * contrato antes de plugar em Visão Geral/Estoque.
 */
function AgenteEcomPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");

    const nextTurns: Turn[] = [...turns, { role: "user", content }];
    setTurns(nextTurns);

    try {
      const response = await sendEcomAgentMessage({
        data: { messages: nextTurns.map(({ role, content: c }) => ({ role, content: c })) },
      });
      setTurns([
        ...nextTurns,
        {
          role: "assistant",
          content: response.text || "(sem texto — ver saída estruturada abaixo)",
          debug: { structured: response.structured, toolCalls: response.toolCalls },
        },
      ]);
    } catch (error) {
      toast.error("O agente não respondeu", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
      setTurns(turns);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <PageShell
      title="Agente ECOM (teste)"
      description="Console de teste do agente v1 — completude de cadastro, anúncios e alertas de estoque. Mostra as tools chamadas e a saída estruturada de cada resposta."
    >
      <div className="glass-panel flex min-h-[70vh] flex-col rounded-lg">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {turns.length === 0 ? (
            <div className="grid max-w-xl gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-md border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            turns.map((turn, index) => (
              <div key={index} className="space-y-2">
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-xs leading-relaxed",
                    turn.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-secondary",
                  )}
                >
                  {turn.content}
                </div>
                {turn.debug ? <DebugPanel debug={turn.debug} /> : null}
              </div>
            ))
          )}
          {sending ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Pensando…
            </div>
          ) : null}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              rows={2}
              value={input}
              placeholder="Pergunte sobre estoque, cadastro ou anúncios…"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(input);
                }
              }}
              className="resize-none text-xs"
            />
            <Button size="sm" onClick={() => send(input)} disabled={sending || !input.trim()}>
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function DebugPanel({ debug }: { debug: Pick<AgentResponse, "structured" | "toolCalls"> }) {
  return (
    <div className="max-w-[85%] space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-[11px]">
      {debug.toolCalls.length > 0 ? (
        <div className="space-y-1.5">
          <p className="font-semibold uppercase tracking-wide text-muted-foreground">
            Tools chamadas ({debug.toolCalls.length})
          </p>
          {debug.toolCalls.map((call, index) => (
            <div key={index} className="rounded border border-border/60 bg-background/60 p-2">
              <Badge variant="outline" className="font-mono">
                {call.name}
              </Badge>
              <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify({ input: call.input, output: call.output }, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
      {debug.structured.kind !== "texto_livre" ? (
        <div className="space-y-1">
          <p className="font-semibold uppercase tracking-wide text-muted-foreground">
            Saída estruturada — <Badge>{debug.structured.kind}</Badge>
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-border/60 bg-background/60 p-2">
            {JSON.stringify(debug.structured.data, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
