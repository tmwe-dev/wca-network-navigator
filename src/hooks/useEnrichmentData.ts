/**
 * useEnrichmentData — All state + data queries for EnrichmentSettings
 */
import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractDomainFromEmail, isPersonalEmail } from "@/components/ui/CompanyLogo";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";

export interface EnrichedRow {
  id: string;
  name: string;
  domain: string | null;
  source: string;
  hasLogo: boolean;
  hasLinkedin: boolean;
  hasWebsiteExcerpt?: boolean;
  linkedinUrl?: string;
  email?: string;
  country?: string;
  realId?: string;
  emailCount?: number;
}

export type SourceTab = "all" | "wca" | "contacts" | "email" | "cockpit" | "bca";
export type EnrichFilter = "all" | "with-logo" | "no-logo" | "with-linkedin" | "no-linkedin" | "with-domain" | "no-domain";
export type SortField = "name" | "domain" | "source" | "emailCount";
export type SortDir = "asc" | "desc";

// ── DB row interfaces ──

interface PartnerRow {
  id: string;
  company_name: string;
  email: string | null;
  website: string | null;
  country_code: string | null;
  logo_url: string | null;
  enrichment_data: Record<string, unknown> | null;
}

interface ContactRow {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
  enrichment_data: Record<string, unknown> | null;
  country: string | null;
}

interface BcaRow {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  location: string | null;
  matched_partner_id: string | null;
}

interface EmailSenderRow {
  from_address: string | null;
}

interface CockpitQueueRow {
  id: string;
  source_id: string;
  source_type: string;
  partner_id: string | null;
  status: string;
}

interface PartnerLookupRow {
  id: string;
  company_name: string;
  email: string | null;
  website: string | null;
}

interface ContactLookupRow {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
}

/**
 * Iterative batch loader — fetches ALL rows from a table.
 * Supabase impone un cap implicito di 1000 righe per query: usiamo limit() esplicito
 * + range() per paginare e raccogliere il dataset reale (non più cappato a 1000).
 */
async function loadAllRows<T>(
  table: string,
  select: string,
  filters?: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>,
  batchSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let page = 0;
  // Hard safety stop: 200 pagine = 200k righe max
  while (page < 200) {
    let q = supabase.from(table as "partners").select(select) as unknown as ReturnType<typeof supabase.from>;
    if (filters) q = filters(q);
    const from = page * batchSize;
    const to = from + batchSize - 1;
    const { data, error } = await (q as unknown as {
      range: (a: number, b: number) => { limit: (n: number) => Promise<{ data: T[] | null; error: { message: string } | null }> }
    }).range(from, to).limit(batchSize);
    if (error) throw error;
    if (data && data.length) all.push(...data);
    if (!data || data.length < batchSize) break;
    page++;
  }
  return all;
}

