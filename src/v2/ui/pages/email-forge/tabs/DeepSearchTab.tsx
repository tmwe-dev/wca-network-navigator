/**
 * DeepSearchTab — inspect last enrichment + trigger live Deep Search con
 * config panel (4 toggle + slider + dominio prioritario) e cascade timeline live.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { setDeepSearchRuntimeConfig } from "@/hooks/useDeepSearchLocal";
import { cascadeBus, type CascadeEvent } from "@/hooks/useDeepSearchHelpers";
import { forgeLabStore, useForgeLab } from "@/v2/hooks/useForgeLabStore";
import { getDeepSearchMeta, getDeepSearchSources } from "@/lib/deepSearchPresets";
import { Search, RefreshCw, AlertCircle, CheckCircle2, Loader2, Circle, Zap, ThumbsUp, Trophy, Info } from "lucide-react";
import { toast } from "sonner";
import type { ForgeRecipient } from "../ForgeRecipientPicker";

interface Props {
  recipient: ForgeRecipient | null;
  onRefreshGeneration?: () => void;
}

interface PartnerEnrichment {
  enrichment_data?: Record<string, unknown> | null;
  profile_description?: string | null;
  raw_profile_html?: string | null;
  raw_profile_markdown?: string | null;
  ai_parsed_at?: string | null;
  deep_search_at?: string | null;
  raw_data?: Record<string, unknown> | null;
}

interface TimelineRow {
  query: string;
  status: "running" | "done";
  results: number | null;
  index: number;
  total: number;
}

export function DeepSearchTab({ recipient, onRefreshGeneration }: Props) {
  const ds = useDeepSearch();
  const lab = useForgeLab();
  const dsConfig = lab.deepSearchConfig;

  // Sync runtime config -> hook modulo ad ogni cambio
  React.useEffect(() => {
    setDeepSearchRuntimeConfig({
      scrapeWebsite: dsConfig.scrapeWebsite,
      linkedinContacts: dsConfig.linkedinContacts,
      linkedinCompany: dsConfig.linkedinCompany,
      whatsapp: dsConfig.whatsapp,
      googleGeneral: dsConfig.googleGeneral,
      googleMaps: dsConfig.googleMaps,
      websiteMultiPage: dsConfig.websiteMultiPage,
      reputation: dsConfig.reputation,
      maxQueriesPerContact: dsConfig.maxQueriesPerContact,
      priorityDomain: dsConfig.priorityDomain,
    });
  }, [dsConfig]);

  // Sottoscrivi cascade bus per timeline
  const [timeline, setTimeline] = React.useState<TimelineRow[]>([]);
  React.useEffect(() => {
    if (!ds.running) return;
    setTimeline([]);
    const off = cascadeBus.subscribe((e: CascadeEvent) => {
      if (e.type === "query-start") {
        setTimeline((prev) => [...prev, { query: e.query, status: "running", results: null, index: e.index, total: e.total }]);
      } else if (e.type === "query-result") {
        setTimeline((prev) => {
          const next = [...prev];
          // aggiorna ultima riga matching senza risultati
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].query === e.query && next[i].status === "running") {
              next[i] = { ...next[i], status: "done", results: e.results };
              break;
            }
          }
          return next;
        });
      }
    });
    return off;
  }, [ds.running]);

  const enrichmentQuery = useQuery({
    queryKey: ["forge-enrichment", recipient?.source, recipient?.recordId],
    enabled: !!recipient,
    queryFn: async () => {
      if (!recipient) return null;
      if (recipient.source === "partner" || (recipient.source === "bca" && recipient.partnerId)) {
        const id = recipient.partnerId!;
        const { data } = await supabase
          .from("partners")
          .select("id, enrichment_data, profile_description, raw_profile_html, raw_profile_markdown, ai_parsed_at")
          .eq("id", id)
          .maybeSingle();
        return { kind: "partner" as const, data };
      }
      if (recipient.source === "contact") {
        const { data } = await supabase
          .from("imported_contacts")
          .select("id, enrichment_data, deep_search_at")
          .eq("id", recipient.recordId)
          .maybeSingle();
        return { kind: "contact" as const, data };
      }
      if (recipient.source === "bca") {
        const { data } = await supabase
          .from("business_cards")
          .select("id, raw_data, ocr_confidence")
          .eq("id", recipient.recordId)
          .maybeSingle();
        return { kind: "bca" as const, data };
      }
      return null;
    },
  });

  // Track previous running state per rilevare la fine di una run e mostrare riepilogo persistente
  const prevRunning = React.useRef(ds.running);
  const [savedSummary, setSavedSummary] = React.useState<{
    when: string;
    quality: string;
    socialLinks: number;
    contactProfiles: number;
    rating: number;
    errors: number;
  } | null>(null);

  React.useEffect(() => {
    if (prevRunning.current && !ds.running && ds.results.length > 0) {
      // Run appena terminata → calcola riepilogo + refresh enrichment + toast esteso
      const totals = ds.results.reduce(
        (acc, r) => ({
          socialLinks: acc.socialLinks + (r.socialLinksFound || 0),
          contactProfiles: acc.contactProfiles + (r.contactProfilesFound || 0),
          rating: Math.max(acc.rating, r.rating || 0),
          errors: acc.errors + (r.error ? 1 : 0),
        }),
        { socialLinks: 0, contactProfiles: 0, rating: 0, errors: 0 },
      );
      setSavedSummary({
        when: new Date().toLocaleString("it-IT"),
        quality: lab.quality,
        ...totals,
      });
      // Refetch enrichment per mostrare i dati appena salvati
      enrichmentQuery.refetch();
      // Toast esteso con il dettaglio
      toast.success(
        `Deep Search ${lab.quality.toUpperCase()} salvata · ${totals.socialLinks} link · ${totals.contactProfiles} profili · rating ${totals.rating}`,
        { duration: 6000 },
      );
    }
    prevRunning.current = ds.running;
  }, [ds.running, ds.results, lab.quality, enrichmentQuery]);

  if (!recipient) {
    return <Empty msg="Seleziona un destinatario reale a sinistra per ispezionare la sua deep search." />;
  }

  const handleRun = (mode: "partner" | "contact") => {
    const targetId = mode === "partner" ? recipient.partnerId : recipient.contactId;
    if (!targetId) {
      toast.error("ID non disponibile per questa modalità");
      return;
    }
    setSavedSummary(null); // reset card precedente prima di un nuovo run
    ds.start([targetId], true, mode);
  };

  const updateConfig = (patch: Partial<typeof dsConfig>) => {
    forgeLabStore.set({ deepSearchConfig: { ...dsConfig, ...patch } });
  };

  const setQuality = (q: "fast" | "standard" | "premium") => {
    // Cambia quality → lo store ricalcola automaticamente deepSearchConfig dal preset.
    forgeLabStore.set({ quality: q });
  };

  const meta = getDeepSearchMeta(lab.quality);
  const sources = getDeepSearchSources(lab.quality);

  const enrichment = enrichmentQuery.data?.data as PartnerEnrichment | null;
  const enrichmentJson = enrichment?.enrichment_data ?? enrichment?.raw_data ?? null;
  const deepAt = enrichment?.deep_search_at
    ?? (enrichmentJson && typeof enrichmentJson === "object" && "deep_search_at" in enrichmentJson ? String((enrichmentJson as Record<string, unknown>).deep_search_at) : null);

  const isPartnerKind = enrichmentQuery.data?.kind === "partner";
  const profileDescription = enrichment?.profile_description ?? null;
  const rawHtmlLen = enrichment?.raw_profile_html?.length ?? 0;
  const rawMdLen = enrichment?.raw_profile_markdown?.length ?? 0;
  const profileDescLen = profileDescription?.length ?? 0;
  const hasSyncedProfile = !!(profileDescription || rawHtmlLen || rawMdLen);
  const profileMissing = isPartnerKind && !hasSyncedProfile;

  return (
    <div className="space-y-2 text-xs">
      {/* QUALITY PRESET PANEL — auto-determina le fonti */}
      <div className="rounded-md border border-border/40 bg-muted/30 p-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Profondità Deep Search</div>
          <span className="text-[9px] text-muted-foreground font-mono">~{meta.estimatedSecondsPerRecord}s/record</span>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <QualityButton icon={Zap} label="Fast" active={lab.quality === "fast"} onClick={() => setQuality("fast")} />
          <QualityButton icon={ThumbsUp} label="Standard" active={lab.quality === "standard"} onClick={() => setQuality("standard")} />
          <QualityButton icon={Trophy} label="Premium" active={lab.quality === "premium"} onClick={() => setQuality("premium")} />
        </div>

        <div className="rounded border border-primary/20 bg-primary/5 p-1.5 flex items-start gap-1.5">
          <Info className="w-3 h-3 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium text-foreground">{meta.label} include:</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {meta.includedLabels.map((l) => (
                <Badge key={l} variant="secondary" className="text-[9px] py-0 px-1.5 h-4 font-normal">{l}</Badge>
              ))}
            </div>
            <div className="text-[9px] text-muted-foreground mt-1 leading-tight">{meta.description}</div>
          </div>
        </div>

        {/* Override avanzato: solo dominio prioritario, nessun toggle. */}
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground flex items-center justify-between">
            <span>Dominio prioritario (override avanzato)</span>
            <span className="font-mono text-muted-foreground/60">max {sources.maxQueriesPerContact} query</span>
          </Label>
          <Input
            value={dsConfig.priorityDomain}
            onChange={(e) => updateConfig({ priorityDomain: e.target.value })}
            placeholder="es. transmgmt — opzionale"
            className="h-6 text-[10px]"
          />
        </div>
      </div>

      {/* PROFILE STATUS */}
      {isPartnerKind && (
        <div className={`rounded-md border p-2.5 ${profileMissing ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/40 bg-emerald-500/10"}`}>
          <div className="flex items-start gap-2">
            {profileMissing ? (
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className={`text-[11px] font-semibold ${profileMissing ? "text-amber-900 dark:text-amber-200" : "text-emerald-900 dark:text-emerald-200"}`}>
                {profileMissing ? "Profilo testuale assente" : "Profilo sincronizzato disponibile"}
              </div>
              <div className={`text-[10px] ${profileMissing ? "text-amber-800/80 dark:text-amber-200/80" : "text-emerald-800/80 dark:text-emerald-200/80"}`}>
                {profileMissing
                  ? "Nessuna descrizione, HTML o markdown presente. La Deep Search funzionerà ma senza contesto testuale."
                  : "L'AI dispone del profilo sincronizzato. La Deep Search aggiunge social, contatti e rating."}
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
            <SourceRow label="profile_description" value={profileDescLen ? `${profileDescLen} char` : null} />
            <SourceRow label="raw_profile_html" value={rawHtmlLen ? `${rawHtmlLen} char` : null} />
            <SourceRow label="raw_profile_markdown" value={rawMdLen ? `${rawMdLen} char` : null} />
            <SourceRow label="enrichment_data" value={enrichmentJson ? "presente" : null} />
            <SourceRow label="ai_parsed_at" value={enrichment?.ai_parsed_at ? new Date(enrichment.ai_parsed_at).toLocaleDateString("it-IT") : null} />
            <SourceRow label="deep_search_at" value={deepAt ? new Date(deepAt).toLocaleDateString("it-IT") : null} />
          </div>
        </div>
      )}

      {/* RUN BUTTONS */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!recipient.partnerId || ds.running}
          onClick={() => handleRun("partner")} className="h-7 text-[10px]">
          {ds.running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Search className="w-3 h-3 mr-1" />}
          Deep Search Partner
        </Button>
        <Button size="sm" variant="outline" disabled={!recipient.contactId || ds.running}
          onClick={() => handleRun("contact")} className="h-7 text-[10px]">
          <Search className="w-3 h-3 mr-1" />
          Deep Search Contatto
        </Button>
        {onRefreshGeneration && (
          <Button size="sm" variant="ghost" onClick={onRefreshGeneration} className="h-7 text-[10px]">
            <RefreshCw className="w-3 h-3 mr-1" /> Re-genera mail
          </Button>
        )}
      </div>

      {/* CASCADE TIMELINE */}
      {(ds.running || timeline.length > 0) && (
        <div className="rounded border border-border/40 p-2 bg-muted/20 space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Loader2 className={`w-2.5 h-2.5 ${ds.running ? "animate-spin" : ""}`} />
            Cascade query · {timeline.length}
          </div>
          {timeline.length === 0 && (
            <div className="text-[10px] text-muted-foreground italic">In attesa della prima query…</div>
          )}
          {timeline.map((t, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono">
              {t.status === "running" ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin text-primary shrink-0" />
              ) : t.results && t.results > 0 ? (
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Circle className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
              )}
              <span className="truncate flex-1">{t.query}</span>
              <span className="text-muted-foreground shrink-0">
                {t.status === "running" ? "…" : `${t.results ?? 0} risultati`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <Badge variant="outline">{recipient.source}</Badge>
        {deepAt ? (
          <Badge className="bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400">
            <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
            Deep Search · {new Date(deepAt).toLocaleString("it-IT")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <AlertCircle className="w-2.5 h-2.5 mr-1" />
            Nessuna deep search registrata
          </Badge>
        )}
      </div>

      {ds.results.length > 0 && (
        <div className="rounded border border-border/40 p-2 bg-muted/30 space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Risultati ultima esecuzione</div>
          {ds.results.map((r) => (
            <div key={r.partnerId} className="text-[11px] flex items-center justify-between">
              <span className="truncate">{r.companyName}</span>
              <span className="text-muted-foreground shrink-0 ml-2">
                ⭐ {r.rating} · {r.socialLinksFound} link · {r.contactProfilesFound} profili{r.error ? ` · errore: ${r.error}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CARD RIEPILOGO POST-RUN — mostra esplicitamente cosa è stato salvato in DB */}
      {savedSummary && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2.5">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">
                ✅ Salvato in database — Deep Search {savedSummary.quality.toUpperCase()}
              </div>
              <div className="text-[10px] text-emerald-800/80 dark:text-emerald-200/80 mt-0.5">
                {savedSummary.when}
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono text-emerald-900 dark:text-emerald-200">
            <SourceRow label="partner_social_links" value={`+${savedSummary.socialLinks}`} />
            <SourceRow label="contact_profiles" value={`+${savedSummary.contactProfiles}`} />
            <SourceRow label="rating ricalcolato" value={savedSummary.rating > 0 ? `${savedSummary.rating}/100` : "—"} />
            <SourceRow label="enrichment_data.deep_search_at" value="aggiornato" />
            {savedSummary.errors > 0 && (
              <SourceRow label="errori" value={String(savedSummary.errors)} />
            )}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Enrichment grezzo</div>
        <pre className="text-[10px] bg-muted/40 p-2 rounded border border-border/40 max-h-[180px] overflow-auto font-mono">
          {enrichmentJson ? JSON.stringify(enrichmentJson, null, 2) : "(nessun dato)"}
        </pre>
      </div>
    </div>
  );
}

function QualityButton({
  icon: Icon, label, active, onClick,
}: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 rounded border px-2 py-1.5 transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/40 bg-card hover:bg-muted text-muted-foreground"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function SourceRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={value ? "text-foreground" : "text-muted-foreground/50"}>{value ?? "—"}</span>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-[11px] text-muted-foreground py-4 text-center">{msg}</div>;
}
