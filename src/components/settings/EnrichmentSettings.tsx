import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CompanyLogo, extractDomainFromEmail, isPersonalEmail } from "@/components/ui/CompanyLogo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Building2, Users, Mail, Globe, CheckCircle2, Image } from "lucide-react";

type SourceFilter = "all" | "wca" | "contacts" | "email";

interface EnrichedRow {
  id: string;
  name: string;
  domain: string | null;
  source: string;
  hasLogo: boolean;
  email?: string;
  country?: string;
}

export default function EnrichmentSettings() {
  const [source, setSource] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");

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
        email: p.email || undefined,
        country: p.country_code || undefined,
      }));
    },
  });

  // Fetch email senders (unique domains from channel_messages)
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
        email: s.from,
      }));
    },
  });

  const allRows = useMemo(() => {
    const rows: EnrichedRow[] = [];
    if (source === "all" || source === "wca") rows.push(...partners);
    if (source === "all" || source === "email") rows.push(...emailSenders);

    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.domain?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q)
    );
  }, [partners, emailSenders, source, search]);

  const stats = useMemo(() => ({
    total: allRows.length,
    withLogo: allRows.filter(r => r.hasLogo).length,
    withDomain: allRows.filter(r => r.domain).length,
  }), [allRows]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Image className="w-5 h-5 text-primary" />
          Arricchimento Contatti
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Visualizza e gestisci i loghi aziendali e i dati di arricchimento dei tuoi contatti.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Totali</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary">{stats.withDomain}</div>
          <div className="text-xs text-muted-foreground">Con dominio</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.withLogo}</div>
          <div className="text-xs text-muted-foreground">Con logo salvato</div>
        </div>
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
                <div className="text-xs text-muted-foreground truncate">
                  {row.domain || "Nessun dominio"}
                  {row.country && <span className="ml-2">{row.country}</span>}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] flex-shrink-0">
                {row.source === "wca" && <Building2 className="w-3 h-3 mr-1" />}
                {row.source === "email" && <Mail className="w-3 h-3 mr-1" />}
                {row.source === "wca" ? "WCA" : "Email"}
              </Badge>
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
        I loghi vengono caricati automaticamente da Clearbit e Google Favicon in base al dominio email/sito web. Nessun costo aggiuntivo.
      </p>
    </div>
  );
}
