import { useQuery } from "@tanstack/react-query";

import { getSellerSettings } from "@/lib/settings.functions";

export function useSellerSettings() {
  return useQuery({
    queryKey: ["seller_settings"],
    queryFn: () => getSellerSettings(),
  });
}
