import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CompanyLogo, extractDomainFromEmail, isPersonalEmail } from "@/components/ui/CompanyLogo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Search, Building2, Mail, CheckCircle2, Image, Linkedin, Loader2,
  XCircle, StopCircle, LayoutDashboard, SortAsc, SortDesc, Filter,
  Globe, ImageOff, LinkIcon, Users,
} from "lucide-react";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import { toast } from "@/hooks/use-toast";

type SourceFilter = "all" | "wca" | "contacts" | "email" | "cockpit";
type EnrichFilter = "all" | "with-logo" | "no-logo" | "with-linkedin" | "no-linkedin" | "with-domain" | "no-domain";
type SortField = "name" | "domain" | "source";
type SortDir = "asc" | "desc";

interface EnrichedRow {
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

const SOURCE_OPTIONS: { value: SourceFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "Tutte le fonti", icon: <Users className="w-4 h-4" /> },
  { value: "wca", label: "WCA Partner", icon: <Building2 className="w-4 h-4" /> },
  { value: "contacts", label: "Contatti Importati", icon: <Search className="w-4 h-4" /> },
  { value: "email", label: "Mittenti Email", icon: <Mail className="w-4 h-4" /> },
  { value: "cockpit", label: "Cockpit", icon: <LayoutDashboard className="w-4 h-4" /> },
];

const ENRICH_OPTIONS: { value: EnrichFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "Tutti", icon: <Filter className="w-4 h-4" /> },
  { value: "with-logo", label: "Con logo", icon: <CheckCircle2 className="w-4 h-4" /> },
  { value: "no-logo", label: "Senza logo", icon: <ImageOff className="w-4 h-4" /> },
  { value: "with-linkedin", label: "Con LinkedIn", icon: <Linkedin className="w-4 h-4" /> },
  { value: "no-linkedin", label: "Senza LinkedIn", icon: <XCircle className="w-4 h-4" /> },
  { value: "with-domain", label: "Con dominio", icon: <Globe className="w-4 h-4" /> },
  { value: "no-domain", label: "Senza dominio", icon: <LinkIcon className="w-4 h-4" /> },
];

