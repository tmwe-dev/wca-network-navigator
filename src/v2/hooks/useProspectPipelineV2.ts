/**
 * useProspectPipelineV2 — Imported contacts pipeline view
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { findProspectPipeline } from "@/data/importedContactsV2";

interface ProspectContact {
  readonly id: string;
  readonly name: string | null;
  readonly companyName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly mobile: string | null;
  readonly leadStatus: string;
  readonly country: string | null;
  readonly origin: string | null;
  readonly createdAt: string;
}

export function useProspectPipelineV2(status?: string, search?: string) {
  return useQuery({
    queryKey: queryKeys.v2.prospectPipeline(status ?? "all", search ?? ""),
    queryFn: async (): Promise<readonly ProspectContact[]> => {
      const data = await findProspectPipeline(status, search);
      return data.map((c) => ({
        id: c.id,
        name: c.name,
        companyName: c.company_name,
        email: c.email,
        phone: c.phone,
        mobile: c.mobile,
        leadStatus: c.lead_status,
        country: c.country,
        origin: c.origin,
        createdAt: c.created_at,
      }));
    },
  });
}

export type { ProspectContact };
