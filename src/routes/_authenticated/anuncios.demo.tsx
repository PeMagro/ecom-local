import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/anuncios/demo")({
  validateSearch: (search: Record<string, unknown>) => ({ productId: typeof search["productId"] === "string" ? search["productId"] : undefined }),
  beforeLoad: ({ search }) => { throw redirect({ to: "/anuncios/novo", search: { productId: search.productId } }); },
});
