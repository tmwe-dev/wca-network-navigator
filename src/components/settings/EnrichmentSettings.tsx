import { useState, useMemo, useCallback, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CompanyLogo, extractDomainFromEmail, isPersonalEmail } from "@/components/ui/CompanyLogo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2, Mail, CheckCircle2, Linkedin, Search, LayoutDashboard,
  Users, SortAsc, SortDesc, MoreVertical, Globe, ImageOff, XCircle,
  Filter, Brain, Download, CreditCard, Image,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { DeepSearchOptionsDialog } from "./enrichment/DeepSearchOptionsDialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Re-export kept for backward compat
export { EnrichmentFilters } from "./enrichment/EnrichmentFilters";
export type { SourceFilter, EnrichFilter, SortField, SortDir } from "./enrichment/EnrichmentFilters";

export interface EnrichedRow {
  id: string;
  name: string;
  domain: string | null;
  source: string;
  hasLogo: boolean;
  hasLinkedin: boolean;
  linkedinUrl?: string;
  email?: string;
  country?: string;
  /** Real DB id for actions (strip "cockpit-"/"email-" prefixes) */
  realId?: string;
  /** Number of emails received (for email senders) */
  emailCount?: number;
}

type SourceTab = "all" | "wca" | "contacts" | "email" | "cockpit" | "bca";
type EnrichFilter = "all" | "with-logo" | "no-logo" | "with-linkedin" | "no-linkedin" | "with-domain" | "no-domain";
type SortField = "name" | "domain" | "source" | "emailCount";
type SortDir = "asc" | "desc";

