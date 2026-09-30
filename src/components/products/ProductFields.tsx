import { Input } from "@/components/ui/input";
import { isValidBarcode, parseDecimal, sanitizeBarcodeInput, sanitizeDecimalInput } from "@/lib/numbers";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProductFormValues = {
  name: string;
  sku: string;
  barcode: string;
  description: string;
  category: string;
  brand: string;
  status: "active" | "inactive" | "archived";
  price: string;
  cost: string;
  weight_grams: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  low_stock_threshold: string;
};

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  sku: "",
  barcode: "",
  description: "",
  category: "",
  brand: "",
  status: "active",
  price: "",
  cost: "",
  weight_grams: "",
  length_cm: "",
  width_cm: "",
  height_cm: "",
  low_stock_threshold: "5",
};

export function validateProduct(values: ProductFormValues) {
  const errors: Partial<Record<keyof ProductFormValues, string>> = {};
  if (values.name.trim().length < 2) errors.name = "Informe o nome do produto.";
  if (!values.sku.trim()) errors.sku = "Informe o SKU do produto.";
  if (values.price.trim() && parseDecimal(values.price) === null)
    errors.price = "Preço inválido. Use só números, ex.: 19,90 ou 19.90.";
  if (values.cost.trim() && parseDecimal(values.cost) === null)
    errors.cost = "Custo inválido. Use só números, ex.: 12,50 ou 12.50.";
  if (values.barcode.trim() && !isValidBarcode(values.barcode))
    errors.barcode = "Use somente dígitos: de 8 a 14 números.";
  return errors;
}

/** Converte campo decimal opcional; só chamar após validateProduct. */
export function decimalOrNull(raw: string) {
  return raw.trim() ? parseDecimal(raw) : null;
}

export function ProductFields({
  values,
  errors,
  onChange,
}: {
  values: ProductFormValues;
  errors: Partial<Record<keyof ProductFormValues, string>>;
  onChange: (patch: Partial<ProductFormValues>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field className="sm:col-span-2" label="Nome do produto" error={errors.name}>
        <Input
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Fone de ouvido bluetooth XZ-200"
        />
      </Field>

      <Field label="SKU" error={errors.sku}>
        <Input
          value={values.sku}
          onChange={(event) => onChange({ sku: event.target.value })}
          placeholder="XZ-200-PRETO"
        />
      </Field>

      <Field label="Código de barras (EAN/GTIN)" error={errors.barcode}>
        <Input
          value={values.barcode}
          onChange={(event) => onChange({ barcode: sanitizeBarcodeInput(event.target.value) })}
          inputMode="numeric"
          maxLength={14}
          aria-invalid={errors.barcode ? true : undefined}
          placeholder="7891234567890"
        />
      </Field>

      <Field label="Categoria">
        <Input
          value={values.category}
          onChange={(event) => onChange({ category: event.target.value })}
          placeholder="Eletrônicos / Áudio"
        />
      </Field>

      <Field label="Marca">
        <Input
          value={values.brand}
          onChange={(event) => onChange({ brand: event.target.value })}
        />
      </Field>

      <Field className="sm:col-span-2" label="Descrição">
        <Textarea
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={5}
          placeholder="Descrição completa usada como base para os anúncios."
        />
      </Field>

      <Field label="Preço de venda (R$)" error={errors.price}>
        <Input
          value={values.price}
          onChange={(event) => onChange({ price: sanitizeDecimalInput(event.target.value) })}
          inputMode="decimal"
        />
      </Field>

      <Field label="Custo (R$)" error={errors.cost}>
        <Input
          value={values.cost}
          onChange={(event) => onChange({ cost: sanitizeDecimalInput(event.target.value) })}
          inputMode="decimal"
        />
      </Field>

      <Field label="Peso (g)">
        <Input
          value={values.weight_grams}
          onChange={(event) => onChange({ weight_grams: event.target.value })}
          inputMode="decimal"
        />
      </Field>

      <Field label="Alerta de estoque baixo">
        <Input
          value={values.low_stock_threshold}
          onChange={(event) => onChange({ low_stock_threshold: event.target.value })}
          inputMode="numeric"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-3">
        <Field label="Comprimento (cm)">
          <Input
            value={values.length_cm}
            onChange={(event) => onChange({ length_cm: event.target.value })}
            inputMode="decimal"
          />
        </Field>
        <Field label="Largura (cm)">
          <Input
            value={values.width_cm}
            onChange={(event) => onChange({ width_cm: event.target.value })}
            inputMode="decimal"
          />
        </Field>
        <Field label="Altura (cm)">
          <Input
            value={values.height_cm}
            onChange={(event) => onChange({ height_cm: event.target.value })}
            inputMode="decimal"
          />
        </Field>
      </div>

      <Field label="Situação">
        <Select
          value={values.status}
          onValueChange={(value) => onChange({ status: value as ProductFormValues["status"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
            <SelectItem value="archived">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string | undefined;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
