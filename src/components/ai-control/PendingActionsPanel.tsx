/**
 * PendingActionsPanel — Displays and manages ai_pending_actions
 * Including prompt refinement suggestions from agent-prompt-refiner.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck, CheckCircle, XCircle, Mail, Reply, Archive,
  ListTodo, Forward, Clock, ChevronDown, ChevronUp, Zap, Bot, User, Workflow,
  Sparkles, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

const ACTION_META: Record<string, { icon: typeof Mail; color: string; label: string }> = {
  send_email: { icon: Mail, color: "text-blue-400 bg-blue-400/10", label: "Invia Email" },
  send_whatsapp: { icon: Mail, color: "text-green-400 bg-green-400/10", label: "WhatsApp" },
  reply: { icon: Reply, color: "text-emerald-400 bg-emerald-400/10", label: "Rispondi" },
  forward: { icon: Forward, color: "text-orange-400 bg-orange-400/10", label: "Inoltra" },
  archive: { icon: Archive, color: "text-yellow-400 bg-yellow-400/10", label: "Archivia" },
  create_task: { icon: ListTodo, color: "text-purple-400 bg-purple-400/10", label: "Crea Task" },
  create_reminder: { icon: Clock, color: "text-cyan-400 bg-cyan-400/10", label: "Reminder" },
  advance_gate: { icon: Workflow, color: "text-pink-400 bg-pink-400/10", label: "Avanza Gate" },
  change_channel: { icon: Zap, color: "text-amber-400 bg-amber-400/10", label: "Cambia Canale" },
  schedule_followup: { icon: Clock, color: "text-sky-400 bg-sky-400/10", label: "Follow-up" },
  prompt_refinement: { icon: Sparkles, color: "text-violet-400 bg-violet-400/10", label: "Refinement Prompt" },
};

const SOURCE_META: Record<string, { icon: typeof Bot; label: string }> = {
  ai_classifier: { icon: Bot, label: "Classificatore" },
  cadence_engine: { icon: Clock, label: "Cadenza" },
  workflow_gate: { icon: Workflow, label: "Workflow" },
  ai_assistant: { icon: Zap, label: "Assistente" },
  manual: { icon: User, label: "Manuale" },
};

export function PendingActionsPanel() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ["ai-pending-actions", typeFilter, sourceFilter],
    queryFn: async () => {
      let q = supabase
        .from("ai_pending_actions")
        .select("*, partners(company_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (typeFilter !== "all") q = q.eq("action_type", typeFilter);
      if (sourceFilter !== "all") q = q.eq("source", sourceFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const action = actions.find(a => a.id === id);
      const { error } = await supabase.from("ai_pending_actions").update({ status: "approved", executed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      if (action?.decision_log_id) {
        await supabase.from("ai_decision_log").update({ user_review: "approved" }).eq("id", action.decision_log_id);
      }
      // Handle prompt_refinement: apply suggestions to agent system_prompt
      if (action?.action_type === "prompt_refinement" && action.suggested_content) {
        try {
          const suggestions = JSON.parse(action.suggested_content);
          // Find agent from reasoning or via pending action context
          const { data: agents } = await supabase.from("agents").select("id, system_prompt").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").eq("is_active", true);
          if (agents?.length) {
            const agent = agents[0];
            let updatedPrompt = agent.system_prompt || "";
            for (const s of suggestions) {
              if (s.current_text && updatedPrompt.includes(s.current_text)) {
                updatedPrompt = updatedPrompt.replace(s.current_text, s.suggested_text);
              } else if (s.suggested_text) {
                updatedPrompt += `\n\n${s.suggested_text}`;
              }
            }
            await supabase.from("agents").update({ system_prompt: updatedPrompt }).eq("id", agent.id);
          }
        } catch (e) { console.warn("prompt refinement apply failed:", e); }
      }
    },
    onSuccess: () => { toast.success("Azione approvata"); qc.invalidateQueries({ queryKey: ["ai-pending-actions"] }); },
    onError: () => toast.error("Errore nell'approvazione"),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const action = actions.find(a => a.id === id);
      const { error } = await supabase.from("ai_pending_actions").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
      if (action?.decision_log_id) {
        await supabase.from("ai_decision_log").update({ user_review: "rejected", user_correction: reason || null }).eq("id", action.decision_log_id);
      }
    },
    onSuccess: () => { toast.success("Azione rifiutata"); setRejectId(null); setRejectReason(""); qc.invalidateQueries({ queryKey: ["ai-pending-actions"] }); },
    onError: () => toast.error("Errore nel rifiuto"),
  });

  const confidenceColor = (c: number) => c >= 0.85 ? "bg-emerald-500/20 text-emerald-400" : c >= 0.7 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="text-xs">{actions.length} pending</Badge>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Tipo azione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {Object.entries(ACTION_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Sorgente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le sorgenti</SelectItem>
            {Object.entries(SOURCE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ShieldCheck className="h-12 w-12 mb-3 text-primary/30" />
          <p className="text-sm font-medium">Nessuna azione in attesa</p>
          <p className="text-xs">L'AI sta lavorando autonomamente.</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-3 pr-2">
            {actions.map((action) => {
              const meta = ACTION_META[action.action_type] ?? ACTION_META.send_email;
              const Icon = meta.icon;
              const srcMeta = SOURCE_META[action.source ?? "ai_classifier"] ?? SOURCE_META.ai_classifier;
              const SrcIcon = srcMeta.icon;
              const expanded = expandedId === action.id;
              const partnerName = (action as any).partners?.company_name;

              return (
                <div key={action.id} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{meta.label}</span>
                          <Badge className={`text-[10px] px-1.5 ${confidenceColor(action.confidence ?? 0)}`}>
                            {Math.round((action.confidence ?? 0) * 100)}%
                          </Badge>
                          <Badge variant="outline" className="text-[10px] gap-1"><SrcIcon className="h-2.5 w-2.5" />{srcMeta.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {action.email_address}{partnerName ? ` · ${partnerName}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {action.created_at ? formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: it }) : ""}
                    </span>
                  </div>

                  {/* Reasoning preview */}
                  {action.reasoning && (
                    <button onClick={() => setExpandedId(expanded ? null : action.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left">
                      {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      <span className={expanded ? "" : "line-clamp-2"}>{action.reasoning}</span>
                    </button>
                  )}

                  {/* Suggested content */}
                  {action.suggested_content && (action.action_type === "reply" || action.action_type === "send_email") && (
                    <div className="border border-border/30 rounded-lg p-2 text-xs text-muted-foreground bg-muted/20 max-h-24 overflow-y-auto">
                      {action.suggested_content}
                    </div>
                  )}

                  {/* Prompt refinement suggestions */}
                  {action.action_type === "prompt_refinement" && action.suggested_content && (() => {
                    try {
                      const suggestions = JSON.parse(action.suggested_content);
                      return (
                        <div className="space-y-2 border border-border/30 rounded-lg p-3 bg-muted/10">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3" /> Suggerimenti miglioramento prompt:
                          </p>
                          {Array.isArray(suggestions) && suggestions.map((s: Record<string, string>, idx: number) => (
                            <div key={idx} className="text-xs space-y-1 border-l-2 border-primary/30 pl-2">
                              <p className="font-medium text-foreground">{s.section}</p>
                              {s.current_text && (
                                <p className="text-muted-foreground line-through">{s.current_text}</p>
                              )}
                              <p className="flex items-center gap-1 text-emerald-400">
                                <ArrowRight className="h-2.5 w-2.5" /> {s.suggested_text}
                              </p>
                              <p className="text-muted-foreground/70 italic">{s.reason}</p>
                            </div>
                          ))}
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {rejectId === action.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          placeholder="Motivo rifiuto (opzionale)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="h-7 text-xs flex-1"
                        />
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => rejectMutation.mutate({ id: action.id, reason: rejectReason })}>
                          Conferma
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRejectId(null); setRejectReason(""); }}>
                          Annulla
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10" onClick={() => approveMutation.mutate(action.id)}>
                          <CheckCircle className="h-3.5 w-3.5" />Approva
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => setRejectId(action.id)}>
                          <XCircle className="h-3.5 w-3.5" />Rifiuta
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