const SOURCE_TABS: { value: SourceTab; label: string; icon: ReactNode }[] = [
  { value: "all", label: "Tutti", icon: <Users className="w-3.5 h-3.5" /> },
  { value: "wca", label: "WCA", icon: <Building2 className="w-3.5 h-3.5" /> },
  { value: "contacts", label: "Contatti", icon: <Search className="w-3.5 h-3.5" /> },
  { value: "bca", label: "BCA", icon: <CreditCard className="w-3.5 h-3.5" /> },
  { value: "email", label: "Email", icon: <Mail className="w-3.5 h-3.5" /> },
  { value: "cockpit", label: "Cockpit", icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
];

const ENRICH_FILTERS: { value: EnrichFilter; label: string; icon: ReactNode }[] = [
  { value: "all", label: "Tutti", icon: <Filter className="w-3 h-3" /> },
  { value: "with-logo", label: "Con logo", icon: <CheckCircle2 className="w-3 h-3" /> },
  { value: "no-logo", label: "Senza logo", icon: <ImageOff className="w-3 h-3" /> },
  { value: "with-linkedin", label: "Con LinkedIn", icon: <Linkedin className="w-3 h-3" /> },
  { value: "no-linkedin", label: "Senza LinkedIn", icon: <XCircle className="w-3 h-3" /> },
  { value: "with-domain", label: "Con dominio", icon: <Globe className="w-3 h-3" /> },
  { value: "no-domain", label: "Senza dominio", icon: <XCircle className="w-3 h-3" /> },
];

const ORIGIN_ACCENT: Record<string, string> = {
  wca: "border-l-blue-500",
  contacts: "border-l-green-500",
  email: "border-l-amber-500",
  cockpit: "border-l-teal-500",
  bca: "border-l-purple-500",
};

const ORIGIN_BADGE_CLASS: Record<string, string> = {
  wca: "bg-blue-500/10 text-blue-700 border-blue-200",
  contacts: "bg-green-500/10 text-green-700 border-green-200",
  email: "bg-amber-500/10 text-amber-700 border-amber-200",
  cockpit: "bg-teal-500/10 text-teal-700 border-teal-200",
  bca: "bg-purple-500/10 text-purple-700 border-purple-200",
};

const COUNTRY_FLAGS: Record<string, string> = {
  AE: "🇦🇪", AR: "🇦🇷", AT: "🇦🇹", AU: "🇦🇺", BE: "🇧🇪", BG: "🇧🇬", BR: "🇧🇷",
  CA: "🇨🇦", CH: "🇨🇭", CL: "🇨🇱", CN: "🇨🇳", CO: "🇨🇴", CZ: "🇨🇿", DE: "🇩🇪",
  DK: "🇩🇰", EE: "🇪🇪", EG: "🇪🇬", ES: "🇪🇸", FI: "🇫🇮", FR: "🇫🇷", GB: "🇬🇧",
  GR: "🇬🇷", HK: "🇭🇰", HR: "🇭🇷", HU: "🇭🇺", ID: "🇮🇩", IE: "🇮🇪", IL: "🇮🇱",
  IN: "🇮🇳", IS: "🇮🇸", IT: "🇮🇹", JP: "🇯🇵", KE: "🇰🇪", KR: "🇰🇷", KW: "🇰🇼",
  LT: "🇱🇹", LU: "🇱🇺", LV: "🇱🇻", MA: "🇲🇦", MX: "🇲🇽", MY: "🇲🇾", NG: "🇳🇬",
  NL: "🇳🇱", NO: "🇳🇴", NZ: "🇳🇿", PE: "🇵🇪", PH: "🇵🇭", PK: "🇵🇰", PL: "🇵🇱",
  PT: "🇵🇹", QA: "🇶🇦", RO: "🇷🇴", RS: "🇷🇸", RU: "🇷🇺", SA: "🇸🇦", SE: "🇸🇪",
  SG: "🇸🇬", SI: "🇸🇮", SK: "🇸🇰", TH: "🇹🇭", TR: "🇹🇷", TW: "🇹🇼", UA: "🇺🇦",
  US: "🇺🇸", UY: "🇺🇾", VN: "🇻🇳", ZA: "🇿🇦",
};

function getFlag(code?: string): string {
  if (!code) return "";
  return COUNTRY_FLAGS[code.toUpperCase()] || "";
}

/** Iterative batch loader — fetches ALL rows from a table, 2000 at a time */
async function loadAllRows<T>(
  table: string,
  select: string,
  filters?: (q: any) => any,
  batchSize = 2000
): Promise<T[]> {
  const all: T[] = [];
  let page = 0;
  while (true) {
    let q = (supabase as any).from(table).select(select);
    if (filters) q = filters(q);
    q = q.range(page * batchSize, (page + 1) * batchSize - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (data) all.push(...data);
    if (!data || data.length < batchSize) break;
    page++;
  }
  return all;
}

function openGoogleLogoSearch(name: string) {
  const query = encodeURIComponent(`${name} company logo`);
  window.open(`https://www.google.com/search?tbm=isch&q=${query}`, "_blank");
}

export default function EnrichmentSettings() {
  const linkedInLookup = useLinkedInLookup();
  const deepSearch = useDeepSearch();

  // Internal filter state
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

  // ── Data queries with iterative batch loading ──

  const { data: partners = [] } = useQuery({
    queryKey: ["enrichment-partners"],
    queryFn: async () => {
      const data = await loadAllRows<any>("partners", "id, company_name, email, website, country_code, logo_url");
      return data.map((p: any): EnrichedRow => ({
        id: p.id, name: p.company_name,
        domain: p.website?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || extractDomainFromEmail(p.email || ""),
        source: "wca", hasLogo: !!p.logo_url, hasLinkedin: false,
        email: p.email || undefined, country: p.country_code || undefined,
        realId: p.id,
      }));
    },
    staleTime: 60_000,
  });

  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["enrichment-contacts"],
    queryFn: async () => {
      const data = await loadAllRows<any>(
        "imported_contacts",
        "id, name, company_name, email, enrichment_data, country",
        (q: any) => q.or("name.not.is.null,company_name.not.is.null,email.not.is.null")
      );
      return data.map((c: any): EnrichedRow => {
        const ed = (c.enrichment_data as Record<string, any>) || {};
        const liUrl = ed.linkedin_profile_url || ed.linkedin_url || ed.social_links?.linkedin || null;
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
    queryKey: ["enrichment-bca"],
    queryFn: async () => {
      const data = await loadAllRows<any>(
        "business_cards",
        "id, company_name, contact_name, email, phone, mobile, location, matched_partner_id"
      );
      return data.map((b: any): EnrichedRow => {
        const name = b.company_name || b.contact_name || b.email || "?";
        return {
          id: b.id, name,
          domain: extractDomainFromEmail(b.email || ""),
          source: "bca", hasLogo: false, hasLinkedin: false,
          email: b.email || undefined,
          country: undefined,
          realId: b.id,
        };
      });
    },
    staleTime: 60_000,
  });

  const { data: emailSenders = [] } = useQuery({
    queryKey: ["enrichment-email-senders"],
    queryFn: async () => {
      const data = await loadAllRows<any>(
        "channel_messages",
        "from_address",
        (q: any) => q.not("from_address", "is", null)
      );
      // Aggregate: count emails per from_address
      const addressMap = new Map<string, number>();
      for (const row of data) {
        const addr = (row.from_address || "").toLowerCase().trim();
        if (addr) addressMap.set(addr, (addressMap.get(addr) || 0) + 1);
      }
      // Deduplicate by domain but keep individual senders with their counts
      const senderRows: EnrichedRow[] = [];
      const seen = new Set<string>();
      // Sort by count descending for deduplication priority
      const sorted = [...addressMap.entries()].sort((a, b) => b[1] - a[1]);
      for (const [addr, count] of sorted) {
        const domain = extractDomainFromEmail(addr);
        if (!domain || isPersonalEmail(domain)) continue;
        if (seen.has(addr)) continue;
        seen.add(addr);
        senderRows.push({
          id: `email-${addr}`,
          name: addr.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          domain,
          source: "email",
          hasLogo: false,
          hasLinkedin: false,
          email: addr,
          emailCount: count,
        });
      }
      return senderRows;
    },
    staleTime: 60_000,
  });

  const { data: cockpitItems = [] } = useQuery({
    queryKey: ["enrichment-cockpit"],
    queryFn: async () => {
      const queue = await loadAllRows<any>("cockpit_queue", "id, source_id, source_type, partner_id, status");
      if (!queue.length) return [];
      const partnerIds = [...new Set(queue.filter((q: any) => q.partner_id).map((q: any) => q.partner_id!))];
      const contactIds = [...new Set(queue.filter((q: any) => q.source_type === "contact").map((q: any) => q.source_id))];

      const fetchPartnerBatch = async (ids: string[]) => {
        const all: any[] = [];
        for (let i = 0; i < ids.length; i += 100) {
          const { data } = await supabase.from("partners").select("id, company_name, email, website").in("id", ids.slice(i, i + 100));
          if (data) all.push(...data);
        }
        return all;
      };
      const fetchContactBatch = async (ids: string[]) => {
        const all: any[] = [];
        for (let i = 0; i < ids.length; i += 100) {
          const { data } = await supabase.from("imported_contacts").select("id, name, company_name, email").in("id", ids.slice(i, i + 100));
          if (data) all.push(...data);
        }
        return all;
      };

      const [pData, cData] = await Promise.all([
        partnerIds.length ? fetchPartnerBatch(partnerIds) : [],
        contactIds.length ? fetchContactBatch(contactIds) : [],
      ]);
      const pMap = new Map(pData.map((p: any) => [p.id, p]));
      const cMap = new Map(cData.map((c: any) => [c.id, c]));
      return queue.map((q: any): EnrichedRow => {
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

  // Counts per source (unfiltered)
  const sourceCounts = useMemo(() => {
    const emailTotal = emailSenders.reduce((sum, r) => sum + (r.emailCount || 0), 0);
    return {
      all: partners.length + contacts.length + bcaItems.length + emailSenders.length + cockpitItems.length,
      wca: partners.length,
      contacts: contacts.length,
      bca: bcaItems.length,
      email: emailSenders.length,
      emailTotal,
      cockpit: cockpitItems.length,
    };
  }, [partners, contacts, bcaItems, emailSenders, cockpitItems]);

  // Filtered rows
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

  // Stats
  const stats = useMemo(() => ({
    total: allRows.length,
    withLogo: allRows.filter(r => r.hasLogo).length,
    withDomain: allRows.filter(r => r.domain).length,
    withLinkedin: allRows.filter(r => r.hasLinkedin).length,
  }), [allRows]);

  // Selection
  const allSelected = allRows.length > 0 && allRows.every(r => selected.has(r.id));
  const someSelected = allRows.some(r => selected.has(r.id));
  const selectedCount = allRows.filter(r => selected.has(r.id)).length;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allRows.map(r => r.id)));
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Actions ──

  const getSelectedRows = () => allRows.filter(r => selected.has(r.id));

  const openDeepSearchDialog = (rows: EnrichedRow[]) => {
    // Determine mode based on source
    const ids = rows.map(r => r.realId || r.id);
    const isContact = rows.some(r => r.source === "contacts" || r.source === "bca");
    setDsTargetIds(ids);
    setDsMode(isContact ? "contact" : "partner");
    setDsDialogOpen(true);
  };

  const handleDeepSearchConfirm = (_options: Record<string, boolean>) => {
    setDsDialogOpen(false);
    if (dsTargetIds.length > 0) {
      deepSearch.start(dsTargetIds, true, dsMode);
    }
  };

  const handleLinkedInBatch = async () => {
    const rows = getSelectedRows().filter(r => r.source === "contacts" && !r.hasLinkedin);
    if (!rows.length) { toast({ title: "Nessun contatto senza LinkedIn nella selezione" }); return; }
    if (!linkedInLookup.isAvailable) { toast({ title: "Partner Connect non disponibile", variant: "destructive" }); return; }
    await linkedInLookup.lookupBatch(rows.map(r => r.realId || r.id));
    refetchContacts();
  };

  const handleBulkLogoSearch = () => {
    const rows = getSelectedRows();
    if (!rows.length) return;
    // Open Google for each (max 5 to avoid popup blocker)
    const toOpen = rows.slice(0, 5);
    toOpen.forEach(r => openGoogleLogoSearch(r.name));
    if (rows.length > 5) {
      toast({ title: `Aperte ${toOpen.length} ricerche, ${rows.length - 5} rimanenti (limite browser)` });
    }
  };

  const sourceLabel = (s: string) => ({ wca: "WCA", contacts: "Contatti", email: "Email", cockpit: "Cockpit", bca: "BCA" }[s] || s);

  return (
    <div className="flex-1 min-w-0 space-y-3">
      {/* Source Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {SOURCE_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setSourceTab(tab.value); setSelected(new Set()); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              sourceTab === tab.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
            <span className={cn(
              "ml-0.5 text-[10px] rounded-full px-1.5 py-0.5",
              sourceTab === tab.value ? "bg-primary-foreground/20" : "bg-muted"
            )}>
              {sourceCounts[tab.value]}
            </span>
          </button>
        ))}
      </div>

      {/* Search + Enrich Filter + Stats inline */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Cerca nome, dominio, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              {ENRICH_FILTERS.find(f => f.value === enrichFilter)?.label || "Tutti"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {ENRICH_FILTERS.map(f => (
              <DropdownMenuItem
                key={f.value}
                onClick={() => setEnrichFilter(f.value)}
                className={cn("text-xs gap-2", enrichFilter === f.value && "bg-accent")}
              >
                {f.icon} {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-3 ml-auto text-[10px] text-muted-foreground">
          <span>{stats.total} totali</span>
          <span className="flex items-center gap-0.5"><Globe className="w-3 h-3" /> {stats.withDomain}</span>
          <span className="flex items-center gap-0.5"><Linkedin className="w-3 h-3" /> {stats.withLinkedin}</span>
          <span className="flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> {stats.withLogo}</span>
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <span className="text-xs font-medium text-primary">{selectedCount} selezionati</span>
          <div className="flex items-center gap-1 ml-auto">
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={handleLinkedInBatch}>
              <Linkedin className="w-3 h-3" /> LinkedIn Batch
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={handleBulkLogoSearch}>
              <Image className="w-3 h-3" /> Logo Google
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => openDeepSearchDialog(getSelectedRows())}>
              <Brain className="w-3 h-3" /> Deep Search
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
              <Download className="w-3 h-3" /> Esporta
            </Button>
          </div>
        </div>
      )}

      {/* List Header */}
      <div className="grid grid-cols-[32px_28px_1fr_1fr_70px_70px_60px_28px] items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-t-lg border border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <div className="flex justify-center">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            className="h-3.5 w-3.5"
          />
        </div>
        <div />
        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort("name")}>
          Nome {sortField === "name" && (sortDir === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
        </button>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort("domain")}>
          Dominio {sortField === "domain" && (sortDir === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
        </button>
        <div>Paese</div>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort("source")}>
          Fonte {sortField === "source" && (sortDir === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
        </button>
        <div>Stato</div>
        <div />
      </div>

      {/* List */}
      <ScrollArea className="h-[calc(100vh-370px)] min-h-[250px] border border-t-0 border-border rounded-b-lg">
        <div className="divide-y divide-border/50">
          {allRows.map((row) => {
            const isSelected = selected.has(row.id);
            const flag = getFlag(row.country);
            return (
              <div
                key={row.id}
                className={cn(
                  "grid grid-cols-[32px_28px_1fr_1fr_70px_70px_60px_28px] items-center gap-2 px-3 py-2 transition-colors border-l-[3px]",
                  ORIGIN_ACCENT[row.source] || "border-l-transparent",
                  isSelected ? "bg-primary/5" : "hover:bg-accent/30"
                )}
              >
                {/* Checkbox */}
                <div className="flex justify-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(row.id)}
                    className="h-3.5 w-3.5"
                  />
                </div>

                {/* Logo */}
                <CompanyLogo domain={row.domain} name={row.name} size={24} />

                {/* Name */}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate uppercase">{row.name}</div>
                  {row.email && (
                    <div className="text-[10px] text-muted-foreground truncate">{row.email}</div>
                  )}
                </div>

                {/* Domain */}
                <div className="text-[11px] text-muted-foreground truncate">
                  {row.domain || <span className="italic text-muted-foreground/50">—</span>}
                </div>

                {/* Country */}
                <div className="flex items-center gap-1">
                  {flag && <span className="text-lg leading-none">{flag}</span>}
                  {row.country && <span className="text-[10px] text-muted-foreground uppercase">{row.country}</span>}
                </div>

                {/* Source badge */}
                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0.5", ORIGIN_BADGE_CLASS[row.source])}>
                  {sourceLabel(row.source)}
                </Badge>

                {/* Status icons */}
                <div className="flex items-center gap-1">
                  {row.hasLinkedin ? (
                    <Linkedin className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Linkedin className="w-3.5 h-3.5 text-muted-foreground/20" />
                  )}
                  {row.hasLogo ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <ImageOff className="w-3.5 h-3.5 text-muted-foreground/20" />
                  )}
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-0.5 rounded hover:bg-accent transition-colors">
                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    <DropdownMenuItem className="text-xs gap-2" onClick={() => openDeepSearchDialog([row])}>
                      <Brain className="w-3.5 h-3.5" /> Deep Search
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs gap-2" onClick={() => openGoogleLogoSearch(row.name)}>
                      <Image className="w-3.5 h-3.5" /> Cerca Logo Google
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs gap-2">
                      <Linkedin className="w-3.5 h-3.5" /> Cerca LinkedIn
                    </DropdownMenuItem>
                    {row.linkedinUrl && (
                      <DropdownMenuItem className="text-xs gap-2" onClick={() => window.open(row.linkedinUrl, "_blank")}>
                        <Linkedin className="w-3.5 h-3.5" /> Apri LinkedIn
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
          {allRows.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">Nessun risultato trovato</div>
          )}
        </div>
      </ScrollArea>

      <p className="text-[10px] text-muted-foreground">
        Loghi via Clearbit/Google Favicon · LinkedIn via Partner Connect · Deep Search configurabile per record
      </p>

      {/* Deep Search Options Dialog */}
      <DeepSearchOptionsDialog
        open={dsDialogOpen}
        onOpenChange={setDsDialogOpen}
        count={dsTargetIds.length}
        onConfirm={handleDeepSearchConfirm}
        loading={deepSearch.running}
      />
    </div>
  );
}
