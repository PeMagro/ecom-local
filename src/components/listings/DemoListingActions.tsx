import type { PresentationChannel } from "@/lib/presentation-channels";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  deleteDemoListing,
  updateDemoListing,
  type DemoListing,
  type DemoState,
  type DemoStatus,
} from "@/lib/ml-demo";
import { parsePrice, parseStock } from "@/lib/ml-validation";

export function DemoListingActions({
  userId,
  listing,
  onChange,
  channel = "mercado_livre",
}: {
  channel?: PresentationChannel;
  userId: string;
  listing: DemoListing;
  onChange: (state: DemoState) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [title, setTitle] = useState(listing.title);
  const [price, setPrice] = useState(String(listing.price).replace(".", ","));
  const [stock, setStock] = useState(String(listing.stock));
  const [status, setStatus] = useState<DemoStatus>(listing.status);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function openEdit() {
    setTitle(listing.title);
    setPrice(String(listing.price).replace(".", ","));
    setStock(String(listing.stock));
    setStatus(listing.status);
    setErrors({});
    setEditOpen(true);
  }

  function handleSave() {
    const e: Record<string, string> = {};
    const t = title.trim();
    if (!t) e["title"] = "Informe o título.";
    else if (t.length > 60) e["title"] = "Máximo de 60 caracteres.";
    const p = parsePrice(price);
    if (p === null) e["price"] = "Preço inválido. Ex.: 19,90 ou 19.90.";
    const s = parseStock(stock);
    if (s === null) e["stock"] = "Estoque deve ser um número inteiro (0 ou mais).";
    setErrors(e);
    if (Object.keys(e).length > 0 || p === null || s === null) return;
    const next = updateDemoListing(userId, listing.id, { title: t, price: p, stock: s, status }, undefined, channel);
    if (!next) {
      toast.error("Não foi possível salvar neste navegador", { description: "Nada foi alterado." });
      return;
    }
    onChange(next);
    setEditOpen(false);
    toast.success("Anúncio atualizado", {
      description: "Alterações salvas.",
    });
  }

  function handleDelete() {
    const next = deleteDemoListing(userId, listing.id, undefined, channel);
    if (!next) {
      toast.error("Não foi possível excluir neste navegador");
      return;
    }
    onChange(next);
    toast.success("Anúncio excluído", {
      description: "Anúncio removido da lista.",
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={openEdit}>
        <Pencil className="size-3" />
        Editar
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive" onClick={() => setDelOpen(true)}>
        <Trash2 className="size-3" />
        Excluir
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar anúncio</DialogTitle>
            <DialogDescription>
              Alterações ficam só neste navegador. Nada é enviado ao Mercado Livre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <DemoField id={`t-${listing.id}`} label="Título" error={errors["title"]}>
              <Input id={`t-${listing.id}`} value={title} onChange={(ev) => setTitle(ev.target.value)} aria-invalid={errors["title"] ? true : undefined} />
            </DemoField>
            <div className="grid grid-cols-2 gap-3">
              <DemoField id={`p-${listing.id}`} label="Preço (R$)" error={errors["price"]}>
                <Input id={`p-${listing.id}`} value={price} inputMode="decimal" onChange={(ev) => setPrice(ev.target.value)} aria-invalid={errors["price"] ? true : undefined} />
              </DemoField>
              <DemoField id={`s-${listing.id}`} label="Estoque" error={errors["stock"]}>
                <Input id={`s-${listing.id}`} value={stock} inputMode="numeric" onChange={(ev) => setStock(ev.target.value)} aria-invalid={errors["stock"] ? true : undefined} />
              </DemoField>
            </div>
            <DemoField id={`st-${listing.id}`} label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as DemoStatus)}>
                <SelectTrigger id={`st-${listing.id}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                </SelectContent>
              </Select>
            </DemoField>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anúncio?</AlertDialogTitle>
            <AlertDialogDescription>
              "{listing.title}" será removido só deste navegador. Nada muda no Mercado Livre nem no banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DemoField({ id, label, error, children }: { id: string; label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-[11px] text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
