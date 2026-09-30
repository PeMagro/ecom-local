import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Accessibility, Contrast, Minus, Plus, Square, Volume2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const FONT_KEY = "ecom:a11y:font";
const HC_KEY = "ecom:a11y:hc";
const LEVELS = ["normal", "md", "lg"] as const;
const LEVEL_LABEL = { normal: "Normal", md: "Médio", lg: "Grande" };
const LANGS = [
  { code: "pt-BR", label: "Português" },
  { code: "en-US", label: "Inglês" },
  { code: "es-ES", label: "Espanhol" },
];

function readLocal(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* armazenamento indisponível: preferência vale só nesta sessão */
  }
}

export function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("normal");
  const [hc, setHc] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [supported, setSupported] = useState(true);
  const [notice, setNotice] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const f = readLocal(FONT_KEY);
    if (f === "md" || f === "lg") setLevel(f);
    setHc(readLocal(HC_KEY) === "1");
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  useEffect(() => {
    document.documentElement.dataset["font"] = level;
  }, [level]);
  useEffect(() => {
    document.documentElement.classList.toggle("hc", hc);
  }, [hc]);

  function stop() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  // Cancela a leitura ao navegar e ao desmontar.
  useEffect(() => {
    stop();
  }, [pathname]);
  useEffect(() => () => stop(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function read(lang: string) {
    stop();
    setLangOpen(false);
    if (!supported) {
      setNotice("Seu navegador não oferece leitura em voz alta.");
      return;
    }
    const main = document.getElementById("conteudo-principal");
    const text = (main?.innerText ?? "").trim();
    if (!text) {
      setNotice("Não há conteúdo para ler nesta página.");
      return;
    }
    const u = new SpeechSynthesisUtterance(text.slice(0, 12000));
    u.lang = lang;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
    if (voice) u.voice = voice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    setNotice("");
    window.speechSynthesis.speak(u);
  }

  function changeLevel(delta: number) {
    const idx = Math.min(2, Math.max(0, LEVELS.indexOf(level) + delta));
    const next = LEVELS[idx]!;
    setLevel(next);
    writeLocal(FONT_KEY, next);
  }

  function toggleHc() {
    setHc((v) => {
      writeLocal(HC_KEY, v ? "0" : "1");
      return !v;
    });
  }

  return (
    <div className="no-print fixed bottom-4 left-4 z-40 md:left-64">
      {open ? (
        <div
          id="painel-acessibilidade"
          role="region"
          aria-label="Opções de acessibilidade"
          className="glass-panel mb-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-lg border border-border p-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold text-foreground">Acessibilidade</p>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Fechar painel de acessibilidade" onClick={() => { setOpen(false); buttonRef.current?.focus(); }}>
              <X className="size-3.5" />
            </Button>
          </div>

          <div className="space-y-1.5">
            {speaking ? (
              <Button size="sm" variant="secondary" className="w-full" onClick={stop}>
                <Square className="size-3.5" />
                Parar leitura
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                aria-expanded={langOpen}
                aria-controls="idiomas-leitura"
                onClick={() => setLangOpen((v) => !v)}
              >
                <Volume2 className="size-3.5" />
                Ouvir esta página
              </Button>
            )}
            {langOpen && !speaking ? (
              <ul id="idiomas-leitura" aria-label="Idioma da leitura" className="grid grid-cols-3 gap-1">
                {LANGS.map((l) => (
                  <li key={l.code}>
                    <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={() => read(l.code)}>
                      {l.label}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p aria-live="polite" className="text-[11px] text-muted-foreground">
              {speaking ? "Lendo o conteúdo principal…" : notice}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Texto: {LEVEL_LABEL[level]}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" aria-label="Diminuir texto (A−)" disabled={level === "normal"} onClick={() => changeLevel(-1)}>
                <Minus className="size-3" />A
              </Button>
              <Button size="sm" variant="outline" aria-label="Aumentar texto (A+)" disabled={level === "lg"} onClick={() => changeLevel(1)}>
                <Plus className="size-3" />A
              </Button>
            </div>
          </div>

          <Button size="sm" variant={hc ? "default" : "outline"} className="w-full" aria-pressed={hc} onClick={toggleHc}>
            <Contrast className="size-3.5" />
            Alto contraste
          </Button>
        </div>
      ) : null}

      <Button
        ref={buttonRef}
        size="sm"
        className="min-h-11 shadow-lg"
        aria-expanded={open}
        aria-controls="painel-acessibilidade"
        onClick={() => setOpen((v) => !v)}
      >
        <Accessibility className="size-4" />
        Acessibilidade
      </Button>
    </div>
  );
}
