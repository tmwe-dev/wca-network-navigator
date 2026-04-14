/**
 * AISuggestionsTab — AI-powered email address group suggestions
 * Tab 2 of Email Intelligence flow
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Check, X, Pencil, Loader2, ChevronDown, ChevronUp, Zap, Info } from "lucide-react";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { EmailSenderGroup } from "@/types/email-management";
import { queryKeys } from "@/lib/queryKeys";

interface Suggestion {
  id: string;
  email_address: string;
  display_name: string | null;
  email_count: number;
  ai_suggested_group: string | null;
  ai_suggestion_confidence: number;
  subjects?: string[];
  reasoning?: string;
}

export default function AISuggestionsTab() {
  const qc = useQueryClient();
  const [minEmailCount, setMinEmailCount] = useState(3);
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load groups
  const { data: groups = [] } = useQuery({
    queryKey: queryKeys.email.senderGroups,
    queryFn: async () => {
      const { data } = await supabase
        .from("email_sender_groups")
        .select("*")
        .order("sort_order", { ascending: true });
      return (data || []) as EmailSenderGroup[];
    },
  });

  // Load suggestions (uncategorized with ai_suggested_group)
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["ai-suggestions", minEmailCount, confidenceFilter],
    queryFn: async () => {
      const q = supabase
        .from("email_address_rules")
        .select("id, email_address, display_name, email_count, ai_suggested_group, ai_suggestion_confidence")
        .is("group_id", null)
        .not("ai_suggested_group", "is", null)
        .is("ai_suggestion_accepted", null)
        .gte("email_count", minEmailCount)
        .order("ai_suggestion_confidence", { ascending: false });

      const { data, error } = await q;
      if (error) throw error;

      let result = (data || []) as Suggestion[];
      if (confidenceFilter === "80") result = result.filter((s) => s.ai_suggestion_confidence >= 0.8);
      else if (confidenceFilter === "60") result = result.filter((s) => s.ai_suggestion_confidence >= 0.6);
      else if (confidenceFilter === "low") result = result.filter((s) => s.ai_suggestion_confidence < 0.6);
      return result;
    },
  });

  // Analyze with AI
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const data = await invokeEdge<{ processed: number; suggestions: Array<Record<string, unknown>> }>("suggest-email-groups", {
        body: { min_email_count: minEmailCount, batch_size: 20 },
        context: "ai-suggestions-tab",
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data?.processed || 0} address analizzati`);
      qc.invalidateQueries({ queryKey: queryKeys.ai.suggestions });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.aiSuggestionsCount });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Accept suggestion
  const acceptMutation = useMutation({
    mutationFn: async (suggestion: Suggestion) => {
      const group = groups.find((g) => g.nome_gruppo === suggestion.ai_suggested_group);
      if (!group) throw new Error("Gruppo non trovato");

      await supabase.from("email_address_rules")
        .update({
          group_id: group.id,
          group_name: group.nome_gruppo,
          group_color: group.colore,
          group_icon: group.icon,
          ai_suggestion_accepted: true,
        })
        .eq("id", suggestion.id);

      // Log decision
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("ai_decision_log").insert({
          user_id: user.id,
          decision_type: "email_group_assignment",
          input_context: { email_address: suggestion.email_address, email_count: suggestion.email_count },
          decision_output: { group_name: group.nome_gruppo, group_id: group.id },
          confidence: suggestion.ai_suggestion_confidence,
        });
      }
    },
    onSuccess: () => {
      toast.success("Suggerimento accettato");
      qc.invalidateQueries({ queryKey: queryKeys.ai.suggestions });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.uncategorizedCount });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.aiSuggestionsCount });
    },
  });

  // Change group
  const changeMutation = useMutation({
    mutationFn: async ({ ruleId, groupId }: { ruleId: string; groupId: string }) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      await supabase.from("email_address_rules")
        .update({
          group_id: group.id,
          group_name: group.nome_gruppo,
          group_color: group.colore,
          group_icon: group.icon,
          ai_suggestion_accepted: false,
        })
        .eq("id", ruleId);
    },
    onSuccess: () => {
      toast.success("Gruppo assegnato manualmente");
      qc.invalidateQueries({ queryKey: queryKeys.ai.suggestions });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.uncategorizedCount });
    },
  });

  // Ignore
  const ignoreMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await supabase.from("email_address_rules")
        .update({ ai_suggestion_accepted: false, ai_suggested_group: null })
        .eq("id", ruleId);
    },
    onSuccess: () => {
      toast.info("Suggerimento ignorato");
      qc.invalidateQueries({ queryKey: queryKeys.ai.suggestions });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.aiSuggestionsCount });
    },
  });

  // Accept all >80%
  const acceptAllHighConfidence = async () => {
    const highConf = suggestions.filter((s) => s.ai_suggestion_confidence >= 0.8);
    for (const s of highConf) {
      await acceptMutation.mutateAsync(s);
    }
    toast.success(`${highConf.length} suggerimenti accettati`);
  };

  const getGroupColor = (groupName: string | null): string => {
    if (!groupName) return "#666";
    const group = groups.find((g) => g.nome_gruppo === groupName);
    return group?.colore || "#666";
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending} className="gap-2">
          {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Analizza con AI
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Min. email:</span>
          <div className="w-32">
            <Slider value={[minEmailCount]} onValueChange={([v]) => setMinEmailCount(v)} min={1} max={20} step={1} />
          </div>
          <Badge variant="outline">{minEmailCount}</Badge>
        </div>

        <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="Confidence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="80">&gt;80%</SelectItem>
            <SelectItem value="60">&gt;60%</SelectItem>
            <SelectItem value="low">&lt;60%</SelectItem>
          </SelectContent>
        </Select>

        {suggestions.filter((s) => s.ai_suggestion_confidence >= 0.8).length > 0 && (
          <Button variant="outline" size="sm" onClick={acceptAllHighConfidence} className="gap-1 text-xs">
            <Zap className="h-3.5 w-3.5" />
            Accetta tutti &gt;80% ({suggestions.filter((s) => s.ai_suggestion_confidence >= 0.8).length})
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <Sparkles className="h-10 w-10 mb-2 text-primary/30" />
          <p className="text-sm">Nessun suggerimento AI disponibile</p>
          <p className="text-xs mt-1">Clicca &quot;Analizza con AI&quot; per generare suggerimenti</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-2">
            {suggestions.map((s) => {
              const isExpanded = expandedId === s.id;
              const confPercent = Math.round((s.ai_suggestion_confidence || 0) * 100);
              const confColor = confPercent >= 80 ? "text-emerald-400" : confPercent >= 60 ? "text-yellow-400" : "text-red-400";

              return (
                <div key={s.id} className="bg-card/80 border border-border/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{s.email_address}</p>
                      {s.display_name && <p className="text-[10px] text-muted-foreground">{s.display_name}</p>}
                    </div>
                    <Badge variant="outline" className="text-[10px]">{s.email_count} email</Badge>
                    {s.ai_suggested_group && (
                      <Badge className="text-[10px]" style={{ backgroundColor: getGroupColor(s.ai_suggested_group) + "20", color: getGroupColor(s.ai_suggested_group), borderColor: getGroupColor(s.ai_suggested_group) }}>
                        {s.ai_suggested_group}
                      </Badge>
                    )}
                    <span className={`text-xs font-mono font-bold ${confColor}`}>{confPercent}%</span>

                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>

                  {isExpanded && s.reasoning && (
                    <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg">
                      <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-muted-foreground">{s.reasoning}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-emerald-400"
                      onClick={() => acceptMutation.mutate(s)} disabled={acceptMutation.isPending}>
                      <Check className="h-3.5 w-3.5" />Accetta
                    </Button>
                    <Select onValueChange={(gId) => changeMutation.mutate({ ruleId: s.id, groupId: gId })}>
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <Pencil className="h-3 w-3 mr-1" /><SelectValue placeholder="Cambia" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            <span className="mr-1">{g.icon}</span>{g.nome_gruppo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive"
                      onClick={() => ignoreMutation.mutate(s.id)}>
                      <X className="h-3.5 w-3.5" />Ignora
                    </Button>
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
