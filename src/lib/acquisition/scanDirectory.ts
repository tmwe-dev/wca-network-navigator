/**
 * Directory scanning logic — extracted from useAcquisitionPipeline.tsx
 * Pure async function that returns scan results without managing React state.
 */
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { isApiError } from "@/lib/api/apiError";
import { createLogger } from "@/lib/log";
import type { QueueItem } from "@/components/acquisition/types";
import type { ScanStats } from "@/hooks/useAcquisitionPipeline";
import { upsertDirectoryCache } from "@/data/directoryCache";
import { findPartnerContacts, findPartnerNetworks, findPartnerServices, findPartnerSocialLinks } from "@/data/partnerRelations";
import { asEnrichment } from "@/lib/partnerUtils";

const log = createLogger("scanDirectory");

export interface ScanResult {
  queue: QueueItem[];
  scanStats: ScanStats;
  selectedIds: Set<number>;
}

export async function scanDirectory(
  selectedCountries: string[],
  selectedNetworks: string[],
): Promise<ScanResult> {
  const allMembers: QueueItem[] = [];
  const existingWcaIds = new Set<number>();

  // Gather existing partner WCA IDs
  for (const code of selectedCountries) {
    const { data: partners } = await supabase
      .from("partners")
      .select("wca_id")
      .eq("country_code", code)
      .not("wca_id", "is", null);
    partners?.forEach((p) => {
      if (p.wca_id) existingWcaIds.add(p.wca_id);
    });
  }

  // Scan each country × network combination
  for (const code of selectedCountries) {
    const networkFilter = selectedNetworks.length > 0 ? selectedNetworks : [""];

    for (const net of networkFilter) {
      const { data: cached } = await supabase
        .from("directory_cache")
        .select("*")
        .eq("country_code", code)
        .eq("network_name", net);

      if (cached && cached.length > 0) {
        for (const entry of cached) {
          const members = (entry.members as Array<Record<string, unknown>>) || [];
          members.forEach((m) => {
            const wcaId = m.wca_id as number | undefined;
            if (wcaId && !allMembers.find((x) => x.wca_id === wcaId)) {
              allMembers.push({
                wca_id: wcaId,
                company_name: (m.company_name as string) || `WCA ${wcaId}`,
                country_code: code,
                city: (m.city as string) || "",
                status: "pending",
                alreadyDownloaded: existingWcaIds.has(wcaId),
              });
            }
          });
        }
      } else {
        type ScrapeResult = { members?: Array<{ wca_id: number; company_name?: string; city?: string }> };
        let scanResult: ScrapeResult | null = null;
        try {
          scanResult = await invokeEdge<ScrapeResult>("scrape-wca-directory", {
            body: { countryCode: code, network: net },
            context: "scanDirectory",
          });
        } catch (err) {
          // Vol. II §4.4: errori transient di scan non devono bloccare
          // l'intero ciclo di paesi/network. Loggiamo e continuiamo.
          if (isApiError(err)) {
            log.warn("scrape-wca-directory failed", { code, net, errCode: err.code });
          } else {
            log.warn("scrape-wca-directory unknown error", { code, net });
          }
          scanResult = null;
        }

        if (scanResult?.members) {
          const membersJson = scanResult.members.map((m) => ({
            company_name: m.company_name,
            city: m.city,
            country_code: code,
            wca_id: m.wca_id,
          }));
          await upsertDirectoryCache({
              country_code: code,
              network_name: net,
              members: membersJson as unknown as Record<string, unknown>[],
              total_results: scanResult.members.length,
              scanned_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          scanResult.members.forEach((m) => {
            if (m.wca_id && !allMembers.find((x) => x.wca_id === m.wca_id)) {
              allMembers.push({
                wca_id: m.wca_id,
                company_name: m.company_name || `WCA ${m.wca_id}`,
                country_code: code,
                city: m.city || "",
                status: "pending",
                alreadyDownloaded: existingWcaIds.has(m.wca_id),
              });
            }
          });
        }
      }
    }
  }

  const existing = allMembers.filter((m) => m.alreadyDownloaded).length;
  const scanStats: ScanStats = { total: allMembers.length, existing, missing: allMembers.length - existing };
  const selectedIds = new Set(allMembers.filter((m) => !m.alreadyDownloaded).map((m) => m.wca_id));

  return { queue: allMembers, scanStats, selectedIds };
}

/**
 * Enrich queue items with network data from existing partners.
 */
export async function enrichQueueWithNetworks(
  queue: QueueItem[],
): Promise<Record<number, string[]>> {
  const wcaIdsInDb = queue.filter(m => m.alreadyDownloaded).map(m => m.wca_id);
  if (wcaIdsInDb.length === 0) return {};

  try {
    const { data: partnersWithIds } = await supabase
      .from("partners")
      .select("id, wca_id")
      .in("wca_id", wcaIdsInDb);

    if (!partnersWithIds || partnersWithIds.length === 0) return {};

    const partnerIds = partnersWithIds.map(p => p.id);
    const { data: networkRows } = await supabase
      .from("partner_networks")
      .select("partner_id, network_name")
      .in("partner_id", partnerIds);

    if (!networkRows) return {};

    const wcaIdToNetworks: Record<number, string[]> = {};
    for (const nr of networkRows) {
      const p = partnersWithIds.find(pp => pp.id === nr.partner_id);
      if (p?.wca_id) {
        if (!wcaIdToNetworks[p.wca_id]) wcaIdToNetworks[p.wca_id] = [];
        wcaIdToNetworks[p.wca_id].push(nr.network_name);
      }
    }
    return wcaIdToNetworks;
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return {};
  }
}

/**
 * Load full partner preview data for a given WCA ID.
 */
export async function loadPartnerPreview(wcaId: number) {
  const { findPartnerByWcaId } = await import("@/data/partners");
  const partner = await findPartnerByWcaId(wcaId);
  if (!partner) return null;

  const [contacts, nets, svcs, socialLinks] = await Promise.all([
    findPartnerContacts(partner.id, "name, title, email, direct_phone, mobile"),
    findPartnerNetworks(partner.id),
    findPartnerServices(partner.id),
    findPartnerSocialLinks(partner.id),
  ]);

  interface SocialLinkRow { platform?: string; url?: string; [key: string]: unknown }
  const ed = asEnrichment(partner.enrichment_data);

  return {
    company_name: partner.company_name,
    city: partner.city,
    country_code: partner.country_code,
    country_name: partner.country_name,
    logo_url: partner.logo_url || undefined,
    contacts: (contacts || []).map(c => ({ name: c.name, title: c.title || undefined, email: c.email || undefined, direct_phone: c.direct_phone || undefined, mobile: c.mobile || undefined })),
    services: (svcs || []).map(s => s.service_category),
    key_markets: (ed as Record<string, unknown>)?.key_markets as string[] || [],
    key_routes: (ed as Record<string, unknown>)?.key_routes as string[] || [],
    networks: (nets || []).map(n => n.network_name),
    rating: partner.rating ? Number(partner.rating) : undefined,
    website: partner.website || undefined,
    profile_description: partner.profile_description || undefined,
    linkedin_links: ((socialLinks || []) as SocialLinkRow[]).filter((l) => l.platform === "linkedin").map((l) => ({ name: "LinkedIn", url: l.url })),
    warehouse_sqm: (ed as Record<string, unknown>)?.warehouse_sqm as number | undefined,
    employees: (ed as Record<string, unknown>)?.employee_count as number | undefined,
    founded: (ed as Record<string, unknown>)?.founding_year ? String((ed as Record<string, unknown>).founding_year) : undefined,
    fleet: (ed as Record<string, unknown>)?.has_own_fleet ? ((ed as Record<string, unknown>).fleet_details as string || "Sì") : undefined,
    contactSource: "extension" as const,
  };
}
