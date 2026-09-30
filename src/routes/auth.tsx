import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser, login, signup } from "@/lib/auth.functions";
import { isValidCpf, maskCpf } from "@/lib/format";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar na ECOM" },
      {
        name: "description",
        content:
          "Acesse a ECOM para gerenciar produtos, anúncios, pedidos e estoque dos seus marketplaces.",
      },
      { property: "og:title", content: "Entrar na ECOM" },
      {
        property: "og:description",
        content:
          "Acesse a ECOM para gerenciar produtos, anúncios, pedidos e estoque dos seus marketplaces.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    getCurrentUser().then((result) => {
      if (result.user) navigate({ to: "/visao-geral" });
    });
  }, [navigate]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!email.trim()) next["email"] = "Informe seu e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next["email"] = "E-mail inválido.";
    if (password.length < 8) next["password"] = "A senha precisa ter ao menos 8 caracteres.";
    if (mode === "signup") {
      if (fullName.trim().length < 3) next["fullName"] = "Informe seu nome completo.";
      if (!isValidCpf(cpf)) next["cpf"] = "CPF inválido.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === "signin") {
        await login({ data: { email, password } });
        navigate({ to: "/visao-geral" });
        return;
      }

      await signup({ data: { email, password, fullName: fullName.trim(), cpf } });
      navigate({ to: "/onboarding" });
    } catch (error) {
      toast.error("Não foi possível continuar", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between border-r border-border bg-sidebar p-12 lg:flex">
        <div className="flex items-center gap-3">
          <img
            src="/ecom-logo.png"
            alt="Logo ECOM"
            className="size-14 rounded-lg bg-white p-1 object-contain"
          />
          <span className="text-sm font-semibold tracking-[0.2em]">ECOM</span>
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight text-gradient-brand">
            Um estoque central para todos os seus marketplaces.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Produtos, anúncios, pedidos e vendas do Mercado Livre, Shopee e Amazon reunidos em um
            único painel operacional.
          </p>
        </div>
        <p className="numeric text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Mercado Livre · Shopee · Amazon
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 inline-flex min-h-10 items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Conhecer a ECOM
          </Link>
          <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" />
            <TabsContent value="signup" />
          </Tabs>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" ? (
              <>
                <Field label="Nome completo" error={errors["fullName"]}>
                  <Input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Maria Souza"
                    autoComplete="name"
                  />
                </Field>
                <Field label="CPF" error={errors["cpf"]}>
                  <Input
                    value={cpf}
                    onChange={(event) => setCpf(maskCpf(event.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </Field>
              </>
            ) : null}

            <Field label="E-mail" error={errors["email"]}>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com"
                autoComplete="email"
              />
            </Field>

            <Field label="Senha" error={errors["password"]}>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </Field>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
