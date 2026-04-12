import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, CheckCircle2, Building2, User, MapPin, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useUpdateBusinessCard } from "@/hooks/useBusinessCards";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { createLogger } from "@/lib/log";

const log = createLogger("AIMatchDialog");

interface MatchCandidate {
  partner_id: string;
  confidence: number;
  reason: string;
  partner_company: string;
  partner_alias: string;
  partner_country: string;
  partner_country_code: string;
  partner_city: string;
}

interface MatchResult {
  card_id: string;
  card_company: string;
  card_contact: string;
  card_email: string;
  card_phone: string;
  card_location: string;
  candidates: MatchCandidate[];
}

function countryFlag(code: string | null): string {
  if (!code) return "🌍";
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); return "🌍"; }
}

function confidenceColor(c: number): string {
  if (c >= 85) return "bg-emerald-500";
  if (c >= 70) return "bg-primary";
  if (c >= 50) return "bg-primary/70";
  return "bg-muted";
}

function confidenceBadge(c: number): string {
  if (c >= 85) return "bg-emerald-500/15 text-emerald-400";
  if (c >= 70) return "bg-primary/15 text-primary";
  return "bg-primary/10 text-primary/80";
}

export function AIMatchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [totalUnmatched, setTotalUnmatched] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [confirming, setConfirming] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const updateCard = useUpdateBusinessCard();
  const qc = useQueryClient();

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setResults([]);
    setSelected(new Map());
    setHasRun(true);
    try {
      const data = await invokeEdge<any>("ai-match-business-cards", { body: { batch_offset: 0, batch_size: 20 }, context: "AIMatchDialog.ai_match_business_cards" });
      if (data.error) throw new Error(data.error);
      setResults(data.matches || []);
      setTotalUnmatched(data.total_unmatched || 0);
      setProcessed(data.processed || 0);
    } catch (e: any) {
      toast({ title: "Errore AI Match", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSelect = useCallback((cardId: string, partnerId: string) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.get(cardId) === partnerId) {
        next.delete(cardId);
      } else {
        next.set(cardId, partnerId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const newSelected = new Map<string, string>();
    results.forEach(r => {
      if (r.candidates.length > 0 && r.candidates[0].confidence >= 70) {
        newSelected.set(r.card_id, r.candidates[0].partner_id);
      }
    });
    setSelected(newSelected);
  }, [results]);

  const confirmSelected = useCallback(async () => {
    if (selected.size === 0) return;
    setConfirming(true);
    let ok = 0, fail = 0;
    for (const [cardId, partnerId] of selected) {
      try {
        await updateCard.mutateAsync({ id: cardId, matched_partner_id: partnerId, match_status: "matched", match_confidence: 100 } as any);
        ok++;
      } catch (e) {
        log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
        fail++;
      }
    }
    qc.invalidateQueries({ queryKey: ["business-cards"] });
    qc.invalidateQueries({ queryKey: ["business-card-matches"] });
    toast({ title: `✅ ${ok} match confermati${fail > 0 ? ` · ${fail} errori` : ""}` });
    setResults(prev => prev.filter(r => !selected.has(r.card_id)));
    setSelected(new Map());
    setConfirming(false);
  }, [selected, updateCard, qc]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Matching — Biglietti da Visita ↔ Partner
          </DialogTitle>
        </DialogHeader>

        {/* Actions bar */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            size="sm"
            className="text-xs gap-1.5"
            onClick={runAnalysis}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {hasRun ? "Ri-analizza" : "Avvia analisi AI"}
          </Button>

          {results.length > 0 && (
            <>
              <Button variant="outline" size="sm" className="text-xs gap-1 border-primary/15" onClick={selectAll}>
                Seleziona sicuri (≥70%)
              </Button>
              <Badge variant="outline" className="text-[10px] h-6 border-primary/15">
                {results.length} candidati trovati
              </Badge>
              {totalUnmatched > processed && (
                <Badge variant="outline" className="text-[10px] h-6 border-primary/15 text-primary">
                  +{totalUnmatched - processed} non analizzati
                </Badge>
              )}
            </>
          )}

          {selected.size > 0 && (
            <Button
              size="sm"
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 ml-auto"
              onClick={confirmSelected}
              disabled={confirming}
            >
              {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Conferma {selected.size} match
            </Button>
          )}
        </div>

        {/* Results list */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 mt-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Analisi AI in corso… confronto nomi aziende</p>
            </div>
          )}

          {!loading && hasRun && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/50" />
              <p className="text-sm text-muted-foreground">Nessun match trovato o tutti già associati</p>
            </div>
          )}

          {!loading && !hasRun && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Sparkles className="w-8 h-8 text-primary/30" />
              <p className="text-sm text-muted-foreground">Clicca "Avvia analisi AI" per trovare match</p>
              <p className="text-xs text-muted-foreground/60">L'AI confronterà i biglietti senza match con il database partner</p>
            </div>
          )}

          {results.map((match) => (
            <div key={match.card_id} className="rounded-lg border border-border/50 bg-muted/10 overflow-hidden">
              {match.candidates.map((candidate, ci) => {
                const isSelected = selected.get(match.card_id) === candidate.partner_id;
                return (
                  <div
                    key={candidate.partner_id}
                    className={cn(
                      "flex items-stretch gap-0 transition-colors cursor-pointer hover:bg-muted/30",
                      ci > 0 && "border-t border-border/30",
                      isSelected && "bg-emerald-500/10",
                    )}
                    onClick={() => toggleSelect(match.card_id, candidate.partner_id)}
                  >
                    <div className="flex items-center justify-center w-10 shrink-0">
                      <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1 min-w-0 py-2.5 pr-3 space-y-0.5">
                      {ci === 0 && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-sm font-semibold text-foreground truncate">{match.card_company}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-5">
                            {match.card_contact && (
                              <span className="flex items-center gap-1"><User className="w-3 h-3" />{match.card_contact}</span>
                            )}
                            {match.card_email && (
                              <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{match.card_email}</span>
                            )}
                            {match.card_phone && (
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{match.card_phone}</span>
                            )}
                            {match.card_location && (
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{match.card_location}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-center w-20 shrink-0 gap-1">
                      <Badge className={cn("text-[10px] px-1.5", confidenceBadge(candidate.confidence))}>
                        {candidate.confidence}%
                      </Badge>
                      <div className="w-12 h-1 bg-muted/40 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", confidenceColor(candidate.confidence))}
                          style={{ width: `${candidate.confidence}%` }} />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 py-2.5 pl-3 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm shrink-0">{countryFlag(candidate.partner_country_code)}</span>
                        <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">{candidate.partner_company}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-5">
                        {candidate.partner_alias && <span className="truncate italic">"{candidate.partner_alias}"</span>}
                        {candidate.partner_city && (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{candidate.partner_city}</span>
                        )}
                        {candidate.partner_country && <span>{candidate.partner_country}</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 ml-5 italic">{candidate.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
