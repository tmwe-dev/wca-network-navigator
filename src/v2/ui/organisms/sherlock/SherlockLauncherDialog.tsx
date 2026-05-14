/**
 * SherlockLauncherDialog — dialog leggero per lanciare un'indagine Sherlock
 * (Scout / Detective / Sherlock) su un partner o contatto, senza dover passare
 * da Email Forge. Mostra timeline step minimale + sintesi.
 *
 * NB: usa `useSherlock` (motore unico — vedi mem://architecture/sherlock-as-unified-deep-search).
 */
import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, ScanSearch, Telescope, Square, X, CheckCircle2, AlertCircle, SkipForward, Database } from "lucide-react";
import { useSherlock } from "@/v2/hooks/useSherlock";
import { extractLinkedinCompanySlug } from "@/v2/services/sherlock/sherlockEngine";
import type { SherlockLevel, SherlockStepResult } from "@/v2/services/sherlock/sherlockTypes";

export interface SherlockLauncherTarget {
  partnerId: string | null;
  contactId: string | null;
  companyName: string | null;
  contactName?: string | null;
  city?: string | null;
  countryName?: string | null;
  countryCode?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: SherlockLauncherTarget | null;
  /** Pre-seleziona un livello da avviare automaticamente all'apertura. */
  autoStartLevel?: SherlockLevel;
}

const LEVEL_META: Record<SherlockLevel, { label: string; Icon: typeof Search; eta: string }> = {
  1: { label: "Scout", Icon: Search, eta: "~30s" },
  2: { label: "Detective", Icon: ScanSearch, eta: "~2min" },
  3: { label: "Sherlock", Icon: Telescope, eta: "~5min" },
};

export function SherlockLauncherDialog({ open, onOpenChange, target, autoStartLevel }: Props): React.ReactElement {
  const vars = React.useMemo<Record<string, string>>(() => {
    if (!target) return {} as Record<string, string>;
    return {
      companyName: target.companyName ?? "",
      city: target.city ?? target.countryName ?? target.countryCode ?? "",
      websiteUrl: target.website?.trim() ?? "",
      query: `${target.companyName ?? ""} ${target.countryName ?? ""}`.trim(),
      linkedinCompanySlug: extractLinkedinCompanySlug(target.linkedinUrl) ?? "",
    };
  }, [target]);

  const sherlock = useSherlock({
    partnerId: target?.partnerId ?? null,
    contactId: target?.contactId ?? null,
    targetLabel: target?.companyName ?? target?.contactName ?? null,
    vars,
  });

  const autoStartedRef = React.useRef(false);
  const ranOnceRef = React.useRef(false);
  const autoCloseRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (open && autoStartLevel && !autoStartedRef.current && !sherlock.running && vars.companyName) {
      autoStartedRef.current = true;
      sherlock.start(autoStartLevel);
    }
    if (!open) {
      autoStartedRef.current = false;
      ranOnceRef.current = false;
      if (autoCloseRef.current) { clearTimeout(autoCloseRef.current); autoCloseRef.current = null; }
      sherlock.stop();
    }
  }, [open, autoStartLevel, vars.companyName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marca che almeno una run è stata avviata (per distinguere "mai partita" da "appena finita")
  React.useEffect(() => {
    if (sherlock.running) ranOnceRef.current = true;
  }, [sherlock.running]);

  // Auto-close quando la Deep Search finisce: lasciamo 1.8s per leggere la sintesi, poi chiudiamo.
  React.useEffect(() => {
    if (!open) return;
    if (sherlock.running) return;
    if (!ranOnceRef.current) return;
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    autoCloseRef.current = setTimeout(() => {
      onOpenChange(false);
    }, 1800);
    return () => {
      if (autoCloseRef.current) { clearTimeout(autoCloseRef.current); autoCloseRef.current = null; }
    };
  }, [open, sherlock.running, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-[92vw] h-[80vh] p-0 gap-0 flex flex-col overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Search className="w-4 h-4 text-primary" />
            Deep Search Sherlock
            {target && (
              <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                {target.companyName ?? target.contactName ?? "Target"}
              </Badge>
            )}
          </DialogTitle>

          <div className="flex items-center gap-1.5">
            {([1, 2, 3] as SherlockLevel[]).map((lvl) => {
              const meta = LEVEL_META[lvl];
              const Icon = meta.Icon;
              const isRunning = sherlock.running === lvl;
              return (
                <Button
                  key={lvl}
                  size="sm"
                  variant={isRunning ? "default" : "outline"}
                  disabled={!!sherlock.running}
                  onClick={() => sherlock.start(lvl)}
                  className="h-7 px-2 text-[11px] gap-1"
                >
                  {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                  {meta.label}
                  <span className="text-[10px] text-foreground/60 ml-0.5">{meta.eta}</span>
                </Button>
              );
            })}
            {sherlock.running && (
              <Button size="sm" variant="destructive" onClick={sherlock.stop} className="h-7 text-[11px] gap-1">
                <Square className="w-3 h-3 fill-current" /> Stop
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} className="h-7 w-7 p-0">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {sherlock.stepResults.length === 0 && (
                <div className="text-xs text-foreground/70 italic px-2 py-8 text-center">
                  Scegli un livello in alto per avviare l&apos;indagine.
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Scout = rapido/gratis · Detective = standard · Sherlock = profondo
                  </div>
                </div>
              )}
              {sherlock.stepResults.map((r) => (
                <StepLine key={r.order} result={r} />
              ))}
            </div>
          </ScrollArea>

          {sherlock.summary && (
            <div className="border-t border-border bg-primary/5 px-4 py-2.5 text-xs text-foreground shrink-0 max-h-[30%] overflow-y-auto">
              <div className="text-[10px] font-semibold uppercase text-primary mb-1">Sintesi</div>
              {sherlock.summary}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepLine({ result }: { result: SherlockStepResult }) {
  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded text-[11px] border border-transparent hover:bg-muted/40">
      <StatusIcon status={result.status} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-foreground">
          {result.order}. {result.label}
        </div>
        <div className="text-[10px] text-foreground/60 truncate">
          {result.channel}
          {result.duration_ms ? ` · ${(result.duration_ms / 1000).toFixed(1)}s` : ""}
          {result.cache_hit ? " · cache" : ""}
          {result.confidence !== null ? ` · AI ${Math.round(result.confidence * 100)}%` : ""}
        </div>
        {result.status === "error" && result.error && (
          <div className="text-[10px] text-destructive truncate">{result.error}</div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: SherlockStepResult["status"] }) {
  const cls = "w-3.5 h-3.5 shrink-0 mt-0.5";
  if (status === "running") return <Loader2 className={`${cls} animate-spin text-primary`} />;
  if (status === "done") return <CheckCircle2 className={`${cls} text-emerald-500`} />;
  if (status === "cached") return <Database className={`${cls} text-blue-500`} />;
  if (status === "skipped") return <SkipForward className={`${cls} text-muted-foreground`} />;
  if (status === "pending") return <div className={`${cls} rounded-full border border-muted-foreground/40`} />;
  return <AlertCircle className={`${cls} text-destructive`} />;
}

export default SherlockLauncherDialog;