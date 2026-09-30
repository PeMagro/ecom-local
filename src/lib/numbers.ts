/** Regras puras de entrada numérica do formulário (sem rede/banco). */

/** Decimal >= 0 com vírgula ou ponto ("19,90", "19.90", "1.234,56"). null se inválido. */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim();
  let normalized: string | null = null;
  if (/^\d+(?:[.,]\d+)?$/.test(s)) normalized = s.replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) normalized = s.replace(/\./g, "").replace(",", ".");
  if (normalized === null) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Inteiro seguro estritamente maior que zero. null se inválido. */
export function parsePositiveInt(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Código de barras: string só de dígitos, até 14 (zeros à esquerda preservados). */
export function isValidBarcode(raw: string): boolean {
  return /^\d{8,14}$/.test(raw.trim());
}

/** Durante a digitação: mantém só dígitos ASCII 0-9, até 14 (zeros à esquerda preservados). */
export function sanitizeBarcodeInput(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(0, 14);
}

/** Durante a digitação: mantém só dígitos ASCII 0-9, vírgula e ponto. */
export function sanitizeDecimalInput(raw: string): string {
  return raw.replace(/[^0-9.,]/g, "");
}
