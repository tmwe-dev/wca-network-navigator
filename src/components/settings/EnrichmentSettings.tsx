import { useState, useMemo, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CompanyLogo, extractDomainFromEmail, isPersonalEmail } from "@/components/ui/CompanyLogo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Mail, CheckCircle2, Linkedin, Search, LayoutDashboard,
} from "lucide-react";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import { toast } from "@/hooks/use-toast";
import { EnrichmentBatchActions } from "./enrichment/EnrichmentBatchActions";
import type { SourceFilter, EnrichFilter, SortField, SortDir } from "./enrichment/EnrichmentFilters";

// Re-export for Settings.tsx
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
}

interface EnrichmentSettingsProps {
  source: SourceFilter;
  enrichFilter: EnrichFilter;
  sortField: SortField;
  sortDir: SortDir;
  search: string;
}

export default function EnrichmentSettings({
  source, enrichFilter, sortField, sortDir, search,
}: EnrichmentSettingsProps) {
  const linkedInLookup = useLinkedInLookup();

  const { data: partners = [] } = useQuery({
    queryKey: ["enrichment-partners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("id, company_name, email, website, country_code, logo_url")
        .order("company_name").limit(1000);
      return (data || []).map((p): EnrichedRow => ({
        id: p.id, name: p.company_name,
        domain: p.website?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || extractDomainFromEmail(p.email || ""),
        source: "wca", hasLogo: !!p.logo_url, hasLinkedin: false,
        email: p.email || undefined, country: p.country_code || undefined,
      }));
    },
  });

  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["enrichment-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("imported_contacts")
        .select("id, name, company_name, email, enrichment_data")
        .or("name.not.is.null,company_name.not.is.null,email.not.is.null")
        .limit(1000);
      return (data || []).map((c): EnrichedRow => {
        const ed = (c.enrichment_data as Record<string, any>) || {};
        const liUrl = ed.linkedin_profile_url || ed.linkedin_url || ed.social_links?.linkedin || null;
        return {
          id: c.id, name: c.name || c.company_name || c.email || "?",
          domain: extractDomainFromEmail(c.email || ""),
          source: "contacts", hasLogo: false, hasLinkedin: !!liUrl,
          linkedinUrl: liUrl || undefined, email: c.email || undefined,
        };
      });
    },
  });

  const { data: emailSenders = [] } = useQuery({
    queryKey: ["enrichment-email-senders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("channel_messages").select("from_address")
        .not("from_address", "is", null).limit(1000);
      const domainMap = new Map<string, { from: string; domain: string }>();
      for (const row of data || []) {
        const domain = extractDomainFromEmail(row.from_address || "");
        if (domain && !isPersonalEmail(domain) && !domainMap.has(domain))
          domainMap.set(domain, { from: row.from_address!, domain });
      }
      return Array.from(domainMap.values()).map((s): EnrichedRow => ({
        id: `email-${s.domain}`,
        name: s.domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        domain: s.domain, source: "email", hasLogo: false, hasLinkedin: false, email: s.from,
      }));
    },
  });

  const { data: cockpitItems = [] } = useQuery({
    queryKey: ["enrichment-cockpit"],
    queryFn: async () => {
      const { data: queue } = await supabase
        .from("cockpit_queue").select("id, source_id, source_type, partner_id, status").limit(1000);
      if (!queue?.length) return [];
      const partnerIds = [...new Set(queue.filter(q => q.partner_id).map(q => q.partner_id!))];
      const contactIds = [...new Set(queue.filter(q => q.source_type === "contact").map(q => q.source_id))];
      const [{ data: pData }, { data: cData }] = await Promise.all([
        partnerIds.length ? supabase.from("partners").select("id, company_name, email, website").in("id", partnerIds) : Promise.resolve({ data: [] as any[] }),
        contactIds.length ? supabase.from("imported_contacts").select("id, name, company_name, email").in("id", contactIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const pMap = new Map((pData || []).map(p => [p.id, p]));
      const cMap = new Map((cData || []).map(c => [c.id, c]));
      return queue.map((q): EnrichedRow => {
        const partner = q.partner_id ? pMap.get(q.partner_id) : null;
        const contact = q.source_type === "contact" ? cMap.get(q.source_id) : null;
        const name = partner?.company_name || contact?.name || contact?.company_name || q.source_id.slice(0, 8);
        const email = partner?.email || contact?.email || undefined;
        const domain = partner?.website?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || extractDomainFromEmail(email || "");
        return { id: `cockpit-${q.id}`, name, domain: domain || null, source: "cockpit", hasLogo: false, hasLinkedin: false, email };
      });
    },
  });

  const allRows = useMemo(() => {
    let rows: EnrichedRow[] = [];
    if (source === "all" || source === "wca") rows.push(...partners);
    if (source === "all" || source === "contacts") rows.push(...contacts);
    if (source === "all" || source === "email") rows.push(...emailSenders);
    if (source === "all" || source === "cockpit") rows.push(...cockpitItems);
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
      return sortDir === "desc" ? -cmp : cmp;
    });
    return rows;
  }, [partners, contacts, emailSenders, cockpitItems, source, search, enrichFilter, sortField, sortDir]);

  const stats = useMemo(() => ({
    total: allRows.length,
    withLogo: allRows.filter(r => r.hasLogo).length,
    withDomain: allRows.filter(r => r.domain).length,
    withLinkedin: allRows.filter(r => r.hasLinkedin).length,
  }), [allRows]);

  const handleLinkedInBatch = async () => {
    const without = contacts.filter(c => !c.hasLinkedin);
    if (!without.length) { toast({ title: "Tutti i contatti hanno già un profilo LinkedIn" }); return; }
    if (!linkedInLookup.isAvailable) { toast({ title: "Partner Connect non disponibile", variant: "destructive" }); return; }
    await linkedInLookup.lookupBatch(without.map(c => c.id));
    refetchContacts();
  };

  const sourceLabel = (s: string) => ({ wca: "WCA", contacts: "Contatti", email: "Email", cockpit: "Cockpit" }[s] || s);
  const sourceIcon = (s: string) => {
    const icons: Record<string, ReactNode> = {
      wca: <Building2 className="w-3 h-3 mr-1" />,
      email: <Mail className="w-3 h-3 mr-1" />,
      contacts: <Search className="w-3 h-3 mr-1" />,
      cockpit: <LayoutDashboard className="w-3 h-3 mr-1" />,
    };
    return icons[s] || null;
  };

  return (
    <div className="flex-1 min-w-0 space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Totali" value={stats.total} />
        <StatCard label="Con dominio" value={stats.withDomain} highlight />
        <StatCard label="Con LinkedIn" value={stats.withLinkedin} highlight />
        <StatCard label="Con logo" value={stats.withLogo} highlight />
      </div>

      {/* Contextual Batch Actions */}
      <EnrichmentBatchActions
        source={source}
        contactsWithoutLinkedin={contacts.filter(c => !c.hasLinkedin).length}
        partnersWithoutLogo={partners.filter(p => !p.hasLogo).length}
        isExtensionAvailable={linkedInLookup.isAvailable}
        onLinkedInBatch={handleLinkedInBatch}
        onAbort={linkedInLookup.abort}
        progress={linkedInLookup.progress}
      />

      {/* List */}
      <ScrollArea className="h-[calc(100vh-380px)] min-h-[300px] border border-border rounded-lg">
        <div className="divide-y divide-border">
          {allRows.map(row => (
            <div key={row.id} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30 transition-colors">
              <CompanyLogo domain={row.domain} name={row.name} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">{row.name}</div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                  {row.domain || "Nessun dominio"}
                  {row.country && <span className="ml-1">{row.country}</span>}
                  {row.linkedinUrl && (
                    <a href={row.linkedinUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                      onClick={e => e.stopPropagation()}>
                      <Linkedin className="w-3 h-3" /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] flex-shrink-0">
                {sourceIcon(row.source)}{sourceLabel(row.source)}
              </Badge>
              {row.hasLinkedin && <Linkedin className="w-4 h-4 flex-shrink-0 text-primary" />}
              {row.hasLogo && <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-500" />}
            </div>
          ))}
          {allRows.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">Nessun risultato trovato</div>
          )}
        </div>
      </ScrollArea>

      <p className="text-[10px] text-muted-foreground">
        Loghi via Clearbit/Google Favicon · LinkedIn via Partner Connect
      </p>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-muted/50 rounded-lg p-2.5 text-center">
      <div className={`text-xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
