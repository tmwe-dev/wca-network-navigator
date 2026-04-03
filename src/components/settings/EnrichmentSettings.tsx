import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CompanyLogo, extractDomainFromEmail, isPersonalEmail } from "@/components/ui/CompanyLogo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Building2, Mail, CheckCircle2, Image, Linkedin, Loader2, XCircle, StopCircle, LayoutDashboard } from "lucide-react";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import { toast } from "@/hooks/use-toast";

type SourceFilter = "all" | "wca" | "contacts" | "email" | "cockpit";

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

export default function EnrichmentSettings() {
  const [source, setSource] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
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

  // Fetch imported contacts with LinkedIn info
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

      // Resolve partner names for cockpit items that have partner_id
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
        return {
          id: `cockpit-${q.id}`,
          name,
          domain: domain || null,
          source: "cockpit",
          hasLogo: false,
          hasLinkedin: false,
          email,
        };
      });
    },
  });

  const allRows = useMemo(() => {
    const rows: EnrichedRow[] = [];
    if (source === "all" || source === "wca") rows.push(...partners);
    if (source === "all" || source === "contacts") rows.push(...contacts);
    if (source === "all" || source === "email") rows.push(...emailSenders);
    if (source === "all" || source === "cockpit") rows.push(...cockpitItems);

    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.domain?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q)
    );
  }, [partners, contacts, emailSenders, cockpitItems, source, search]);

  const stats = useMemo(() => ({
    total: allRows.length,
    withLogo: allRows.filter(r => r.hasLogo).length,
    withDomain: allRows.filter(r => r.domain).length,
    withLinkedin: allRows.filter(r => r.hasLinkedin).length,
  }), [allRows]);

  // LinkedIn batch search for contacts without LinkedIn
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Image className="w-5 h-5 text-primary" />
          Arricchimento Contatti
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Loghi aziendali, profili LinkedIn e dati di arricchimento.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Totali</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary">{stats.withDomain}</div>
          <div className="text-xs text-muted-foreground">Con dominio</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold" style={{ color: "hsl(210,80%,55%)" }}>{stats.withLinkedin}</div>
          <div className="text-xs text-muted-foreground">Con LinkedIn</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.withLogo}</div>
          <div className="text-xs text-muted-foreground">Con logo</div>
        </div>
      </div>

      {/* LinkedIn Batch Action */}
      <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Linkedin className="w-5 h-5" style={{ color: "hsl(210,80%,55%)" }} />
            <div>
              <div className="text-sm font-semibold text-foreground">Ricerca LinkedIn Batch</div>
              <div className="text-xs text-muted-foreground">
                {contacts.filter(c => !c.hasLinkedin).length} contatti senza profilo LinkedIn
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && (
              <Button variant="outline" size="sm" onClick={linkedInLookup.abort}>
                <StopCircle className="w-4 h-4 mr-1" /> Stop
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleLinkedInBatch}
              disabled={isRunning || !contacts.filter(c => !c.hasLinkedin).length}
            >
              {isRunning ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Cercando...</>
              ) : (
                <><Search className="w-4 h-4 mr-1" /> Cerca LinkedIn</>
              )}
            </Button>
          </div>
        </div>

        {/* Progress */}
        {(isRunning || isDone) && (
          <div className="space-y-2">
            <Progress value={prog.total > 0 ? (prog.current / prog.total) * 100 : 0} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {prog.current}/{prog.total}
                {prog.currentName && isRunning && (
                  <span className="ml-2 text-foreground">{prog.currentName}</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" /> {prog.found}
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-destructive" /> {prog.notFound}
                </span>
                {prog.skipped > 0 && (
                  <span className="text-muted-foreground">{prog.skipped} già risolti</span>
                )}
              </div>
            </div>
            {isDone && (
              <div className="text-xs font-medium text-green-600">
                ✅ Completato — {prog.found} profili trovati
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca azienda o dominio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={source} onValueChange={(v) => setSource(v as SourceFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le fonti</SelectItem>
            <SelectItem value="wca">WCA Partner</SelectItem>
            <SelectItem value="contacts">Contatti Importati</SelectItem>
            <SelectItem value="email">Mittenti Email</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <ScrollArea className="h-[400px] border border-border rounded-lg">
        <div className="divide-y divide-border">
          {allRows.map(row => (
            <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors">
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
                      className="inline-flex items-center gap-0.5 hover:underline"
                      style={{ color: "hsl(210,80%,55%)" }}
                      onClick={e => e.stopPropagation()}
                    >
                      <Linkedin className="w-3 h-3" /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] flex-shrink-0">
                {row.source === "wca" && <Building2 className="w-3 h-3 mr-1" />}
                {row.source === "email" && <Mail className="w-3 h-3 mr-1" />}
                {row.source === "contacts" && <Search className="w-3 h-3 mr-1" />}
                {row.source === "wca" ? "WCA" : row.source === "contacts" ? "Contatti" : "Email"}
              </Badge>
              {row.hasLinkedin && <Linkedin className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(210,80%,55%)" }} />}
              {row.hasLogo && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
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
        Loghi via Clearbit/Google Favicon. Profili LinkedIn via Google Search (Partner Connect).
      </p>
    </div>
  );
}