export default function EnrichmentSettings() {
  const [source, setSource] = useState<SourceFilter>("all");
  const [enrichFilter, setEnrichFilter] = useState<EnrichFilter>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const linkedInLookup = useLinkedInLookup();

  // Fetch partners
  const { data: partners = [] } = useQuery({
    queryKey: ["enrichment-partners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("id, company_name, email, website, country_code, logo_url")
        .order("company_name")
        .limit(1000);
      return (data || []).map((p): EnrichedRow => ({
        id: p.id,
        name: p.company_name,
        domain: p.website?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || extractDomainFromEmail(p.email || ""),
        source: "wca",
        hasLogo: !!p.logo_url,
        hasLinkedin: false,
        email: p.email || undefined,
        country: p.country_code || undefined,
      }));
    },
  });

  // Fetch imported contacts
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
          id: c.id,
          name: c.name || c.company_name || c.email || "?",
          domain: extractDomainFromEmail(c.email || ""),
          source: "contacts",
          hasLogo: false,
          hasLinkedin: !!liUrl,
          linkedinUrl: liUrl || undefined,
          email: c.email || undefined,
        };
      });
    },
  });

  // Fetch email senders
  const { data: emailSenders = [] } = useQuery({
    queryKey: ["enrichment-email-senders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("channel_messages")
        .select("from_address")
        .not("from_address", "is", null)
        .limit(1000);
      const domainMap = new Map<string, { from: string; domain: string }>();
      for (const row of data || []) {
        const domain = extractDomainFromEmail(row.from_address || "");
        if (domain && !isPersonalEmail(domain) && !domainMap.has(domain)) {
          domainMap.set(domain, { from: row.from_address!, domain });
        }
      }
      return Array.from(domainMap.values()).map((s): EnrichedRow => ({
        id: `email-${s.domain}`,
        name: s.domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        domain: s.domain,
        source: "email",
        hasLogo: false,
        hasLinkedin: false,
        email: s.from,
      }));
    },
  });

  // Fetch cockpit queue items
  const { data: cockpitItems = [] } = useQuery({
    queryKey: ["enrichment-cockpit"],
    queryFn: async () => {
      const { data: queue } = await supabase
        .from("cockpit_queue")
        .select("id, source_id, source_type, partner_id, status")
        .limit(1000);
      if (!queue?.length) return [];
      const partnerIds = [...new Set(queue.filter(q => q.partner_id).map(q => q.partner_id!))];
      const contactIds = [...new Set(queue.filter(q => q.source_type === "contact").map(q => q.source_id))];
      const [{ data: partnerData }, { data: contactData }] = await Promise.all([
        partnerIds.length
          ? supabase.from("partners").select("id, company_name, email, website").in("id", partnerIds)
          : Promise.resolve({ data: [] as any[] }),
        contactIds.length
          ? supabase.from("imported_contacts").select("id, name, company_name, email").in("id", contactIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const pMap = new Map((partnerData || []).map(p => [p.id, p]));
      const cMap = new Map((contactData || []).map(c => [c.id, c]));
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

  // Filtered + sorted rows
  const allRows = useMemo(() => {
    let rows: EnrichedRow[] = [];
    if (source === "all" || source === "wca") rows.push(...partners);
    if (source === "all" || source === "contacts") rows.push(...contacts);
    if (source === "all" || source === "email") rows.push(...emailSenders);
    if (source === "all" || source === "cockpit") rows.push(...cockpitItems);

    // Search
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.domain?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q)
      );
    }

    // Enrich filter
    switch (enrichFilter) {
      case "with-logo": rows = rows.filter(r => r.hasLogo); break;
      case "no-logo": rows = rows.filter(r => !r.hasLogo); break;
      case "with-linkedin": rows = rows.filter(r => r.hasLinkedin); break;
      case "no-linkedin": rows = rows.filter(r => !r.hasLinkedin); break;
      case "with-domain": rows = rows.filter(r => !!r.domain); break;
      case "no-domain": rows = rows.filter(r => !r.domain); break;
    }

    // Sort
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

  // LinkedIn batch
  const handleLinkedInBatch = async () => {
    const contactsWithout = contacts.filter(c => !c.hasLinkedin);
    if (!contactsWithout.length) {
      toast({ title: "Tutti i contatti hanno già un profilo LinkedIn" });
      return;
    }
    if (!linkedInLookup.isAvailable) {
      toast({ title: "Partner Connect non disponibile", description: "Installa l'estensione Partner Connect", variant: "destructive" });
      return;
    }
    await linkedInLookup.lookupBatch(contactsWithout.map(c => c.id));
    refetchContacts();
  };

  const prog = linkedInLookup.progress;
  const isRunning = prog.status === "running";
  const isDone = prog.status === "done" || prog.status === "aborted";

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const sourceLabel = (s: string) => {
    switch (s) {
      case "wca": return "WCA";
      case "contacts": return "Contatti";
      case "email": return "Email";
      case "cockpit": return "Cockpit";
      default: return s;
    }
  };

  const sourceIcon = (s: string) => {
    switch (s) {
      case "wca": return <Building2 className="w-3 h-3 mr-1" />;
      case "email": return <Mail className="w-3 h-3 mr-1" />;
      case "contacts": return <Search className="w-3 h-3 mr-1" />;
      case "cockpit": return <LayoutDashboard className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="flex gap-4 h-full">
      {/* LEFT SIDEBAR — Filters */}
      <div className="w-[220px] flex-shrink-0 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Arricchimento
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Filtri e ordinamenti
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Source filter */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fonte</div>
          <div className="space-y-1">
            {SOURCE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSource(opt.value)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors ${
                  source === opt.value
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Enrichment status filter */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stato Dati</div>
          <div className="space-y-1">
            {ENRICH_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setEnrichFilter(opt.value)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors ${
                  enrichFilter === opt.value
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ordina per</div>
          <div className="space-y-1">
            {([
              { field: "name" as SortField, label: "Nome" },
              { field: "domain" as SortField, label: "Dominio" },
              { field: "source" as SortField, label: "Fonte" },
            ]).map(opt => (
              <button
                key={opt.field}
                onClick={() => toggleSort(opt.field)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition-colors ${
                  sortField === opt.field
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {opt.label}
                {sortField === opt.field && (
                  sortDir === "asc" ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <div className="text-xl font-bold text-foreground">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground">Totali</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <div className="text-xl font-bold text-primary">{stats.withDomain}</div>
            <div className="text-[10px] text-muted-foreground">Con dominio</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <div className="text-xl font-bold text-primary">{stats.withLinkedin}</div>
            <div className="text-[10px] text-muted-foreground">Con LinkedIn</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <div className="text-xl font-bold text-primary">{stats.withLogo}</div>
            <div className="text-[10px] text-muted-foreground">Con logo</div>
          </div>
        </div>

        {/* LinkedIn Batch */}
        <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-primary" />
              <div>
                <div className="text-sm font-semibold text-foreground">LinkedIn Batch</div>
                <div className="text-xs text-muted-foreground">
                  {contacts.filter(c => !c.hasLinkedin).length} senza profilo
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isRunning && (
                <Button variant="outline" size="sm" onClick={linkedInLookup.abort}>
                  <StopCircle className="w-4 h-4 mr-1" /> Stop
                </Button>
              )}
              <Button size="sm" onClick={handleLinkedInBatch} disabled={isRunning || !contacts.filter(c => !c.hasLinkedin).length}>
                {isRunning ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Cercando...</> : <><Search className="w-4 h-4 mr-1" /> Cerca</>}
              </Button>
            </div>
          </div>
          {(isRunning || isDone) && (
            <div className="space-y-1.5">
              <Progress value={prog.total > 0 ? (prog.current / prog.total) * 100 : 0} className="h-1.5" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{prog.current}/{prog.total}{prog.currentName && isRunning && <span className="ml-2 text-foreground">{prog.currentName}</span>}</span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> {prog.found}</span>
                  <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-destructive" /> {prog.notFound}</span>
                </div>
              </div>
              {isDone && <div className="text-xs font-medium text-green-600">✅ Completato — {prog.found} trovati</div>}
            </div>
          )}
        </div>

        {/* List */}
        <ScrollArea className="h-[calc(100vh-400px)] min-h-[300px] border border-border rounded-lg">
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
                      <a
                        href={row.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        <Linkedin className="w-3 h-3" /> LinkedIn
                      </a>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {sourceIcon(row.source)}
                  {sourceLabel(row.source)}
                </Badge>
                {row.hasLinkedin && <Linkedin className="w-4 h-4 flex-shrink-0 text-primary" />}
                {row.hasLogo && <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-500" />}
              </div>
            ))}
            {allRows.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nessun risultato trovato
              </div>
            )}
          </div>
        </ScrollArea>

        <p className="text-xs text-muted-foreground">
          Loghi via Clearbit/Google Favicon · LinkedIn via Partner Connect
        </p>
      </div>
    </div>
  );
}