export function useEnrichmentData() {
  const linkedInLookup = useLinkedInLookup();
  const deepSearch = useDeepSearch();
  const queryClient = useQueryClient();

  const [sourceTab, setSourceTab] = useState<SourceTab>("all");
  const [enrichFilter, setEnrichFilter] = useState<EnrichFilter>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dsDialogOpen, setDsDialogOpen] = useState(false);
  const [dsTargetIds, setDsTargetIds] = useState<string[]>([]);
  const [dsMode, setDsMode] = useState<"partner" | "contact">("partner");

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }, [sortField]);

  // ── Data queries ──

  const { data: partners = [], refetch: refetchPartners } = useQuery({
    queryKey: queryKeys.partners.enrichment(),
    queryFn: async () => {
      const data = await loadAllRows<PartnerRow>("partners", "id, company_name, email, website, country_code, logo_url, enrichment_data");
      return data.map((p): EnrichedRow => {
        const ed = (p.enrichment_data || {}) as Record<string, unknown>;
        const liUrl = (ed.linkedin_url as string) || null;
        return {
          id: p.id, name: p.company_name,
          domain: p.website?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || extractDomainFromEmail(p.email || ""),
          source: "wca", hasLogo: !!p.logo_url, hasLinkedin: !!liUrl,
          hasWebsiteExcerpt: !!ed.website_excerpt,
          linkedinUrl: liUrl || undefined,
          email: p.email || undefined, country: p.country_code || undefined, realId: p.id,
        };
      });
    },
    staleTime: 60_000,
  });

  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: queryKeys.enrichment.contacts(),
    queryFn: async () => {
      const data = await loadAllRows<ContactRow>(
        "imported_contacts",
        "id, name, company_name, email, enrichment_data, country",
        (q) => (q as unknown as { or: (f: string) => typeof q }).or("name.not.is.null,company_name.not.is.null,email.not.is.null") as unknown as typeof q
      );
      return data.map((c): EnrichedRow => {
        const ed = (c.enrichment_data || {}) as Record<string, string | Record<string, string>>;
        const liUrl = (ed.linkedin_profile_url as string) || (ed.linkedin_url as string) || (ed.social_links as Record<string, string>)?.linkedin || null;
        return {
          id: c.id, name: c.name || c.company_name || c.email || "?",
          domain: extractDomainFromEmail(c.email || ""),
          source: "contacts", hasLogo: false, hasLinkedin: !!liUrl,
          linkedinUrl: liUrl || undefined, email: c.email || undefined,
          country: c.country || undefined, realId: c.id,
        };
      });
    },
    staleTime: 60_000,
  });

  const { data: bcaItems = [] } = useQuery({
    queryKey: queryKeys.enrichment.bca(),
    queryFn: async () => {
      const data = await loadAllRows<BcaRow>(
        "business_cards",
        "id, company_name, contact_name, email, phone, mobile, location, matched_partner_id"
      );
      // Join sui partner matchati per ricavare country + logo
      const partnerIds = [...new Set(data.filter(b => b.matched_partner_id).map(b => b.matched_partner_id!))];
      const pMap = new Map<string, { country_code: string | null; website: string | null; logo_url: string | null }>();
      if (partnerIds.length > 0) {
        // Batch in chunk da 200 per evitare URL troppo lunghi
        for (let i = 0; i < partnerIds.length; i += 200) {
          const slice = partnerIds.slice(i, i + 200);
          const { data: pData } = await supabase
            .from("partners")
            .select("id, country_code, website, logo_url")
            .in("id", slice);
          (pData || []).forEach(p => pMap.set(p.id, { country_code: p.country_code, website: p.website, logo_url: p.logo_url }));
        }
      }
      return data.map((b): EnrichedRow => {
        const p = b.matched_partner_id ? pMap.get(b.matched_partner_id) : null;
        // Estrai country da location (es. "Bangkok, Thailand" → ultimo segmento)
        const locCountry = b.location?.split(",").pop()?.trim();
        return {
          id: b.id, name: b.company_name || b.contact_name || b.email || "?",
          domain: p?.website?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || extractDomainFromEmail(b.email || ""),
          source: "bca", hasLogo: !!p?.logo_url, hasLinkedin: false,
          email: b.email || undefined,
          country: p?.country_code || locCountry || undefined,
          realId: b.id,
        };
      });
    },
    staleTime: 60_000,
  });

  const { data: emailSenders = [] } = useQuery({
    queryKey: queryKeys.enrichment.emailSenders(),
    queryFn: async () => {
      const data = await loadAllRows<EmailSenderRow>(
        "channel_messages", "from_address",
        (q) => (q as unknown as { not: (col: string, op: string, val: null) => typeof q }).not("from_address", "is", null) as unknown as typeof q
      );
      const addressMap = new Map<string, number>();
      for (const row of data) {
        const addr = (row.from_address || "").toLowerCase().trim();
        if (addr) addressMap.set(addr, (addressMap.get(addr) || 0) + 1);
      }
      const senderRows: EnrichedRow[] = [];
      const seen = new Set<string>();
      const sorted = [...addressMap.entries()].sort((a, b) => b[1] - a[1]);
      for (const [addr, count] of sorted) {
        const domain = extractDomainFromEmail(addr);
        if (!domain || isPersonalEmail(domain)) continue;
        if (seen.has(addr)) continue;
        seen.add(addr);
        senderRows.push({
          id: `email-${addr}`,
          name: addr.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          domain, source: "email", hasLogo: false, hasLinkedin: false,
          email: addr, emailCount: count,
        });
      }
      return senderRows;
    },
    staleTime: 60_000,
  });

  const { data: cockpitItems = [] } = useQuery({
    queryKey: queryKeys.enrichment.cockpit(),
    queryFn: async () => {
      const queue = await loadAllRows<CockpitQueueRow>("cockpit_queue", "id, source_id, source_type, partner_id, status");
      if (!queue.length) return [];
      const partnerIds = [...new Set(queue.filter(q => q.partner_id).map(q => q.partner_id!))];
      const contactIds = [...new Set(queue.filter(q => q.source_type === "contact").map(q => q.source_id))];
      const fetchPartnerBatch = async (ids: string[]) => {
        const { getPartnersByIds } = await import("@/data/partners");
        return await getPartnersByIds(ids, "id, company_name, email, website") as unknown as PartnerLookupRow[];
      };
      const fetchContactBatch = async (ids: string[]) => {
        const { getContactsByIds } = await import("@/data/contacts");
        return await getContactsByIds(ids, "id, name, company_name, email") as unknown as ContactLookupRow[];
      };
      const [pData, cData] = await Promise.all([
        partnerIds.length ? fetchPartnerBatch(partnerIds) : [],
        contactIds.length ? fetchContactBatch(contactIds) : [],
      ]);
      const pMap = new Map(pData.map(p => [p.id, p]));
      const cMap = new Map(cData.map(c => [c.id, c]));
      return queue.map((q): EnrichedRow => {
        const partner = q.partner_id ? pMap.get(q.partner_id) : null;
        const contact = q.source_type === "contact" ? cMap.get(q.source_id) : null;
        const name = partner?.company_name || contact?.name || contact?.company_name || q.source_id.slice(0, 8);
        const email = partner?.email || contact?.email || undefined;
        const domain = partner?.website?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || extractDomainFromEmail(email || "");
        return { id: `cockpit-${q.id}`, name, domain: domain || null, source: "cockpit", hasLogo: false, hasLinkedin: false, email };
      });
    },
    staleTime: 60_000,
  });

  // ── Derived ──

  const sourceCounts = useMemo(() => {
    const emailTotal = emailSenders.reduce((sum, r) => sum + (r.emailCount || 0), 0);
    return {
      all: partners.length + contacts.length + bcaItems.length + emailSenders.length + cockpitItems.length,
      wca: partners.length, contacts: contacts.length, bca: bcaItems.length,
      email: emailSenders.length, emailTotal, cockpit: cockpitItems.length,
    };
  }, [partners, contacts, bcaItems, emailSenders, cockpitItems]);

  const allRows = useMemo(() => {
    let rows: EnrichedRow[] = [];
    if (sourceTab === "all" || sourceTab === "wca") rows.push(...partners);
    if (sourceTab === "all" || sourceTab === "contacts") rows.push(...contacts);
    if (sourceTab === "all" || sourceTab === "bca") rows.push(...bcaItems);
    if (sourceTab === "all" || sourceTab === "email") rows.push(...emailSenders);
    if (sourceTab === "all" || sourceTab === "cockpit") rows.push(...cockpitItems);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.domain?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q));
    }
    switch (enrichFilter) {
      case "with-logo": rows = rows.filter(r => r.hasLogo); break;
      case "no-logo": rows = rows.filter(r => !r.hasLogo); break;
      case "with-linkedin": rows = rows.filter(r => r.hasLinkedin); break;
      case "no-linkedin": rows = rows.filter(r => !r.hasLinkedin); break;
      case "with-domain": rows = rows.filter(r => !!r.domain); break;
      case "no-domain": rows = rows.filter(r => !r.domain); break;
    }
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "domain") cmp = (a.domain || "").localeCompare(b.domain || "");
      else if (sortField === "source") cmp = a.source.localeCompare(b.source);
      else if (sortField === "emailCount") cmp = (a.emailCount || 0) - (b.emailCount || 0);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return rows;
  }, [partners, contacts, bcaItems, emailSenders, cockpitItems, sourceTab, search, enrichFilter, sortField, sortDir]);

  const stats = useMemo(() => ({
    total: allRows.length,
    withLogo: allRows.filter(r => r.hasLogo).length,
    withDomain: allRows.filter(r => r.domain).length,
    withLinkedin: allRows.filter(r => r.hasLinkedin).length,
  }), [allRows]);

  const allSelected = allRows.length > 0 && allRows.every(r => selected.has(r.id));
  const someSelected = allRows.some(r => selected.has(r.id));
  const selectedCount = allRows.filter(r => selected.has(r.id)).length;

  const toggleAll = useCallback(() => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allRows.map(r => r.id)));
  }, [allSelected, allRows]);

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const getSelectedRows = useCallback(() => allRows.filter(r => selected.has(r.id)), [allRows, selected]);

  const openDeepSearchDialog = useCallback((rows: EnrichedRow[]) => {
    const ids = rows.map(r => r.realId || r.id);
    const isContact = rows.some(r => r.source === "contacts" || r.source === "bca");
    setDsTargetIds(ids);
    setDsMode(isContact ? "contact" : "partner");
    setDsDialogOpen(true);
  }, []);

  const handleDeepSearchConfirm = useCallback((_options: Record<string, boolean>) => {
    setDsDialogOpen(false);
    if (dsTargetIds.length > 0) {
      deepSearch.start(dsTargetIds, true, dsMode);
    }
  }, [dsTargetIds, dsMode, deepSearch]);

  const handleLinkedInBatch = useCallback(async () => {
    const rows = getSelectedRows().filter(r => r.source === "contacts" && !r.hasLinkedin);
    if (!rows.length) { toast({ title: "Nessun contatto senza LinkedIn nella selezione" }); return; }
    if (!linkedInLookup.isAvailable) { toast({ title: "Partner Connect non disponibile", variant: "destructive" }); return; }
    await linkedInLookup.lookupBatch(rows.map(r => r.realId || r.id));
    refetchContacts();
  }, [getSelectedRows, linkedInLookup, refetchContacts]);

  const handleBulkLogoSearch = useCallback(() => {
    const rows = getSelectedRows();
    if (!rows.length) return;
    const toOpen = rows.slice(0, 5);
    toOpen.forEach(r => {
      const query = encodeURIComponent(`${r.name} company logo`);
      window.open(`https://www.google.com/search?tbm=isch&q=${query}`, "_blank");
    });
    if (rows.length > 5) {
      toast({ title: `Aperte ${toOpen.length} ricerche, ${rows.length - 5} rimanenti (limite browser)` });
    }
  }, [getSelectedRows]);

  const changeSourceTab = useCallback((tab: SourceTab) => {
    setSourceTab(tab);
    setSelected(new Set());
  }, []);

  return {
    // Filter state
    sourceTab, enrichFilter, search, sortField, sortDir, selected,
    // Deep search dialog
    dsDialogOpen, dsTargetIds, dsMode, setDsDialogOpen,
    // Derived
    sourceCounts, allRows, stats, allSelected, someSelected, selectedCount,
    // Actions
    changeSourceTab, setEnrichFilter, setSearch, toggleSort, toggleAll, toggleOne,
    openDeepSearchDialog, handleDeepSearchConfirm, handleLinkedInBatch, handleBulkLogoSearch,
    getSelectedRows,
    // Refetch
    refetchPartners, refetchContacts,
    // External hooks
    deepSearch,
  };
}
