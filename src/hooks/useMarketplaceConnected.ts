import { useQuery } from "@tanstack/react-query";

import { getMarketplaceConnection } from "@/lib/integrations.functions";
import { usePresentation } from "@/hooks/usePresentation";

/** True once the user has connected Mercado Livre for real, or a demo channel (Shopee/Amazon). */
export function useAnyMarketplaceConnected() {
  const presentation = usePresentation();
  const mlConnection = useQuery({
    queryKey: ["marketplace-connection", "mercado_livre"],
    queryFn: () => getMarketplaceConnection({ data: { marketplace: "mercado_livre" } }),
  });

  const ready = presentation.ready && !mlConnection.isLoading;
  const connected = mlConnection.data?.status === "connected" || presentation.channels.length > 0;

  return { ready, connected };
}
