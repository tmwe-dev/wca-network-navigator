/**
 * RulesAndActionsTab — Address rules + Group rules + Prompt Manager
 * Tab 4 of Email Intelligence flow
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Plus, Pencil, Search, Trash2, BookOpen, Users2, FileText, Mail } from "lucide-react";
import { toast } from "sonner";
import type { EmailSenderGroup } from "@/types/email-management";

const AUTO_ACTIONS = [
  { value: "none", label: "Nessuna" },
  { value: "archive", label: "Archivia" },
  { value: "label", label: "Etichetta" },
  { value: "forward", label: "Inoltra" },
  { value: "spam", label: "Spam" },
  { value: "delete", label: "Elimina" },
];

const TONES = [
  { value: "", label: "Default" },
  { value: "formal", label: "Formale" },
  { value: "casual", label: "Casual" },
  { value: "technical", label: "Tecnico" },
  { value: "friendly", label: "Amichevole" },
];

export default function RulesAndActionsTab() {
  return (
    <Tabs defaultValue="address-rules" className="flex-1 flex flex-col">
      <TabsList className="bg-muted/30 w-fit">
        <TabsTrigger value="address-rules" className="text-xs gap-1"><Mail className="h-3 w-3" />Regole Address</TabsTrigger>
        <TabsTrigger value="group-rules" className="text-xs gap-1"><Users2 className="h-3 w-3" />Regole Gruppo</TabsTrigger>
        <TabsTrigger value="prompts" className="text-xs gap-1"><FileText className="h-3 w-3" />Prompt Manager</TabsTrigger>
      </TabsList>

      <TabsContent value="address-rules" className="flex-1 mt-3"><AddressRulesSection /></TabsContent>
      <TabsContent value="group-rules" className="flex-1 mt-3"><GroupRulesSection /></TabsContent>
      <TabsContent value="prompts" className="flex-1 mt-3"><PromptManagerSection /></TabsContent>
    </Tabs>
  );
}

/* ── Section A: Address Rules ── */
function AddressRulesSection() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: groups = [] } = useQuery({
    queryKey: ["email-sender-groups"],
    queryFn: async () => {
      const { data } = await supabase.from("email_sender_groups").select("*").order("sort_order");
      return (data || []) as EmailSenderGroup[];
    },
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["address-rules-tab4", search],
    queryFn: async () => {
      let q = supabase.from("email_address_rules").select("*").order("email_count", { ascending: false });
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
        const { error } = await supabase.from("email_address_rules").update(payload as any).eq("id", String(id));
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("email_address_rules").insert({ ...payload, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Regola salvata"); qc.invalidateQueries({ queryKey: ["address-rules-tab4"] }); setSheetOpen(false); },
    onError: () => toast.error("Errore salvataggio"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_address_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Eliminata"); qc.invalidateQueries({ queryKey: ["address-rules-tab4"] }); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from("email_address_rules").update({ is_active }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["address-rules-tab4"] }),
  });

  const openEdit = (rule?: Record<string, unknown>) => {
    setEditingRule(rule ?? {
      email_address: "", display_name: "", category: "prospect",
      auto_action: "none", auto_execute: false, ai_confidence_threshold: 0.85,
      preferred_channel: "email", tone_override: null, custom_prompt: "",
      notes: "", group_id: null,
    });
    setSheetOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Cerca email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <Button size="sm" className="h-8 text-xs gap-1" onClick={() => openEdit()}><Plus className="h-3.5 w-3.5" />Nuova Regola</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 mb-2 text-primary/30" />
          <p className="text-xs">Nessuna regola configurata</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-2 pr-2">
            {rules.map((rule) => (
              <div key={rule.id} className="bg-card/80 border border-border/50 rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{rule.email_address}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {rule.display_name && <span className="text-[10px] text-muted-foreground">{rule.display_name}</span>}
                    {(rule.email_count ?? 0) > 0 && <Badge variant="outline" className="text-[10px]">{rule.email_count} email</Badge>}
                  </div>
                </div>
                {rule.group_name && (
                  <Badge className="text-[10px]" style={{ backgroundColor: (rule.group_color || "#666") + "20", color: rule.group_color || "#666" }}>
                    {rule.group_icon} {rule.group_name}
                  </Badge>
                )}
                {rule.auto_action && rule.auto_action !== "none" && <Badge className="text-[10px] bg-primary/10 text-primary">{rule.auto_action}</Badge>}
                {rule.custom_prompt && <Badge variant="outline" className="text-[10px]">Prompt</Badge>}
                <Switch checked={rule.is_active ?? true} onCheckedChange={(v) => toggleActive.mutate({ id: rule.id, is_active: v })} />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(rule)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm("Eliminare?")) deleteMutation.mutate(rule.id); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-96 overflow-y-auto">
          <SheetHeader><SheetTitle className="text-sm">{editingRule?.id ? "Modifica Regola" : "Nuova Regola"}</SheetTitle></SheetHeader>
          {editingRule && (
            <div className="space-y-4 mt-4">
              <div><Label className="text-xs">Email</Label><Input value={editingRule.email_address} onChange={(e) => setEditingRule({ ...editingRule, email_address: e.target.value })} disabled={!!editingRule.id} className="h-8 text-xs mt-1" /></div>
              <div><Label className="text-xs">Nome</Label><Input value={editingRule.display_name ?? ""} onChange={(e) => setEditingRule({ ...editingRule, display_name: e.target.value })} className="h-8 text-xs mt-1" /></div>
              <div>
                <Label className="text-xs">Gruppo</Label>
                <Select value={editingRule.group_id ?? "none"} onValueChange={(v) => {
                  const g = groups.find((g) => g.id === v);
                  setEditingRule({ ...editingRule, group_id: v === "none" ? null : v, group_name: g?.nome_gruppo || null, group_color: g?.colore || null, group_icon: g?.icon || null });
                }}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessun gruppo</SelectItem>
                    {groups.map((g) => <SelectItem key={g.id} value={g.id}><span className="mr-1">{g.icon}</span>{g.nome_gruppo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Auto-azione</Label>
                <Select value={editingRule.auto_action ?? "none"} onValueChange={(v) => setEditingRule({ ...editingRule, auto_action: v })}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{AUTO_ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3"><Switch checked={editingRule.auto_execute ?? false} onCheckedChange={(v) => setEditingRule({ ...editingRule, auto_execute: v })} /><Label className="text-xs">Auto-esecuzione</Label></div>
              <div><Label className="text-xs">Soglia confidenza: {editingRule.ai_confidence_threshold ?? 0.85}</Label><Slider value={[editingRule.ai_confidence_threshold ?? 0.85]} onValueChange={([v]) => setEditingRule({ ...editingRule, ai_confidence_threshold: v })} min={0.5} max={1} step={0.05} className="mt-2" /></div>
              <div><Label className="text-xs">Tono</Label>
                <Select value={editingRule.tone_override ?? ""} onValueChange={(v) => setEditingRule({ ...editingRule, tone_override: v || null })}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Prompt Dedicato</Label><Textarea value={editingRule.custom_prompt ?? ""} onChange={(e) => setEditingRule({ ...editingRule, custom_prompt: e.target.value })} className="text-xs mt-1" rows={4} placeholder="Istruzioni specifiche per l'AI quando gestisce questo sender…" /></div>
              <div><Label className="text-xs">Note</Label><Textarea value={editingRule.notes ?? ""} onChange={(e) => setEditingRule({ ...editingRule, notes: e.target.value })} className="text-xs mt-1" rows={2} /></div>
              <Button className="w-full h-8 text-xs" onClick={() => saveMutation.mutate(editingRule)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvataggio…" : "Salva Regola"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── Section B: Group Rules ── */
function GroupRulesSection() {
  const qc = useQueryClient();
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["email-sender-groups-rules"],
    queryFn: async () => {
      const { data } = await supabase.from("email_sender_groups").select("*").order("sort_order");
      return (data || []) as (EmailSenderGroup & { auto_action?: string; is_default?: boolean })[];
    },
  });

  const { data: groupCounts = {} } = useQuery({
    queryKey: ["group-address-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("email_address_rules").select("group_name");
      const counts: Record<string, number> = {};
      (data || []).forEach((r) => { if (r.group_name) counts[r.group_name] = (counts[r.group_name] || 0) + 1; });
      return counts;
    },
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, auto_action }: { id: string; auto_action: string }) => {
      await supabase.from("email_sender_groups").update({ auto_action }).eq("id", id);
    },
    onSuccess: () => { toast.success("Aggiornato"); qc.invalidateQueries({ queryKey: ["email-sender-groups-rules"] }); },
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">Configura azioni automatiche per ogni gruppo di sender</p>
      {groups.map((g) => (
        <div key={g.id} className="bg-card/80 border border-border/50 rounded-xl p-3 flex items-center gap-3">
          <span className="text-lg">{g.icon || "📁"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: g.colore }}>{g.nome_gruppo}</p>
            {g.descrizione && <p className="text-[10px] text-muted-foreground">{g.descrizione}</p>}
          </div>
          <Badge variant="outline" className="text-[10px]">{groupCounts[g.nome_gruppo] || 0} address</Badge>
          <Select value={(g).auto_action || "none"} onValueChange={(v) => updateGroup.mutate({ id: g.id, auto_action: v })}>
            <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{AUTO_ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

/* ── Section C: Prompt Manager ── */
function PromptManagerSection() {
  const qc = useQueryClient();
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["email-prompts-tab4"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_prompts").select("*").order("priority", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (prompt: Record<string, unknown>) => {
      const { id, ...payload } = prompt;
      if (id) {
        await supabase.from("email_prompts").update(payload as any).eq("id", String(id));
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("email_prompts").insert({ ...payload, user_id: user!.id } as any);
      }
    },
    onSuccess: () => { toast.success("Prompt salvato"); qc.invalidateQueries({ queryKey: ["email-prompts-tab4"] }); setSheetOpen(false); },
    onError: () => toast.error("Errore"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from("email_prompts").update({ is_active }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-prompts-tab4"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("email_prompts").delete().eq("id", id);
    },
    onSuccess: () => { toast.success("Eliminato"); qc.invalidateQueries({ queryKey: ["email-prompts-tab4"] }); },
  });

  const openEdit = (prompt?: Record<string, unknown>) => {
    setEditingPrompt(prompt ?? { title: "", scope: "global", scope_value: null, instructions: "", priority: 5, is_active: true });
    setSheetOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Prompt AI ordinati per scope: globale → categoria → address</p>
        <Button size="sm" className="h-8 text-xs gap-1" onClick={() => openEdit()}><Plus className="h-3.5 w-3.5" />Nuovo Prompt</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : prompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="h-10 w-10 mb-2 text-primary/30" />
          <p className="text-xs">Nessun prompt configurato</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-2 pr-2">
            {prompts.map((p) => (
              <div key={p.id} className="bg-card/80 border border-border/50 rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{p.instructions?.substring(0, 80)}…</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{p.scope}</Badge>
                {p.scope_value && <Badge variant="outline" className="text-[10px]">{p.scope_value}</Badge>}
                <Badge variant="outline" className="text-[10px]">P{p.priority}</Badge>
                <Switch checked={p.is_active ?? true} onCheckedChange={(v) => toggleActive.mutate({ id: p.id, is_active: v })} />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm("Eliminare?")) deleteMutation.mutate(p.id); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-96 overflow-y-auto">
          <SheetHeader><SheetTitle className="text-sm">{editingPrompt?.id ? "Modifica Prompt" : "Nuovo Prompt"}</SheetTitle></SheetHeader>
          {editingPrompt && (
            <div className="space-y-4 mt-4">
              <div><Label className="text-xs">Titolo</Label><Input value={editingPrompt.title} onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })} className="h-8 text-xs mt-1" /></div>
              <div><Label className="text-xs">Scope</Label>
                <Select value={editingPrompt.scope} onValueChange={(v) => setEditingPrompt({ ...editingPrompt, scope: v, scope_value: null })}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Globale</SelectItem>
                    <SelectItem value="category">Categoria</SelectItem>
                    <SelectItem value="address">Address</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingPrompt.scope !== "global" && (
                <div><Label className="text-xs">Scope Value</Label><Input value={editingPrompt.scope_value ?? ""} onChange={(e) => setEditingPrompt({ ...editingPrompt, scope_value: e.target.value })} className="h-8 text-xs mt-1" placeholder={editingPrompt.scope === "category" ? "Nome categoria" : "email@example.com"} /></div>
              )}
              <div><Label className="text-xs">Istruzioni</Label><Textarea value={editingPrompt.instructions} onChange={(e) => setEditingPrompt({ ...editingPrompt, instructions: e.target.value })} className="text-xs mt-1" rows={8} /></div>
              <div><Label className="text-xs">Priorità: {editingPrompt.priority}</Label><Slider value={[editingPrompt.priority]} onValueChange={([v]) => setEditingPrompt({ ...editingPrompt, priority: v })} min={1} max={10} step={1} className="mt-2" /></div>
              <Button className="w-full h-8 text-xs" onClick={() => saveMutation.mutate(editingPrompt)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvataggio…" : "Salva Prompt"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
