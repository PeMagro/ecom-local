// Dados reais do produto "Teclado Teste" (tabela products no SQLite local),
// usados para simular como o anúncio apareceria na Shopee e na Amazon.
export const DEMO_PRODUCT = {
  name: "Teclado Teste",
  description: "Teclado para Teste",
  brand: "Teste",
  category: "Eletrônicos",
  sku: "XZ-200-PRDLC",
  ean: "123321123321",
  price: 500,
  weightGrams: 2000,
  stock: 50,
  variants: [
    { name: "Branco", sku: "XZ-321-PRDLC" },
    { name: "Preto", sku: "xz-123-PRDLC" },
  ],
} as const;

export type DemoVariant = (typeof DEMO_PRODUCT.variants)[number];
