/**
 * DeepSearchTab — inspect last enrichment + trigger live Deep Search.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { Search, RefreshCw, AlertCircle, CheckCircle2, Loader2, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { ForgeRecipient } from "../ForgeRecipientPicker";

interface Props {
  recipient: ForgeRecipient | null;
  onRefreshGeneration?: () => void;
}

export function DeepSearchTab({ recipient, onRefreshGeneration }: Props) {
  const ds = useDeepSearch();
  const navigate = useNavigate();

  const enrichmentQuery = useQuery({
    queryKey: ["forge-enrichment", recipient?.source, recipient?.recordId],
    enabled: !!recipient,
    queryFn: async () => {
      if (!recipient) return null;
      if (recipient.source === "partner" || (recipient.source === "bca" && recipient.partnerId)) {
        const id = recipient.partnerId!;
        const { data } = await supabase
          .from("partners")
          .select("id, enrichment_data, raw_profile_html, raw_profile_markdown, ai_parsed_at")
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

  if (!recipient) {
    return (
      <Empty msg="Seleziona un destinatario reale a sinistra per ispezionare la sua deep search." />
    );
  }

  const handleRun = (mode: "partner" | "contact") => {
    const targetId = mode === "partner" ? recipient.partnerId : recipient.contactId;
    if (!targetId) {
      toast.error("ID non disponibile per questa modalità");
      return;
    }
    ds.start([targetId], true, mode);
  };

  const enrichment = enrichmentQuery.data?.data as { enrichment_data?: Record<string, unknown> | null; deep_search_at?: string | null; raw_profile_html?: string | null; raw_profile_markdown?: string | null; ai_parsed_at?: string | null; raw_data?: Record<string, unknown> | null } | null;
  const enrichmentJson = enrichment?.enrichment_data ?? enrichment?.raw_data ?? null;
  const deepAt = enrichment?.deep_search_at
    ?? (enrichmentJson && typeof enrichmentJson === "object" && "deep_search_at" in enrichmentJson ? String((enrichmentJson as Record<string, unknown>).deep_search_at) : null);

  // Per partner: serve il profilo WCA scaricato prima della Deep Search.
  const isPartnerKind = enrichmentQuery.data?.kind === "partner";
  const hasWcaProfile = !!(enrichment?.raw_profile_html || enrichment?.raw_profile_markdown);
  const missingWcaProfile = isPartnerKind && !hasWcaProfile;

  const goToDownloadCenter = () => {
    navigate("/v2/settings?tab=download");
  };

  return (
    <div className="space-y-2 text-xs">
      {missingWcaProfile && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-1.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                Profilo WCA mancante
              </div>
              <div className="text-[10px] text-amber-800/80 dark:text-amber-200/80">
                Questo partner non ha ancora il profilo WCA scaricato. Scaricalo prima dal Download Center, poi esegui la Deep Search per ottenere risultati di qualità.
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={goToDownloadCenter} className="h-6 text-[10px] gap-1 border-amber-500/40">
              <Download className="w-3 h-3" /> Apri Download Center
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleRun("partner")} disabled={ds.running} className="h-6 text-[10px] gap-1">
              <Search className="w-3 h-3" /> Esegui comunque
            </Button>
          </div>
        </div>
      )}

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
        {ds.running && (
          <Badge className="bg-primary/10 text-primary border-primary/30">
            <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
            In esecuzione…
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

      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Enrichment grezzo</div>
        <pre className="text-[10px] bg-muted/40 p-2 rounded border border-border/40 max-h-[180px] overflow-auto font-mono">
          {enrichmentJson ? JSON.stringify(enrichmentJson, null, 2) : "(nessun dato)"}
        </pre>
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-[11px] text-muted-foreground py-4 text-center">{msg}</div>;
}
