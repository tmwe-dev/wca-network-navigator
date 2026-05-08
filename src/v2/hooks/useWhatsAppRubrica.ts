import { useQuery } from "@tanstack/react-query";
import { listWhatsAppAddresses, whatsappAddressKeys, type WhatsAppAddressRow } from "@/data/whatsappAddresses";

export function useWhatsAppRubrica(search: string) {
  return useQuery({
    queryKey: whatsappAddressKeys.list(search),
    queryFn: (): Promise<WhatsAppAddressRow[]> => listWhatsAppAddresses({ search }),
    staleTime: 30_000,
  });
}