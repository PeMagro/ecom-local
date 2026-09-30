import { useTheme } from "@/components/layout/ThemeProvider";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { LoadingState } from "@/components/common/StateBlocks";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSellerSettings } from "@/hooks/useSellerSettings";
import { getProfile, updateProfile } from "@/lib/settings.functions";
import { changePassword as changePasswordFn } from "@/lib/auth.functions";
import { updateSellerSettings } from "@/lib/settings.functions";
import { maskCpf } from "@/lib/format";

type SellerSettingsPatch = NonNullable<Parameters<typeof updateSellerSettings>[0]>["data"];

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | ECOM" },
      {
        name: "description",
        content: "Conta, segurança, preferências do painel, IA e notificações.",
      },
      { property: "og:title", content: "Configurações | ECOM" },
      {
        property: "og:description",
        content: "Conta, segurança, preferências do painel, IA e notificações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const { data: settings, isLoading: settingsLoading } = useSellerSettings();

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
  });

  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    company_name: "",
    company_document: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!profileQuery.data) return;
    setProfile({
      full_name: profileQuery.data.full_name ?? "",
      phone: profileQuery.data.phone ?? "",
      company_name: profileQuery.data.company_name ?? "",
      company_document: profileQuery.data.company_document ?? "",
    });
  }, [profileQuery.data]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await updateProfile({ data: profile });
      toast.success("Dados atualizados.");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (error) {
      toast.error("Não foi possível salvar", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function updateSettings(patch: SellerSettingsPatch) {
    try {
      await updateSellerSettings({ data: patch });
      queryClient.invalidateQueries({ queryKey: ["seller_settings"] });
      toast.success("Preferências atualizadas.");
    } catch (error) {
      toast.error("Não foi possível salvar", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    }
  }

  async function changePassword() {
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePasswordFn({ data: { currentPassword, newPassword: password } });
      setPassword("");
      setCurrentPassword("");
      toast.success("Senha alterada.");
    } catch (error) {
      toast.error("Não foi possível alterar a senha", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  if (profileQuery.isLoading || settingsLoading) {
    return (
      <PageShell title="Configurações">
        <LoadingState />
      </PageShell>
    );
  }

  const notifications = (settings?.notifications ?? {}) as Record<string, boolean>;

  return (
    <PageShell title="Configurações" description="Conta, segurança, preferências e integrações">
      <Tabs defaultValue="conta">
        <TabsList>
          <TabsTrigger value="conta">Conta e perfil</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          <TabsTrigger value="preferencias">Preferências</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="conta">
          <div className="glass-panel max-w-2xl space-y-4 rounded-lg p-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome completo</Label>
              <Input
                value={profile.full_name}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, full_name: event.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <Input value={profileQuery.data?.email ?? ""} disabled />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">CPF</Label>
                <Input value={maskCpf(profileQuery.data?.cpf ?? "")} disabled />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Telefone</Label>
              <Input
                value={profile.phone}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>
            <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="empresa">
          <div className="glass-panel max-w-2xl space-y-4 rounded-lg p-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Razão social / nome fantasia</Label>
              <Input
                value={profile.company_name}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, company_name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CNPJ</Label>
              <Input
                value={profile.company_document}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, company_document: event.target.value }))
                }
              />
            </div>
            <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
              Salvar
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="seguranca">
          <div className="glass-panel max-w-2xl space-y-4 rounded-lg p-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Senha atual</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nova senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
              />
            </div>
            <Button size="sm" onClick={changePassword} disabled={savingPassword}>
              {savingPassword ? <Loader2 className="size-4 animate-spin" /> : null}
              Alterar senha
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preferencias">
          <div className="glass-panel max-w-2xl space-y-4 rounded-lg p-5">
            <div className="space-y-1.5">
              <Label htmlFor="ecom-theme" className="text-xs text-muted-foreground">
                Aparência
              </Label>
              <Select value={theme} onValueChange={(value) => setTheme(value as "light" | "dark")}>
                <SelectTrigger id="ecom-theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Modo claro</SelectItem>
                  <SelectItem value="dark">Modo escuro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Página inicial</Label>
              <Select
                value={settings?.default_landing ?? "visao-geral"}
                onValueChange={(value) => updateSettings({ default_landing: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visao-geral">Visão geral</SelectItem>
                  <SelectItem value="pedidos">Pedidos</SelectItem>
                  <SelectItem value="produtos">Produtos</SelectItem>
                  <SelectItem value="estoque">Estoque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Densidade das tabelas</Label>
              <Select
                value={settings?.density ?? "compact"}
                onValueChange={(value) => updateSettings({ density: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compacta</SelectItem>
                  <SelectItem value="comfortable">Confortável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Alerta de estoque baixo</Label>
              <Input
                defaultValue={String(settings?.low_stock_threshold ?? 5)}
                inputMode="numeric"
                onBlur={(event) =>
                  updateSettings({ low_stock_threshold: Number(event.target.value) || 5 })
                }
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notificacoes">
          <div className="glass-panel max-w-2xl space-y-4 rounded-lg p-5">
            {[
              { key: "low_stock", label: "Estoque baixo" },
              { key: "new_orders", label: "Novos pedidos" },
              { key: "sync_errors", label: "Erros de sincronização" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm">{item.label}</span>
                <Switch
                  checked={notifications[item.key] ?? true}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      notifications: { ...notifications, [item.key]: checked },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="integracoes">
          <div className="glass-panel max-w-2xl space-y-3 rounded-lg p-5">
            <p className="text-xs text-muted-foreground">
              Gerencie as conexões com Mercado Livre, Shopee, Amazon, AliExpress e TikTok Shop na
              página de integrações.
            </p>
            <Button asChild size="sm">
              <Link to="/integracoes">Abrir integrações</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
