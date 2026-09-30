import { Link, useNavigate } from "@tanstack/react-router";
import { parsePositiveInt } from "@/lib/numbers";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, LoadingState } from "@/components/common/StateBlocks";
import { PageShell } from "@/components/layout/PageShell";
import {
  EMPTY_PRODUCT,
  ProductFields,
  validateProduct,
  decimalOrNull,
  type ProductFormValues,
} from "@/components/products/ProductFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addProductStock,
  createProduct,
  createVariant,
  deleteProductImage,
  getProduct,
  updateProduct,
  uploadProductImage,
} from "@/lib/products.functions";
import { formatNumber } from "@/lib/format";

type PendingPhoto = { id: string; file: File; preview: string };

export function ProductEditor({ productId }: { productId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<ProductFormValues>(EMPTY_PRODUCT);
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [pendingVariants, setPendingVariants] = useState<
    { id: string; name: string; sku: string | null }[]
  >([]);
  const [pendingStock, setPendingStock] = useState(0);
  const [variantName, setVariantName] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [stockInput, setStockInput] = useState("");
  const pendingPhotosRef = useRef(pendingPhotos);

  useEffect(() => {
    pendingPhotosRef.current = pendingPhotos;
  }, [pendingPhotos]);

  useEffect(
    () => () => pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)),
    [],
  );

  const query = useQuery({
    queryKey: ["product", productId],
    enabled: !!productId,
    queryFn: () => getProduct({ data: { id: productId! } }),
  });

  const product =
    query.data ??
    (productId
      ? null
      : {
          name: "Novo produto",
          product_images: [],
          product_variants: [],
          inventory_balances: [],
        });

  useEffect(() => {
    const product = query.data;
    if (!product) return;
    setValues({
      name: product.name ?? "",
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      description: product.description ?? "",
      category: product.category ?? "",
      brand: product.brand ?? "",
      status: product.status,
      price: product.price !== null ? String(product.price) : "",
      cost: product.cost !== null ? String(product.cost) : "",
      weight_grams: product.weight_grams !== null ? String(product.weight_grams) : "",
      length_cm: product.length_cm !== null ? String(product.length_cm) : "",
      width_cm: product.width_cm !== null ? String(product.width_cm) : "",
      height_cm: product.height_cm !== null ? String(product.height_cm) : "",
      low_stock_threshold: String(product.low_stock_threshold ?? 5),
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: values.name.trim(),
        sku: values.sku.trim() || null,
        barcode: values.barcode.trim() || null,
        description: values.description.trim() || null,
        category: values.category.trim() || null,
        brand: values.brand.trim() || null,
        status: values.status,
        price: decimalOrNull(values.price),
        cost: decimalOrNull(values.cost),
        weight_grams: decimalOrNull(values.weight_grams),
        length_cm: decimalOrNull(values.length_cm),
        width_cm: decimalOrNull(values.width_cm),
        height_cm: decimalOrNull(values.height_cm),
        low_stock_threshold: Number(values.low_stock_threshold) || 5,
      };
      const existingId = productId ?? createdProductId;
      if (existingId) {
        await updateProduct({ data: { ...payload, id: existingId } });
        return existingId;
      }
      const created = await createProduct({ data: payload });
      return created.id;
    },
    onSuccess: async (id) => {
      if (!productId) setCreatedProductId(id);
      try {
        await persistPendingItems(id);
      } catch (error) {
        toast.error("Produto salvo, mas há itens pendentes", {
          description:
            error instanceof Error ? error.message : "Clique em Salvar novamente para concluir.",
        });
        return;
      }
      toast.success(
        productId ? "Produto atualizado." : "Produto cadastrado com os itens adicionados.",
      );
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (!productId)
        navigate({
          to: "/produtos/$productId",
          params: { productId: id },
          replace: true,
        });
    },
    onError: (error: Error) =>
      toast.error("Não foi possível salvar", { description: error.message }),
  });

  async function uploadFiles(targetProductId: string, files: File[]) {
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.set("productId", targetProductId);
        formData.set("file", file);
        await uploadProductImage({ data: formData });
      }
      toast.success("Fotos enviadas.");
      queryClient.invalidateQueries({ queryKey: ["product", targetProductId] });
      return true;
    } catch (error) {
      toast.error("Falha no envio das fotos", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
      return false;
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    const targetProductId = productId ?? createdProductId;
    if (!targetProductId) {
      const queued = selected.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      }));
      setPendingPhotos((current) => [...current, ...queued]);
      if (fileRef.current) fileRef.current.value = "";
      toast.success(`${queued.length} foto(s) adicionada(s) ao cadastro`, {
        description: "As imagens serão enviadas quando você salvar o produto.",
      });
      return;
    }
    await uploadFiles(targetProductId, selected);
  }

  async function persistPendingItems(targetProductId: string) {
    const photosToUpload = [...pendingPhotos];
    for (const photo of photosToUpload) {
      const formData = new FormData();
      formData.set("productId", targetProductId);
      formData.set("file", photo.file);
      await uploadProductImage({ data: formData });
      URL.revokeObjectURL(photo.preview);
      setPendingPhotos((current) => current.filter((item) => item.id !== photo.id));
    }

    const variantsToSave = [...pendingVariants];
    for (const variant of variantsToSave) {
      await createVariant({
        data: { productId: targetProductId, name: variant.name, sku: variant.sku },
      });
      setPendingVariants((current) => current.filter((item) => item.id !== variant.id));
    }

    if (pendingStock > 0) {
      await addProductStock({
        data: {
          productId: targetProductId,
          variantId: null,
          quantity: pendingStock,
          reason: "Entrada inicial de estoque",
        },
      });
      setPendingStock(0);
    }
  }

  async function deleteImage(id: string) {
    try {
      await deleteProductImage({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
    } catch (error) {
      toast.error("Não foi possível remover a foto", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    }
  }

  async function addVariant() {
    if (variantName.trim().length < 1) {
      toast.error("Informe o nome da variação.");
      return;
    }
    const targetProductId = productId ?? createdProductId;
    if (!targetProductId) {
      setPendingVariants((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          name: variantName.trim(),
          sku: variantSku.trim() || null,
        },
      ]);
      setVariantName("");
      setVariantSku("");
      toast.success("Variação adicionada ao cadastro", {
        description: "Ela será salva junto com o produto.",
      });
      return;
    }
    try {
      await createVariant({
        data: {
          productId: targetProductId,
          name: variantName.trim(),
          sku: variantSku.trim() || null,
        },
      });
    } catch (error) {
      toast.error("Não foi possível criar a variação", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
      return;
    }
    setVariantName("");
    setVariantSku("");
    queryClient.invalidateQueries({ queryKey: ["product", targetProductId] });
  }

  async function addStock(variantId: string | null) {
    const quantity = parsePositiveInt(stockInput);
    if (quantity === null) {
      toast.error("Quantidade inválida", {
        description: "Informe um número inteiro maior que zero (sem vírgula, sinal ou letras).",
      });
      return;
    }
    const targetProductId = productId ?? createdProductId;
    if (!targetProductId) {
      setPendingStock((current) => current + quantity);
      setStockInput("");
      toast.success("Entrada adicionada ao cadastro", {
        description: "Ela será registrada junto com o produto ao salvar.",
      });
      return;
    }
    try {
      await addProductStock({
        data: {
          productId: targetProductId,
          variantId,
          quantity,
          reason: "Entrada manual de estoque",
        },
      });
    } catch (error) {
      toast.error("Não foi possível lançar a entrada", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
      return;
    }
    setStockInput("");
    toast.success("Entrada registrada no estoque central.");
    queryClient.invalidateQueries({ queryKey: ["product", targetProductId] });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
  }

  if (productId && query.isLoading) {
    return (
      <PageShell title="Produto">
        <LoadingState />
      </PageShell>
    );
  }
  if (query.isError) {
    return (
      <PageShell title="Produto">
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      </PageShell>
    );
  }
  if (!product) {
    return (
      <PageShell title="Produto">
        <EmptyState title="Produto não encontrado" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={product.name}
      description="Produto central"
      actions={
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link to="/produtos">
              <ArrowLeft className="size-3.5" />
              Voltar
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!productId}
            onClick={() => navigate({ to: "/anuncios/novo", search: { productId } })}
          >
            Gerar anúncios
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const validation = validateProduct(values);
              setErrors(validation);
              if (Object.keys(validation).length === 0) {
                setSaving(true);
                save.mutate(undefined, { onSettled: () => setSaving(false) });
              }
            }}
            disabled={saving}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      }
    >
      {!productId && !createdProductId ? (
        <p className="text-xs text-muted-foreground">
          Você pode adicionar fotos, variações e estoque desde o início. Os itens ficam preparados
          no formulário e são vinculados ao salvar o produto.
        </p>
      ) : null}
      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="fotos">Fotos</TabsTrigger>
          <TabsTrigger value="variacoes">Variações</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <div className="glass-panel max-w-4xl rounded-lg p-5">
            <ProductFields
              values={values}
              errors={errors}
              onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
            />
          </div>
        </TabsContent>

        <TabsContent value="fotos">
          <div className="glass-panel rounded-lg p-5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => handleUpload(event.target.files)}
            />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                As fotos ficam no armazenamento seguro da sua conta.
              </p>
              <Button
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || saving}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
                Adicionar fotos
              </Button>
            </div>
            {product.product_images.length === 0 && pendingPhotos.length === 0 ? (
              <EmptyState
                compact
                icon={ImagePlus}
                title="Nenhuma foto enviada"
                description="Selecione as fotos agora; elas serão enviadas ao salvar o produto."
              />
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {product.product_images.map((image) => (
                  <div
                    key={image.id}
                    className="group relative overflow-hidden rounded-md border border-border"
                  >
                    <img
                      src={`/${image.storage_path}`}
                      alt={image.alt_text ?? product.name}
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => deleteImage(image.id)}
                      className="absolute right-1 top-1 rounded bg-background/80 p-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                      aria-label="Remover foto"
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
                {pendingPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative overflow-hidden rounded-md border border-border"
                  >
                    <img
                      src={photo.preview}
                      alt={photo.file.name}
                      className="aspect-square w-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1.5 py-0.5 text-[10px]">
                      Pendente
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(photo.preview);
                        setPendingPhotos((current) =>
                          current.filter((item) => item.id !== photo.id),
                        );
                      }}
                      className="absolute right-1 top-1 rounded bg-background/80 p-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                      aria-label="Remover foto adicionada"
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="variacoes">
          <div className="glass-panel max-w-3xl rounded-lg p-5">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome da variação</Label>
                <Input
                  value={variantName}
                  onChange={(event) => setVariantName(event.target.value)}
                  placeholder="Preto / M"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">SKU da variação</Label>
                <Input value={variantSku} onChange={(event) => setVariantSku(event.target.value)} />
              </div>
              <Button size="sm" onClick={addVariant} disabled={saving}>
                <Plus className="size-3.5" />
                Adicionar
              </Button>
            </div>

            <div className="mt-5">
              {product.product_variants.length === 0 && pendingVariants.length === 0 ? (
                <EmptyState
                  compact
                  title="Sem variações"
                  description="O produto usa um SKU único."
                />
              ) : (
                <ul className="divide-y divide-border text-xs">
                  {product.product_variants.map((variant) => (
                    <li key={variant.id} className="flex items-center justify-between py-2">
                      <span>{variant.name}</span>
                      <span className="numeric text-muted-foreground">{variant.sku ?? "—"}</span>
                    </li>
                  ))}
                  {pendingVariants.map((variant) => (
                    <li key={variant.id} className="flex items-center justify-between py-2">
                      <span>
                        {variant.name} <span className="text-muted-foreground">· pendente</span>
                      </span>
                      <span className="numeric text-muted-foreground">{variant.sku ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="estoque">
          <div className="glass-panel max-w-3xl rounded-lg p-5">
            <div className="flex items-end gap-2">
              <div className="w-40 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Entrada de estoque</Label>
                <Input
                  value={stockInput}
                  onChange={(event) => setStockInput(event.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                />
              </div>
              <Button size="sm" onClick={() => addStock(null)} disabled={saving}>
                Lançar entrada
              </Button>
            </div>

            <div className="mt-5 text-xs">
              {pendingStock > 0 ? (
                <p className="mb-3 rounded-md border border-border px-3 py-2">
                  Entrada inicial pendente: <strong>{formatNumber(pendingStock)} un.</strong> Será
                  registrada ao salvar o produto.
                </p>
              ) : null}
              {product.inventory_balances.length === 0 && pendingStock === 0 ? (
                <EmptyState
                  compact
                  title="Sem saldo registrado"
                  description="Lance uma entrada agora para registrá-la junto com o produto."
                />
              ) : product.inventory_balances.length > 0 ? (
                <ul className="divide-y divide-border">
                  {product.inventory_balances.map((balance) => (
                    <li key={balance.id} className="flex items-center justify-between py-2">
                      <span>{balance.variant_id ? "Variação" : "Produto principal"}</span>
                      <span className="numeric">{formatNumber(balance.quantity)} un.</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
