import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth.functions";

type AuthUser = { id: string; email: string; fullName: string | null };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => getCurrentUser(),
    staleTime: 60_000,
  });

  const value = useMemo(
    () => ({ user: query.data?.user ?? null, loading: query.isLoading }),
    [query.data, query.isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
