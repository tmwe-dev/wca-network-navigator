import { useQuery } from "@tanstack/react-query";
import { listLinkedInAddresses, linkedinAddressKeys, type LinkedInAddressRow } from "@/data/linkedinAddresses";

export function useLinkedInRubrica(search: string) {
  return useQuery({
    queryKey: linkedinAddressKeys.list(search),
    queryFn: (): Promise<LinkedInAddressRow[]> => listLinkedInAddresses({ search }),
    staleTime: 30_000,
  });
}