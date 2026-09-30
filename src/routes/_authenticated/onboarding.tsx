import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSellerSettings } from "@/lib/settings.functions";
import { MARKETPLACES, type MarketplaceChannel } from "@/lib/marketplaces";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [sellsOnline, setSellsOnline] = useState<boolean | null>(null);
  const [channels, setChannels] = useState<MarketplaceChannel[]>([]);
  const [landing, setLanding] = useState("overview");
  const [density, setDensity] = useState("comfortable");
  const [threshold, setThreshold] = useState("5");

  const steps = ["Perfil", "Marketplaces", "Assistente de IA", "Preferências"];

  async function finish() {
    setSaving(true);
    try {
      await updateSellerSettings({
        data: {
          onboarding_completed: true,
          sells_online: sellsOnline,
          marketplaces: channels,
          ai_enabled: true,
          default_landing: landing,
          density,
          low_stock_threshold: Number(threshold) || 5,
        },
      });
      toast.success("Tudo pronto. Bem-vindo à ECOM.");
      navigate({ to: "/visao-geral" });
    } catch (error) {
      toast.error("Não foi possível salvar", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="glass-panel w-full max-w-2xl rounded-xl p-8">
        <div className="flex items-center gap-2">
          {steps.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[11px] font-medium",
                  index <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {index < step ? <Check className="size-3" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-[11px]",
                  index === step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8 min-h-56">
          {step === 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Você já vende online?</h2>
                <p className="text-xs text-muted-foreground">
                  Isso ajuda a ECOM a priorizar o que mostrar no seu painel.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { value: true, label: "Sim, já vendo", hint: "Tenho anúncios ativos" },
                  { value: false, label: "Ainda não", hint: "Estou começando agora" },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setSellsOnline(option.value)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      sellsOnline === option.value
                        ? "border-primary bg-accent"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.hint}</p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Quais marketplaces você utiliza?</h2>
                <p className="text-xs text-muted-foreground">
                  Selecione um ou mais canais. Você conecta as contas depois.
                </p>
              </div>
              <div className="grid gap-3">
                {MARKETPLACES.map((marketplace) => {
                  const selected = channels.includes(marketplace.id);
                  return (
                    <button
                      key={marketplace.id}
                      type="button"
                      onClick={() =>
                        setChannels((current) =>
                          current.includes(marketplace.id)
                            ? current.filter((item) => item !== marketplace.id)
                            : [...current, marketplace.id],
                        )
                      }
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-4 text-left transition-colors",
                        selected
                          ? "border-primary bg-accent"
                          : "border-border hover:border-border-strong",
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">{marketplace.label}</p>
                        <p className="text-xs text-muted-foreground">{marketplace.description}</p>
                      </div>
                      {selected ? <Check className="size-4 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Sua assistente ECO já está disponível</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  Crie descrições, melhore títulos e revise anúncios direto na plataforma.
                </p>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Preferências do painel</h2>
                <p className="text-xs text-muted-foreground">
                  Ajustes básicos de exibição e alertas.
                </p>
              </div>
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tela inicial</Label>
                  <Select value={landing} onValueChange={setLanding}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overview">Visão geral</SelectItem>
                      <SelectItem value="orders">Pedidos</SelectItem>
                      <SelectItem value="products">Produtos</SelectItem>
                      <SelectItem value="inventory">Estoque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Densidade das tabelas</Label>
                  <Select value={density} onValueChange={setDensity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">Confortável</SelectItem>
                      <SelectItem value="compact">Compacta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Alerta de estoque baixo (unidades)
                  </Label>
                  <Select value={threshold} onValueChange={setThreshold}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["3", "5", "10", "20"].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
          >
            Voltar
          </Button>
          {step < 3 ? (
            <Button
              size="sm"
              onClick={() => setStep((value) => value + 1)}
              disabled={step === 0 && sellsOnline === null}
            >
              Continuar
            </Button>
          ) : (
            <Button size="sm" onClick={finish} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Concluir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
