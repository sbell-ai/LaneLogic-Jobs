import { useQuery } from "@tanstack/react-query";
import type { CredentialType, ModalNamespace } from "@shared/schema";

export function useCredentialTypes(namespace?: ModalNamespace) {
  const url = namespace ? `/api/credential-types?namespace=${namespace}` : "/api/credential-types";
  return useQuery<CredentialType[]>({
    queryKey: ["/api/credential-types", namespace ?? "all"],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch credential types");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
