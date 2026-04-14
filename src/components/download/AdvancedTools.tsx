import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import {
  Sparkles, Globe, ChevronDown, ChevronRight, Wrench, Loader2,
  FlaskConical, CheckCircle, Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { findPartnersForEnrichment, getPartnerWebsite } from "@/data/partners";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "@/hooks/use-toast";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { useNetworkConfigs, type NetworkConfig } from "@/hooks/useNetworkConfigs";
import { scrapeWcaPartnerById } from "@/lib/api/wcaScraper";
import { WcaBrowser } from "./WcaBrowser";
import { useTheme, t } from "./theme";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import { createLogger } from "@/lib/log";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("AdvancedTools");

interface EnrichPartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  website: string | null;
  enriched_at: string | null;
  partner_type: string | null;
  rating: number | null;
}

export function AdvancedTools({ isDark }: { isDark: boolean }) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const th = t(isDark);

  return (
    <Collapsible open={toolsOpen} onOpenChange={setToolsOpen} className="mt-4">
      <CollapsibleTrigger className={`flex items-center gap-2 text-sm w-full justify-center py-2 transition-colors ${th.sub} hover:opacity-80`}>
        <Wrench className="w-4 h-4" />
        Strumenti avanzati
        {toolsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EnrichSection isDark={isDark} />
          <NetworkSection isDark={isDark} />
        </div>
        <WcaBrowser isDark={isDark} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function EnrichSection({ isDark }: { isDark: boolean }) {
  const th = t(isDark);
  const { isAvailable: fsAvailable, scrapeUrl } = useFireScrapeExtensionBridge();
  const [filterCountry, setFilterCountry] = useState("");
  const [filterType, setFilterType] = useState("");
  const [onlyNotEnriched, setOnlyNotEnriched] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<{ id: string; success: boolean }[]>([]);

  const { data: partners, isLoading } = useQuery({
    queryKey: queryKeys.partners.enrichment(filterCountry, filterType, onlyNotEnriched),
    queryFn: async () => {
      const data = await findPartnersForEnrichment({ country: filterCountry, type: filterType, onlyNotEnriched }, 500);
      return data as EnrichPartner[];
    },
  });

  const handleRun = async () => {
    const ids = Array.from(selected);
    setRunning(true);
    setResults([]);
    for (let i = 0; i < ids.length; i++) {
      setCurrent(i + 1);
      try {
        const partner = await getPartnerWebsite(ids[i]);
        if (partner?.website) {
          const enrichBody: Record<string, any> = { partnerId: partner.id };

          // Try client-side scraping via FireScrape for better quality
          if (fsAvailable) {
            try {
              let websiteUrl = partner.website.trim();
              if (!websiteUrl.startsWith("http")) websiteUrl = `https://${websiteUrl}`;
              const scrapeResult = await scrapeUrl(websiteUrl);
              if (scrapeResult.success && scrapeResult.markdown && scrapeResult.markdown.length > 50) {
                enrichBody.markdown = scrapeResult.markdown;
                enrichBody.sourceUrl = scrapeResult.metadata?.url || websiteUrl;
              }
            } catch (e) { log.debug("fallback used", { error: e instanceof Error ? e.message : String(e) }); /* fallback to server-side fetch */ }
          }

          await invokeEdge("enrich-partner-website", { body: enrichBody, context: "AdvancedTools.enrich_partner_website" });
          setResults(prev => [...prev, { id: ids[i], success: true }]);
        }
      } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); setResults(prev => [...prev, { id: ids[i], success: false }]); }
      if (i < ids.length - 1) await new Promise(r => setTimeout(r, 3000));
    }
    setRunning(false);
    toast({ title: "Arricchimento completato" });
  };

  return (
    <div className={`${th.panel} border ${th.panelEmerald} rounded-2xl p-5 space-y-3`}>
      <h3 className={`text-sm font-semibold flex items-center gap-2 ${th.h2}`}>
        <Sparkles className={`w-4 h-4 ${th.acEm}`} /> Arricchisci dal Sito
      </h3>
      {running ? (
        <div className="text-center py-4">
          <Loader2 className={`w-6 h-6 animate-spin mx-auto mb-2 ${th.acEm}`} />
          <p className={`text-sm ${th.body}`}>{current}/{selected.size}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Select value={filterCountry || "__all__"} onValueChange={v => setFilterCountry(v === "__all__" ? "" : v)}>
              <SelectTrigger className={`h-8 text-xs ${th.selTrigger}`}><SelectValue placeholder="Paese" /></SelectTrigger>
              <SelectContent className={th.selContent}>
                <SelectItem value="__all__">Tutti</SelectItem>
                {WCA_COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType || "__all__"} onValueChange={v => setFilterType(v === "__all__" ? "" : v)}>
              <SelectTrigger className={`h-8 text-xs ${th.selTrigger}`}><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent className={th.selContent}>
                <SelectItem value="__all__">Tutti</SelectItem>
                <SelectItem value="freight_forwarder">FF</SelectItem>
                <SelectItem value="customs_broker">CB</SelectItem>
                <SelectItem value="nvocc">NVOCC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className={`flex items-center gap-2 text-xs ${th.body}`}>
            <Checkbox checked={onlyNotEnriched} onCheckedChange={v => setOnlyNotEnriched(!!v)} />
            Solo non arricchiti
          </label>
          {isLoading ? (
            <Loader2 className={`w-5 h-5 animate-spin mx-auto ${th.sub}`} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <button onClick={() => { if (selected.size === (partners?.length || 0)) setSelected(new Set()); else setSelected(new Set(partners?.map(p => p.id))); }} className={`text-xs ${th.sub}`}>
                  {selected.size === (partners?.length || 0) ? "Deseleziona" : `Tutti (${partners?.length})`}
                </button>
                <span className={`text-xs ${th.dim}`}>{selected.size} sel.</span>
              </div>
              <ScrollArea className={`h-40 border rounded-lg ${th.panelSlate}`}>
                <div className={th.divider}>
                  {partners?.map(p => (
                    <div key={p.id} onClick={() => setSelected(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer ${th.hover}`}>
                      <Checkbox checked={selected.has(p.id)} className="pointer-events-none" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs truncate ${th.chipName}`}>{p.company_name}</p>
                        <p className={`text-[10px] ${th.chipSub}`}>{p.city}, {p.country_code}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
          <Button onClick={handleRun} disabled={selected.size === 0} className={`w-full ${th.btnEn}`} size="sm">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Arricchisci ({selected.size})
          </Button>
        </>
      )}
    </div>
  );
}

function NetworkSection({ isDark }: { isDark: boolean }) {
  const th = t(isDark);
  const { data: configs, isLoading, updateConfig } = useNetworkConfigs();
  const [testing, setTesting] = useState<string | null>(null);

  const handleTest = async (config: NetworkConfig) => {
    setTesting(config.id);
    try {
      const sampleIds = [11470, 11471, 11472];
      let hasEmails = false, hasNames = false, hasPhones = false;
      for (const id of sampleIds) {
        const result = await scrapeWcaPartnerById(id);
        if (result.success && result.found && result.partner) {
          if (result.partner.email) hasEmails = true;
          if (result.partner.contacts?.some(c => c.name && c.name !== c.title)) { hasEmails = true; hasNames = true; }
          if (result.partner.phone) hasPhones = true;
        }
      }
      updateConfig.mutate({ id: config.id, has_contact_emails: hasEmails, has_contact_names: hasNames, has_contact_phones: hasPhones, sample_tested_at: new Date().toISOString() });
      toast({ title: "Test completato" });
    } catch (err) {
      toast({ title: "Errore", description: String(err), variant: "destructive" });
    } finally { setTesting(null); }
  };

  return (
    <div className={`${th.panel} border ${th.panelBlue} rounded-2xl p-5 space-y-3`}>
      <h3 className={`text-sm font-semibold flex items-center gap-2 ${th.h2}`}>
        <Globe className={`w-4 h-4 ${th.acBl}`} /> Analisi Network
      </h3>
      {isLoading ? (
        <Loader2 className={`w-5 h-5 animate-spin mx-auto ${th.sub}`} />
      ) : (
        <div className="space-y-2">
          {configs?.map(config => {
            const tested = !!config.sample_tested_at;
            const allOk = tested && config.has_contact_emails && config.has_contact_names && config.has_contact_phones;
            return (
              <div key={config.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                tested ? (allOk ? (isDark ? "border-emerald-500/40 bg-emerald-500/5" : "border-emerald-300 bg-emerald-50/50") : (isDark ? "border-amber-500/40 bg-amber-500/5" : "border-amber-300 bg-amber-50/50")) : th.cardBg
              }`}>
                <div className="flex items-center gap-2">
                  <Checkbox checked={config.is_member} onCheckedChange={() => updateConfig.mutate({ id: config.id, is_member: !config.is_member })} />
                  <div>
                    <p className={`text-xs ${th.chipName}`}>{config.network_name}</p>
                    {tested && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StatusDot ok={config.has_contact_emails} label="E" isDark={isDark} />
                        <StatusDot ok={config.has_contact_names} label="N" isDark={isDark} />
                        <StatusDot ok={config.has_contact_phones} label="T" isDark={isDark} />
                      </div>
                    )}
                  </div>
                </div>
                {config.is_member && (
                  <Button size="sm" variant="outline" onClick={() => handleTest(config)} disabled={testing !== null} className={`h-7 text-xs ${th.btnTest}`}>
                    {testing === config.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
                    <span className="ml-1">{tested ? "Ri-testa" : "Test"}</span>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusDot({ ok, label, isDark }: { ok: boolean; label: string; isDark: boolean }) {
  const th = t(isDark);
  return (
    <div className="flex items-center gap-0.5">
      <div className={`w-1.5 h-1.5 rounded-full ${ok ? th.dotOn : th.dotOff}`} />
      <span className={`text-[9px] ${th.dotLbl}`}>{label}</span>
    </div>
  );
}
