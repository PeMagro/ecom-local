import { createFileRoute } from "@tanstack/react-router";
import { ProductEditor } from "@/components/products/ProductEditor";
export const Route = createFileRoute("/_authenticated/produtos/$productId")({
  head: () => ({ meta: [{ title: "Editar produto | ECOM" }] }),
  component: ProductDetail,
});
function ProductDetail() { const { productId } = Route.useParams(); return <ProductEditor productId={productId} />; }
