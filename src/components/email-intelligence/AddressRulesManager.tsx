/**
 * AddressRulesManager — CRUD UI for email_address_rules
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Plus, Pencil, BookOpen, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

const AUTO_ACTIONS = [
  { value: "none", label: "Nessuna" },
  { value: "archive", label: "Archivia" },
  { value: "label", label: "Etichetta" },
  { value: "forward", label: "Inoltra" },
  { value: "reply", label: "Rispondi" },
  { value: "create_task", label: "Crea Task" },
];

const CHANNELS = ["email", "whatsapp", "linkedin", "phone"] as const;
const TONES = [
  { value: "", label: "Default" },
  { value: "formal", label: "Formale" },
  { value: "casual", label: "Casual" },
  { value: "technical", label: "Tecnico" },
  { value: "friendly", label: "Amichevole" },
];

interface EditableRule {
  id?: string;
  email_address: string;
  display_name?: string | null;
  category?: string | null;
  auto_action?: string | null;
  auto_action_params?: unknown;
  auto_execute?: boolean | null;
  ai_confidence_threshold?: number | null;
  preferred_channel?: string | null;
  tone_override?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
  [key: string]: unknown;
}

export function AddressRulesManager() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingRule, setEditingRule] = useState<EditableRule | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["email-address-rules", search],
    queryFn: async () => {
      let q = supabase.from("email_address_rules").select("*").order("email_address");
      if (search.trim()) q = q.ilike("email_address", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (rule: Record<string, unknown>) => {
      const { id, ...payload } = rule;
      if (id) {
        const { error } = await supabase.from("email_address_rules").update(payload as Record<string, unknown>).eq("id", String(id));
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("email_address_rules").insert({ ...payload, user_id: user!.id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Regola salvata");
      qc.invalidateQueries({ queryKey: queryKeys.email.addressRules });
      setSheetOpen(false);
      setEditingRule(null);
    },
    onError: () => toast.error("Errore nel salvataggio"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("email_address_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.email.addressRules }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_address_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Regola eliminata"); qc.invalidateQueries({ queryKey: queryKeys.email.addressRules }); },
    onError: () => toast.error("Errore nell'eliminazione"),
  });

  const openEdit = (rule?: EditableRule) => {
    setEditingRule(rule ?? {
      email_address: "",
      display_name: "",
      category: "prospect",
      auto_action: "none",
      auto_action_params: {},
      auto_execute: false,
      ai_confidence_threshold: 0.85,
      preferred_channel: "email",
      tone_override: null,
      topics_to_emphasize: [],
      topics_to_avoid: [],
      notes: "",
    });
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Cerca email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <Button size="sm" className="h-8 text-xs gap-1" onClick={() => openEdit()}>
          <Plus className="h-3.5 w-3.5" />Nuova Regola
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 mb-2 text-primary/30" />
          <p className="text-xs">Nessuna regola configurata</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-2 pr-2">
            {rules.map((rule) => (
              <div key={rule.id} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{rule.email_address}</p>
                  <p className="text-[10px] text-muted-foreground">{rule.display_name || "—"}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{rule.category ?? "—"}</Badge>
                {rule.auto_action && rule.auto_action !== "none" && (
                  <Badge className="text-[10px] bg-primary/10 text-primary">{rule.auto_action}</Badge>
                )}
                {rule.auto_execute && <Badge className="text-[10px] bg-amber-400/10 text-amber-400">Auto</Badge>}
                <span className="text-[10px] text-muted-foreground">{rule.interaction_count ?? 0} int.</span>
                <Switch
                  checked={rule.is_active ?? true}
                  onCheckedChange={(v) => toggleActive.mutate({ id: rule.id, is_active: v })}
                />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(rule)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { if (confirm("Eliminare questa regola?")) deleteMutation.mutate(rule.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-96 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm">{editingRule?.id ? "Modifica Regola" : "Nuova Regola"}</SheetTitle>
          </SheetHeader>
          {editingRule && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  value={editingRule.email_address}
                  onChange={(e) => setEditingRule({ ...editingRule, email_address: e.target.value })}
                  disabled={!!editingRule.id}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={editingRule.display_name ?? ""} onChange={(e) => setEditingRule({ ...editingRule, display_name: e.target.value })} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs">Auto-azione</Label>
                <Select value={editingRule.auto_action ?? "none"} onValueChange={(v) => setEditingRule({ ...editingRule, auto_action: v })}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{AUTO_ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editingRule.auto_execute ?? false} onCheckedChange={(v) => setEditingRule({ ...editingRule, auto_execute: v })} />
                <Label className="text-xs">Auto-esecuzione</Label>
              </div>
              <div>
                <Label className="text-xs">Soglia confidenza: {editingRule.ai_confidence_threshold ?? 0.85}</Label>
                <Slider
                  value={[editingRule.ai_confidence_threshold ?? 0.85]}
                  onValueChange={([v]) => setEditingRule({ ...editingRule, ai_confidence_threshold: v })}
                  min={0.5} max={1} step={0.05}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-xs">Canale preferito</Label>
                <Select value={editingRule.preferred_channel ?? "email"} onValueChange={(v) => setEditingRule({ ...editingRule, preferred_channel: v })}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tono</Label>
                <Select value={editingRule.tone_override ?? ""} onValueChange={(v) => setEditingRule({ ...editingRule, tone_override: v || null })}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{TONES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Note</Label>
                <Textarea value={editingRule.notes ?? ""} onChange={(e) => setEditingRule({ ...editingRule, notes: e.target.value })} className="text-xs mt-1" rows={3} />
              </div>
              <Button className="w-full h-8 text-xs" onClick={() => saveMutation.mutate(editingRule)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvataggio..." : "Salva Regola"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
