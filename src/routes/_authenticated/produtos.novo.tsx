import { createFileRoute } from "@tanstack/react-router";
import { ProductEditor } from "@/components/products/ProductEditor";
export const Route = createFileRoute("/_authenticated/produtos/novo")({
  head: () => ({ meta: [{ title: "Novo produto | ECOM" }] }),
  component: () => <ProductEditor />,
});
