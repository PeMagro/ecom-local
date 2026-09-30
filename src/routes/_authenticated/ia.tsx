import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, MessageSquarePlus, Send, Sparkle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { LoadingState } from "@/components/common/StateBlocks";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  addMessage,
  createConversation,
  deleteConversation as deleteConversationFn,
  getAiContextData,
  hasAnyConversation,
  listConversations,
  listMessages,
  touchConversation,
} from "@/lib/ai.functions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePresentation } from "@/hooks/usePresentation";

export const Route = createFileRoute("/_authenticated/ia")({
  head: () => ({
    meta: [
      { title: "ECO | ECOM" },
      {
        name: "description",
        content: "ECO, a assistente de e-commerce do ECOM para criar e melhorar anúncios.",
      },
      { property: "og:title", content: "ECO | ECOM" },
      {
        property: "og:description",
        content: "ECO, a assistente de e-commerce do ECOM para criar e melhorar anúncios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiPage,
});

const SUGGESTIONS = [
  "Melhore o título deste produto para o Mercado Livre",
  "Gere uma descrição completa para a Shopee",
  "Quais produtos estão com estoque baixo?",
  "Analise os erros dos meus anúncios por marketplace",
];

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g);
  return parts.map((part, index) => {
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-background/70 px-1 py-0.5 font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function AssistantMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  const isHeading = (line: string) => /^\s{0,3}#{1,3}\s+/.test(line);
  const isUnorderedItem = (line: string) => /^\s*[-*+]\s+/.test(line);
  const isOrderedItem = (line: string) => /^\s*\d+[.)]\s+/.test(line);

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^\s{0,3}#{1,3}\s+(.+)$/);
    if (heading) {
      blocks.push(
        <h3 key={`heading-${index}`} className="font-semibold">
          {renderInlineMarkdown(heading[1] ?? "")}
        </h3>,
      );
      index += 1;
      continue;
    }

    if (isUnorderedItem(line) || isOrderedItem(line)) {
      const ordered = isOrderedItem(line);
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = lines[index] ?? "";
        const match = ordered
          ? itemLine.match(/^\s*\d+[.)]\s+(.+)$/)
          : itemLine.match(/^\s*[-*+]\s+(.+)$/);
        if (!match) break;
        items.push(match[1] ?? "");
        index += 1;
      }
      const ItemList = ordered ? "ol" : "ul";
      blocks.push(
        <ItemList
          key={`list-${index}`}
          className={ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ItemList>,
      );
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      (lines[index] ?? "").trim() &&
      !isHeading(lines[index] ?? "") &&
      !isUnorderedItem(lines[index] ?? "") &&
      !isOrderedItem(lines[index] ?? "")
    ) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(
      <p key={`paragraph-${index}`}>
        {paragraph.map((paragraphLine, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 ? <br /> : null}
            {renderInlineMarkdown(paragraphLine)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="space-y-2">{blocks}</div>;
}

function AiPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const presentation = usePresentation();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const conversations = useQuery({
    queryKey: ["ai", "conversations"],
    queryFn: () => listConversations(),
  });

  const messages = useQuery({
    queryKey: ["ai", "messages", conversationId],
    enabled: conversationId !== null,
    queryFn: () => listMessages({ data: { conversationId: conversationId! } }),
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data, streaming]);

  async function buildContext() {
    const { products, listings, balances, orders, sales, connections } = await getAiContextData();

    return JSON.stringify({
      produtos: products.map(({ id, description, ...product }) => ({
        ...product,
        descricao: description?.slice(0, 500) ?? null,
        estoque: balances
          .filter((balance) => balance.product_id === id)
          .map((balance) => ({
            disponivel: balance.quantity - balance.reserved,
            reservado: balance.reserved,
            limite_baixo: balance.low_stock_threshold,
          })),
      })),
      anuncios: listings,
      anuncios_apresentacao: presentation.listings,
      pedidos: orders,
      pedidos_apresentacao: presentation.orders,
      vendas: sales,
      integracoes: {
        conectadas: connections,
        canais_apresentacao: presentation.channels.map((channel) => ({
          marketplace: channel.marketplace,
          nome_loja: channel.nickname,
          conectada_em: channel.connectedAt,
        })),
      },
      fontes_indisponiveis: [] as string[],
    });
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    setStreaming("");

    try {
      if (!presentation.ready) throw new Error("Aguarde o carregamento dos dados da conta.");
      if (!user) throw new Error("Sessão expirada.");

      let activeId = conversationId;
      let firstConversation = false;
      if (activeId && !messages.isSuccess)
        throw new Error("Aguarde o histórico da conversa carregar.");
      const firstResponse =
        !activeId || !(messages.data ?? []).some((message) => message.role === "assistant");
      if (!activeId) {
        const { has } = await hasAnyConversation();
        firstConversation = !has;

        const created = await createConversation({ data: { title: content.slice(0, 60) } });
        activeId = created.id;
        setConversationId(activeId);
      }

      await addMessage({ data: { conversationId: activeId, role: "user", content } });
      queryClient.invalidateQueries({ queryKey: ["ai", "messages", activeId] });

      const history = [
        ...(messages.data ?? []).map((message) => ({
          role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: message.content,
        })),
        { role: "user" as const, content },
      ];

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          context: await buildContext(),
          firstResponse,
          firstConversation,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({ error: "Falha na resposta da IA." }));
        throw new Error(payload.error ?? "Falha na resposta da IA.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setStreaming(answer);
      }

      await addMessage({ data: { conversationId: activeId, role: "assistant", content: answer } });
      await touchConversation({ data: { conversationId: activeId } });

      setStreaming("");
      queryClient.invalidateQueries({ queryKey: ["ai", "messages", activeId] });
      queryClient.invalidateQueries({ queryKey: ["ai", "conversations"] });
    } catch (error) {
      setStreaming("");
      toast.error("A IA não respondeu", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function deleteConversation() {
    if (!deleteConversationId || deletingConversation) return;
    const id = deleteConversationId;
    setDeletingConversation(true);

    try {
      await deleteConversationFn({ data: { conversationId: id } });

      if (conversationId === id) {
        setConversationId(null);
        setInput("");
        setStreaming("");
      }
      setDeleteConversationId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ai", "conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["ai", "messages", id] }),
      ]);
      toast.success("Conversa excluída.");
    } catch (error) {
      toast.error("Não foi possível excluir a conversa", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setDeletingConversation(false);
    }
  }

  return (
    <PageShell
      title="ECO"
      description="Assistente de e-commerce: crie anúncios, melhore títulos e analise erros com os dados do painel"
      actions={
        <Button size="sm" variant="outline" onClick={() => setConversationId(null)}>
          <MessageSquarePlus className="size-3.5" />
          Nova conversa
        </Button>
      }
    >
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="glass-panel max-h-44 overflow-y-auto rounded-lg p-3 lg:h-[calc(100vh-190px)] lg:max-h-none">
          <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico
          </p>
          {conversations.isLoading ? (
            <LoadingState />
          ) : (conversations.data ?? []).length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">Nenhuma conversa ainda.</p>
          ) : (
            <ul className="space-y-1">
              {(conversations.data ?? []).map((conversation) => (
                <li key={conversation.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setConversationId(conversation.id)}
                    className={cn(
                      "min-w-0 flex-1 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                      conversationId === conversation.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-secondary",
                    )}
                  >
                    <span className="line-clamp-1 font-medium">{conversation.title}</span>
                    <span className="numeric text-[10px] text-muted-foreground">
                      {formatDateTime(conversation.updated_at)}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Excluir conversa ${conversation.title}`}
                    title="Excluir conversa"
                    disabled={
                      deletingConversation || (sending && conversationId === conversation.id)
                    }
                    onClick={() => setDeleteConversationId(conversation.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="glass-panel flex min-w-0 h-[min(65vh,680px)] flex-col rounded-lg lg:h-[calc(100vh-190px)]">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {conversationId === null && streaming === "" ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkle className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {!conversations.isLoading &&
                    !conversations.isError &&
                    (conversations.data ?? []).length === 0
                      ? "Olá! Sou a ECO, assistente de gestão de e-commerce da ECOM."
                      : "Como posso ajudar na sua operação hoje?"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {!conversations.isLoading &&
                    !conversations.isError &&
                    (conversations.data ?? []).length === 0
                      ? "Posso ajudar com catálogo, anúncios, preços, estoque, pedidos e marketplaces. Se preferir, peça para conversarmos em inglês ou espanhol."
                      : "Posso analisar os dados da sua conta e sugerir próximos passos."}
                  </p>
                </div>
                <div className="grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      className="rounded-md border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {(messages.data ?? []).map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[75%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap",
                      message.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-secondary",
                    )}
                  >
                    {message.role === "assistant" ? (
                      <AssistantMarkdown content={message.content} />
                    ) : (
                      message.content
                    )}
                  </div>
                ))}
                {streaming ? (
                  <div className="max-w-[75%] whitespace-pre-wrap rounded-lg bg-secondary px-3.5 py-2.5 text-xs leading-relaxed">
                    <AssistantMarkdown content={streaming} />
                  </div>
                ) : null}
                {sending && !streaming ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Pensando…
                  </div>
                ) : null}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                rows={2}
                value={input}
                placeholder="Peça para criar um anúncio, melhorar um título ou revisar o catálogo…"
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
        </section>
      </div>
      <AlertDialog
        open={deleteConversationId !== null}
        onOpenChange={(open) => {
          if (!open && !deletingConversation) setDeleteConversationId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              As mensagens dessa conversa também serão excluídas. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingConversation}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingConversation}
              onClick={() => void deleteConversation()}
            >
              {deletingConversation ? "Excluindo…" : "Excluir conversa"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
