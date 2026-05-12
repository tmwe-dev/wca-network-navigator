/**
 * IterationCard — singola card "versione" della bozza email nel laboratorio.
 * Mostra: subject, body (rendered o diff vs precedente), badge journalist,
 * meta (model · ms · tokens), accordion system/user prompt + blocchi.
 */
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Clock, Cpu, Sparkles, ShieldCheck, AlertTriangle, Ban, FileText, Wrench } from "lucide-react";
import type { LabIteration } from "@/v2/hooks/useEmailLabIterations";
import { DiffView } from "./DiffView";

interface Props {
  iteration: LabIteration;
  index: number;
  previous?: LabIteration | null;
}

function VerdictBadge({ verdict, score }: { verdict?: string; score?: number }) {
  if (!verdict) return null;
  const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pass: { color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", icon: <ShieldCheck className="h-3 w-3" />, label: "Pass" },
    pass_with_edits: { color: "bg-sky-500/15 text-sky-300 border-sky-500/40", icon: <Sparkles className="h-3 w-3" />, label: "Pass + edits" },
    warn: { color: "bg-amber-500/15 text-amber-300 border-amber-500/40", icon: <AlertTriangle className="h-3 w-3" />, label: "Warn" },
    block: { color: "bg-rose-500/15 text-rose-300 border-rose-500/40", icon: <Ban className="h-3 w-3" />, label: "Block" },
  };
  const m = map[verdict] ?? map.warn;
  return (
    <Badge variant="outline" className={`gap-1 ${m.color}`}>
      {m.icon}
      {m.label}{typeof score === "number" ? ` · ${Math.round(score)}` : ""}
    </Badge>
  );
}

function CollapsibleSection({ icon: Icon, label, children, defaultOpen = false }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-full justify-start gap-1.5 px-2 text-xs text-foreground/70 hover:text-foreground">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Icon className="h-3 w-3" />
          {label}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 rounded border border-border/50 bg-muted/20 p-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function IterationCard({ iteration, index, previous }: Props): React.ReactElement {
  const [showDiff, setShowDiff] = React.useState(true);
  const r = iteration.result;
  const dbg = r._debug;
  const review = r.journalist_review;
  const canDiff = !!previous;

  return (
    <Card className="w-[420px] shrink-0 border-border/60 bg-card/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground/90">
            <span className="text-foreground/50 mr-1">#{index + 1}</span>{iteration.label}
          </CardTitle>
          <VerdictBadge verdict={review?.verdict} score={review?.quality_score} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground/60">
          <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> {r.model}</span>
          <span>·</span>
          <span>{r.quality}</span>
          {dbg?.ai_latency_ms != null && (
            <><span>·</span><span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {dbg.ai_latency_ms}ms</span></>
          )}
          <span>·</span>
          <span>tot {iteration.elapsedMs}ms</span>
          {(dbg?.tokens_in != null || dbg?.tokens_out != null) && (
            <><span>·</span><span>{(dbg?.tokens_in ?? 0) + (dbg?.tokens_out ?? 0)} tok</span></>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-foreground/50">Subject</div>
          <div className="text-sm font-medium text-foreground/90">{r.subject || <em className="text-foreground/40">vuoto</em>}</div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wide text-foreground/50">Body</div>
            {canDiff && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setShowDiff((v) => !v)}>
                {showDiff ? "Mostra integrale" : "Mostra diff vs precedente"}
              </Button>
            )}
          </div>
          <div className="max-h-[280px] overflow-auto rounded border border-border/50 bg-background/40 p-2">
            {showDiff && previous
              ? <DiffView before={previous.result.body} after={r.body} />
              : <div className="whitespace-pre-wrap text-sm text-foreground/85">{r.body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")}</div>}
          </div>
        </div>

        {review?.warnings && review.warnings.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-foreground/50">Journalist · {review.warnings.length} warning</div>
            <ul className="space-y-1 text-[11px] text-foreground/70">
              {review.warnings.slice(0, 4).map((w, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className={
                    w.severity === "blocking" ? "text-rose-300" : w.severity === "warning" ? "text-amber-300" : "text-sky-300"
                  }>●</span>
                  <span>{w.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {dbg?.systemPrompt && (
          <CollapsibleSection icon={FileText} label={`System prompt (${Math.round((dbg.systemPrompt.length || 0) / 100) / 10}k char)`}>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-foreground/75">{dbg.systemPrompt}</pre>
          </CollapsibleSection>
        )}
        {dbg?.userPrompt && (
          <CollapsibleSection icon={FileText} label="User prompt">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-foreground/75">{dbg.userPrompt}</pre>
          </CollapsibleSection>
        )}
        {dbg?.blocks && dbg.blocks.length > 0 && (
          <CollapsibleSection icon={Wrench} label={`Blocchi prompt (${dbg.blocks.length})`}>
            <div className="space-y-2">
              {dbg.blocks.map((b, i) => (
                <div key={i}>
                  <div className="text-[10px] uppercase tracking-wide text-foreground/50">{b.label}</div>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-foreground/75">{b.content}</pre>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
        {review?.reasoning && (
          <CollapsibleSection icon={ShieldCheck} label="Reasoning journalist">
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-foreground/75">{review.reasoning}</pre>
          </CollapsibleSection>
        )}
      </CardContent>
    </Card>
  );
}