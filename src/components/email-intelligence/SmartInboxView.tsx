/**
 * SmartInboxView — Split-view email classification browser
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThumbsUp, ThumbsDown, MessageCircle, CalendarCheck, AlertTriangle, RotateCcw, Bot, Ban, HelpCircle, Inbox, CheckCircle, Archive, ShieldBan } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { queryKeys } from "@/lib/queryKeys";

const CATEGORIES: Record<string, { icon: typeof ThumbsUp; color: string; label: string }> = {
  interested: { icon: ThumbsUp, color: "bg-emerald-400/10 text-emerald-400", label: "Interessato" },
  not_interested: { icon: ThumbsDown, color: "bg-red-400/10 text-red-400", label: "Non interessato" },
  request_info: { icon: HelpCircle, color: "bg-blue-400/10 text-blue-400", label: "Richiesta info" },
  meeting_request: { icon: CalendarCheck, color: "bg-purple-400/10 text-purple-400", label: "Meeting" },
  complaint: { icon: AlertTriangle, color: "bg-red-400/10 text-red-400", label: "Reclamo" },
  follow_up: { icon: RotateCcw, color: "bg-cyan-400/10 text-cyan-400", label: "Follow-up" },
  auto_reply: { icon: Bot, color: "bg-muted text-muted-foreground", label: "Auto-reply" },
  spam: { icon: Ban, color: "bg-muted text-muted-foreground", label: "Spam" },
  uncategorized: { icon: Inbox, color: "bg-muted text-muted-foreground", label: "Da classificare" },
};

const SENTIMENTS: Record<string, string> = {
  positive: "bg-emerald-400",
  negative: "bg-red-400",
  neutral: "bg-muted-foreground",
  mixed: "bg-yellow-400",
};

export function SmartInboxView() {
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: classifications = [], isLoading } = useQuery({
    queryKey: ["email-classifications", categoryFilter],
    queryFn: async () => {
      let q = supabase
        .from("email_classifications")
        .select("*, partners(company_name)")
        .order("classified_at", { ascending: false })
        .limit(100);
      if (categoryFilter !== "all") q = q.eq("category", categoryFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Category counts
  const { data: allCats = [] } = useQuery({
    queryKey: queryKeys.email.classificationsCatCounts,
    queryFn: async () => {
      const { data, error } = await supabase.from("email_classifications").select("category");
      if (error) throw error;
      return data ?? [];
    },
  });

  const catCounts = allCats.reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + 1;
    return acc;
  }, {});

  const selected = classifications.find(c => c.id === selectedId);

  const { data: convContext } = useQuery({
    queryKey: queryKeys.convContext.byEmail(selected?.email_address),
    enabled: !!selected?.email_address,
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_conversation_context")
        .select("*")
        .eq("email_address", selected!.email_address)
        .maybeSingle();
      return data;
    },
  });

  const handleApprove = async (id: string) => {
    const item = classifications.find(c => c.id === id);
    if (!item) return;
    const { error } = await supabase.from("ai_decision_log").insert({
      decision_type: "classify_email",
      email_address: item.email_address,
      user_review: "approved",
      confidence: item.confidence,
      user_id: (await supabase.auth.getUser()).data.user?.id ?? "",
    });
    if (!error) { toast.success("Classificazione approvata"); qc.invalidateQueries({ queryKey: queryKeys.email.classifications }); }
    else toast.error("Errore");
  };

  const handleCorrectCategory = async (id: string, newCategory: string) => {
    const item = classifications.find(c => c.id === id);
    const { error } = await supabase.from("email_classifications").update({ category: newCategory }).eq("id", id);
    if (!error) {
      toast.success(`Categoria corretta: ${CATEGORIES[newCategory]?.label ?? newCategory}`);
      qc.invalidateQueries({ queryKey: queryKeys.email.classifications });
      // Save correction to memory for learning
      if (item) {
        try {
          await invokeEdge("save-correction-memory", {
            body: {
              correction_type: "email_classification",
              original_value: item.category,
              corrected_value: newCategory,
              context: { email_address: item.email_address, subject: item.subject },
            },
            context: "SmartInboxView.correctCategory",
          });
        } catch { /* best-effort */ }
      }
    } else toast.error("Errore aggiornamento");
  };

  const handleFolderAction = async (action: "archive" | "spam", emailId: string) => {
    const item = classifications.find(c => c.id === emailId);
    if (!item) return;
    try {
      await invokeEdge("manage-email-folders", {
        body: { action, uids: [emailId] },
        context: `SmartInboxView.${action}`,
      });
      toast.success(action === "archive" ? "Archiviata" : "Spostata in spam");
      qc.invalidateQueries({ queryKey: queryKeys.email.classifications });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Errore operazione cartella");
    }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)]">
      {/* Sidebar: categories */}
      <div className="w-44 shrink-0 space-y-1">
        <button
          onClick={() => { setCategoryFilter("all"); setSelectedId(null); }}
          className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${categoryFilter === "all" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/30"}`}
        >
          Tutte <span className="float-right font-mono">{allCats.length}</span>
        </button>
        {Object.entries(CATEGORIES).map(([key, meta]) => {
          const CatIcon = meta.icon;
          const count = catCounts[key] ?? 0;
          if (count === 0 && key !== "uncategorized") return null;
          return (
            <button
              key={key}
              onClick={() => { setCategoryFilter(key); setSelectedId(null); }}
              className={`w-full text-left text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${categoryFilter === key ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/30"}`}
            >
              <CatIcon className="h-3 w-3 flex-shrink-0" />{meta.label} <span className="ml-auto font-mono">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Center: list */}
      <div className="w-2/5 flex flex-col space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center flex-1"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : classifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
            <Inbox className="h-10 w-10 mb-2 text-primary/30" />
            <p className="text-xs">Nessuna classificazione trovata</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-2">
              {classifications.map((c) => {
                const cat = CATEGORIES[c.category] ?? CATEGORIES.uncategorized;
                const CatIcon = cat.icon;
                const partnerName = (c as Record<string, any>).partners?.company_name;
                const isSelected = selectedId === c.id;

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left bg-card/80 backdrop-blur-sm border rounded-xl p-3 transition-colors ${isSelected ? "border-primary/50 bg-accent/30" : "border-border/50 hover:border-border"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-[10px] px-1.5 gap-1 ${cat.color}`}><CatIcon className="h-2.5 w-2.5" />{cat.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{Math.round((c.confidence ?? 0) * 100)}%</Badge>
                      {c.sentiment && <div className={`h-2 w-2 rounded-full ${SENTIMENTS[c.sentiment] ?? SENTIMENTS.neutral}`} />}
                      {(c.urgency === "critical" || c.urgency === "high") && (
                        <Badge variant="destructive" className="text-[10px]">{c.urgency}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-foreground truncate">{c.email_address}{partnerName ? ` · ${partnerName}` : ""}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.subject ?? "—"}</p>
                    <div className="flex items-center justify-between mt-1">
                      {c.action_suggested && <span className="text-[10px] text-primary truncate max-w-[60%]">{c.action_suggested}</span>}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {c.classified_at ? formatDistanceToNow(new Date(c.classified_at), { addSuffix: true, locale: it }) : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Right: detail */}
      <div className="flex-1 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 overflow-y-auto">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="h-10 w-10 mb-2 text-primary/20" />
            <p className="text-xs">Seleziona un'email per vedere i dettagli</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{selected.subject ?? "Senza oggetto"}</p>
              <p className="text-xs text-muted-foreground">{selected.email_address}</p>
            </div>

            {selected.ai_summary && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Riassunto AI</p>
                <p className="text-xs text-foreground">{selected.ai_summary}</p>
              </div>
            )}

            {selected.keywords && (selected.keywords as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(selected.keywords as string[]).map((k) => <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>)}
              </div>
            )}

            {selected.detected_patterns && (selected.detected_patterns as string[]).length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Pattern rilevati</p>
                <div className="flex flex-wrap gap-1">
                  {(selected.detected_patterns as string[]).map((p) => <Badge key={p} className="text-[10px] bg-primary/10 text-primary">{p}</Badge>)}
                </div>
              </div>
            )}

            {selected.reasoning && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Ragionamento AI</p>
                <p className="text-xs text-muted-foreground">{selected.reasoning}</p>
              </div>
            )}

            {convContext?.last_exchanges && Array.isArray(convContext.last_exchanges) && (convContext.last_exchanges as Array<Record<string, unknown>>).length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Cronologia conversazione</p>
                <div className="space-y-1.5">
                  {(convContext.last_exchanges as Array<Record<string, unknown>>).slice(-5).map((ex: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className={`h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0 ${SENTIMENTS[String(ex.sentiment)] ?? SENTIMENTS.neutral}`} />
                      <div>
                        <span className="text-muted-foreground">{ex.direction === "inbound" ? "← " : "→ "}</span>
                        <span className="text-foreground">{String(ex.summary ?? ex.subject ?? "—")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/30 flex-wrap">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-emerald-400" onClick={() => handleApprove(selected.id)}>
                <CheckCircle className="h-3.5 w-3.5" />Approva
              </Button>
              <Select onValueChange={(v) => handleCorrectCategory(selected.id, v)}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Correggi categoria" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleFolderAction("archive", selected.id)}>
                <Archive className="h-3.5 w-3.5" />Archivia
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={() => handleFolderAction("spam", selected.id)}>
                <ShieldBan className="h-3.5 w-3.5" />Spam
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
