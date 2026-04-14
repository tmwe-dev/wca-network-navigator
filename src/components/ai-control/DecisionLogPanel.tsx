/**
 * DecisionLogPanel — Displays ai_decision_log with filters and pagination
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Zap, Check, X, Pencil, Clock, ChevronDown, ChevronUp, Brain,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

const DECISION_TYPES: Record<string, { color: string; label: string }> = {
  classify_email: { color: "bg-blue-400/10 text-blue-400", label: "Classifica Email" },
  generate_reply: { color: "bg-emerald-400/10 text-emerald-400", label: "Genera Risposta" },
  schedule_followup: { color: "bg-cyan-400/10 text-cyan-400", label: "Follow-up" },
  advance_workflow: { color: "bg-pink-400/10 text-pink-400", label: "Avanza Workflow" },
  change_channel: { color: "bg-amber-400/10 text-amber-400", label: "Cambia Canale" },
  auto_execute: { color: "bg-purple-400/10 text-purple-400", label: "Auto-Esecuzione" },
  suggest_action: { color: "bg-orange-400/10 text-orange-400", label: "Suggerisci Azione" },
};

const REVIEW_ICONS: Record<string, { icon: typeof Check; color: string }> = {
  approved: { icon: Check, color: "text-emerald-400" },
  rejected: { icon: X, color: "text-red-400" },
  modified: { icon: Pencil, color: "text-yellow-400" },
};

const PAGE_SIZE = 20;

export function DecisionLogPanel() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [autoOnly, setAutoOnly] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-decision-log", typeFilter, autoOnly, searchEmail, page],
    queryFn: async () => {
      let q = supabase
        .from("ai_decision_log")
        .select("*, partners(company_name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (typeFilter !== "all") q = q.eq("decision_type", typeFilter);
      if (autoOnly) q = q.eq("was_auto_executed", true);
      if (searchEmail.trim()) q = q.ilike("email_address", `%${searchEmail.trim()}%`);
      const { data: rows, error, count } = await q;
      if (error) throw error;
      return { rows: rows ?? [], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Tipo decisione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {Object.entries(DECISION_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          placeholder="Cerca email..."
          value={searchEmail}
          onChange={(e) => { setSearchEmail(e.target.value); setPage(0); }}
          className="w-48 h-8 text-xs"
        />
        <div className="flex items-center gap-2">
          <Switch id="auto-only" checked={autoOnly} onCheckedChange={(v) => { setAutoOnly(v); setPage(0); }} />
          <Label htmlFor="auto-only" className="text-xs text-muted-foreground">Solo auto-eseguite</Label>
        </div>
        <Badge variant="secondary" className="text-xs ml-auto">{total} decisioni</Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Brain className="h-12 w-12 mb-3 text-primary/30" />
          <p className="text-sm">Nessuna decisione trovata</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-2 pr-2">
            {rows.map((row) => {
              const dt = DECISION_TYPES[row.decision_type] ?? { color: "bg-muted text-muted-foreground", label: row.decision_type };
              const review = row.user_review ? REVIEW_ICONS[row.user_review] : null;
              const ReviewIcon = review?.icon ?? Clock;
              const expanded = expandedId === row.id;
              const partnerName = (row as any).partners?.company_name; // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase join type not in generated types

              return (
                <div key={row.id} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[10px] px-1.5 ${dt.color}`}>{dt.label}</Badge>
                    {row.was_auto_executed && <Zap className="h-3.5 w-3.5 text-amber-400" />}
                    <ReviewIcon className={`h-3.5 w-3.5 ${review?.color ?? "text-muted-foreground"}`} />
                    {row.confidence != null && (
                      <Badge variant="outline" className="text-[10px]">{Math.round(row.confidence * 100)}%</Badge>
                    )}
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {row.email_address ?? partnerName ?? "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {row.created_at ? formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: it }) : ""}
                    </span>
                    <button onClick={() => setExpandedId(expanded ? null : row.id)} className="p-0.5 text-muted-foreground hover:text-foreground">
                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {expanded && (
                    <div className="mt-3 space-y-2 text-xs text-muted-foreground border-t border-border/30 pt-3">
                      {row.ai_reasoning && <div><span className="font-medium text-foreground">Ragionamento:</span> {row.ai_reasoning}</div>}
                      {row.model_used && <div><span className="font-medium text-foreground">Modello:</span> {row.model_used}</div>}
                      {row.tokens_used != null && <div><span className="font-medium text-foreground">Token:</span> {row.tokens_used}</div>}
                      {row.execution_time_ms != null && <div><span className="font-medium text-foreground">Tempo:</span> {row.execution_time_ms}ms</div>}
                      {row.user_correction && <div><span className="font-medium text-foreground">Correzione utente:</span> {row.user_correction}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-xs h-7">← Precedente</Button>
          <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="text-xs h-7">Successiva →</Button>
        </div>
      )}
    </div>
  );
}
