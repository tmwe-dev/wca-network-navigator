import { useState, useMemo } from "react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { DEFAULT_EMAIL_TYPES, TONE_OPTIONS, type EmailType } from "@/data/defaultEmailTypes";
import { DEFAULT_GOALS, DEFAULT_PROPOSALS, type ContentItem, CONTENT_CATEGORIES } from "@/data/defaultContentPresets";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Trash2, Save, Loader2, Sparkles, Pencil,
  Handshake, RefreshCw, Search, Briefcase, Globe, FileText, Target, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { createLogger } from "@/lib/log";

const log = createLogger("PromptManager");

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  primo_contatto: Handshake,
  follow_up: RefreshCw,
  richiesta: Search,
  proposta_servizi: Briefcase,
  partnership: Globe,
  altro: FileText,
};

const CATEGORY_COLORS: Record<string, string> = {
  primo_contatto: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  follow_up: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  richiesta: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  proposta_servizi: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  partnership: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  altro: "bg-muted text-muted-foreground border-border",
};

interface UnifiedPrompt {
  id: string;
  name: string;
  icon: string;
  category: string;
  prompt: string;
  tone: string;
  source: "email_type" | "goal" | "proposal";
  isDefault?: boolean;
}

export function PromptManager() {
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [editItem, setEditItem] = useState<UnifiedPrompt | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editCategory, setEditCategory] = useState("altro");
  const [editTone, setEditTone] = useState("professionale");
  const [editSource, setEditSource] = useState<"email_type" | "goal" | "proposal">("email_type");
  const [isNew, setIsNew] = useState(false);
  const [improving, setImproving] = useState(false);

  // Parse stored items
  const customEmailTypes: EmailType[] = useMemo(() => {
    try { return JSON.parse(settings?.email_oracle_types || "[]"); } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return []; }
  }, [settings?.email_oracle_types]);

  const goals: ContentItem[] = useMemo(() => {
    try { return JSON.parse(settings?.workspace_goals || "null") || DEFAULT_GOALS; } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return DEFAULT_GOALS; }
  }, [settings?.workspace_goals]);

  const proposals: ContentItem[] = useMemo(() => {
    try { return JSON.parse(settings?.workspace_proposals || "null") || DEFAULT_PROPOSALS; } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return DEFAULT_PROPOSALS; }
  }, [settings?.workspace_proposals]);

  // Unify all into a single list
  const allPrompts: UnifiedPrompt[] = useMemo(() => {
    const result: UnifiedPrompt[] = [];
    // Email types (defaults + custom)
    DEFAULT_EMAIL_TYPES.forEach(t => result.push({
      id: t.id, name: t.name, icon: t.icon, category: t.category, prompt: t.prompt, tone: t.tone, source: "email_type", isDefault: true,
    }));
    customEmailTypes.forEach(t => result.push({
      id: t.id, name: t.name, icon: t.icon, category: t.category, prompt: t.prompt, tone: t.tone, source: "email_type",
    }));
    // Goals
    goals.forEach((g, i) => result.push({
      id: `goal_${i}`, name: g.name, icon: "🎯", category: g.category || "altro", prompt: g.text, tone: "professionale", source: "goal",
    }));
    // Proposals
    proposals.forEach((p, i) => result.push({
      id: `proposal_${i}`, name: p.name, icon: "💼", category: p.category || "altro", prompt: p.text, tone: "professionale", source: "proposal",
    }));
    return result;
  }, [customEmailTypes, goals, proposals]);

  // Counts
  const emailCount = DEFAULT_EMAIL_TYPES.length + customEmailTypes.length;
  const goalCount = goals.length;
  const proposalCount = proposals.length;

  const openEdit = (item: UnifiedPrompt) => {
    setEditItem(item);
    setEditName(item.name);
    setEditIcon(item.icon);
    setEditPrompt(item.prompt);
    setEditCategory(item.category);
    setEditTone(item.tone);
    setEditSource(item.source);
    setIsNew(false);
  };

  const openNew = () => {
    setEditItem(null);
    setEditName("");
    setEditIcon("📧");
    setEditPrompt("");
    setEditCategory("altro");
    setEditTone("professionale");
    setEditSource("email_type");
    setIsNew(true);
  };

  const handleSave = () => {
    if (!editName.trim() || !editPrompt.trim()) { toast.error("Nome e prompt sono obbligatori"); return; }

    if (editSource === "email_type") {
      const newType: EmailType = {
        id: isNew ? `custom_${Date.now()}` : (editItem?.id || `custom_${Date.now()}`),
        name: editName.trim(), icon: editIcon || "📧", category: editCategory, prompt: editPrompt.trim(), tone: editTone,
      };
      let updated: EmailType[];
      if (isNew) {
        updated = [...customEmailTypes, newType];
      } else {
        updated = customEmailTypes.map(t => t.id === editItem?.id ? newType : t);
        // If editing a default, add as custom override
        if (editItem?.isDefault) updated = [...customEmailTypes, newType];
      }
      updateSetting.mutate({ key: "email_oracle_types", value: JSON.stringify(updated) });
    } else if (editSource === "goal") {
      const item: ContentItem = { name: editName.trim(), text: editPrompt.trim(), category: editCategory };
      let updated: ContentItem[];
      if (isNew) { updated = [...goals, item]; }
      else {
        const idx = parseInt(editItem?.id.replace("goal_", "") || "0");
        updated = goals.map((g, i) => i === idx ? item : g);
      }
      updateSetting.mutate({ key: "workspace_goals", value: JSON.stringify(updated) });
    } else {
      const item: ContentItem = { name: editName.trim(), text: editPrompt.trim(), category: editCategory };
      let updated: ContentItem[];
      if (isNew) { updated = [...proposals, item]; }
      else {
        const idx = parseInt(editItem?.id.replace("proposal_", "") || "0");
        updated = proposals.map((p, i) => i === idx ? item : p);
      }
      updateSetting.mutate({ key: "workspace_proposals", value: JSON.stringify(updated) });
    }
    setEditItem(null);
    setIsNew(false);
    toast.success("Salvato");
  };

  const handleDelete = () => {
    if (!editItem) return;
    if (editItem.source === "email_type") {
      const updated = customEmailTypes.filter(t => t.id !== editItem.id);
      updateSetting.mutate({ key: "email_oracle_types", value: JSON.stringify(updated) });
    } else if (editItem.source === "goal") {
      const idx = parseInt(editItem.id.replace("goal_", "") || "0");
      const updated = goals.filter((_, i) => i !== idx);
      updateSetting.mutate({ key: "workspace_goals", value: JSON.stringify(updated) });
    } else {
      const idx = parseInt(editItem.id.replace("proposal_", "") || "0");
      const updated = proposals.filter((_, i) => i !== idx);
      updateSetting.mutate({ key: "workspace_proposals", value: JSON.stringify(updated) });
    }
    setEditItem(null);
    setIsNew(false);
    toast.success("Eliminato");
  };

  const handleImproveWithAI = async () => {
    if (!editPrompt.trim()) return;
    setImproving(true);
    try {
      const data = await invokeEdge<any>("improve-email", { body: { html: editPrompt, tone: editTone, improveType: "prompt" }, context: "PromptManager.improve_email" });
      if (data?.html) setEditPrompt(data.html);
      toast.success("Prompt migliorato con AI");
    } catch (e: any) {
      toast.error("Errore AI: " + (e.message || "sconosciuto"));
    } finally {
      setImproving(false);
    }
  };

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<string, UnifiedPrompt[]> = {};
    allPrompts.forEach(p => {
      const cat = p.category || "altro";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    const result: { key: string; label: string; items: UnifiedPrompt[] }[] = [];
    for (const c of CONTENT_CATEGORIES) {
      if (map[c.key]) result.push({ key: c.key, label: c.label, items: map[c.key] });
    }
    for (const k of Object.keys(map)) {
      if (!CONTENT_CATEGORIES.some(c => c.key === k)) result.push({ key: k, label: k, items: map[k] });
    }
    return result;
  }, [allPrompts]);

  const sourceLabel = (s: string) => s === "email_type" ? "Tipo Email" : s === "goal" ? "Goal" : "Proposta";
  const sourceColor = (s: string) => s === "email_type" ? "bg-primary/10 text-primary" : s === "goal" ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600";

  return (
    <div className="space-y-4">
      {/* Summary toast bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">{emailCount} tipi email</Badge>
          <Badge variant="outline" className="text-[10px]">{goalCount} goal</Badge>
          <Badge variant="outline" className="text-[10px]">{proposalCount} proposte</Badge>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={openNew}>
          <Plus className="w-3.5 h-3.5" /> Crea nuovo
        </Button>
      </div>

      {/* Grouped grid */}
      {grouped.map(group => {
        const Icon = CATEGORY_ICONS[group.key] || FileText;
        return (
          <div key={group.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">{group.label}</h3>
              <Badge variant="secondary" className="text-[10px]">{group.items.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {group.items.map(item => (
                <Card
                  key={item.id + item.source}
                  className="p-3 cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => openEdit(item)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-medium truncate">{item.name}</span>
                        {item.isDefault && <Badge variant="outline" className="text-[8px] px-1 py-0">default</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{item.prompt}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <Badge className={`text-[8px] px-1.5 py-0 border ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.altro}`}>
                          {CONTENT_CATEGORIES.find(c => c.key === item.category)?.label || item.category}
                        </Badge>
                        <Badge className={`text-[8px] px-1.5 py-0 ${sourceColor(item.source)}`}>
                          {sourceLabel(item.source)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Edit/Create Dialog */}
      <Dialog open={!!editItem || isNew} onOpenChange={(open) => { if (!open) { setEditItem(null); setIsNew(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">{isNew ? "Crea nuovo prompt" : "Modifica prompt"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={editIcon} onChange={e => setEditIcon(e.target.value)} className="w-12 h-9 text-center text-lg px-1" maxLength={2} />
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome" className="flex-1 h-9 text-sm" />
            </div>
            <div className="flex gap-2">
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger className="h-9 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_CATEGORIES.map(c => (
                    <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={editSource} onValueChange={(v: any) => setEditSource(v)}>
                <SelectTrigger className="h-9 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_type" className="text-xs">Tipo Email</SelectItem>
                  <SelectItem value="goal" className="text-xs">Goal</SelectItem>
                  <SelectItem value="proposal" className="text-xs">Proposta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={editTone} onValueChange={setEditTone}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">{t.icon} {t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <Textarea
                value={editPrompt}
                onChange={e => setEditPrompt(e.target.value)}
                placeholder="Prompt / obiettivo / testo..."
                className="text-xs min-h-[120px]"
              />
              <div className="flex justify-end mt-1">
                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={handleImproveWithAI} disabled={improving || !editPrompt.trim()}>
                  {improving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Migliora con AI
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {!isNew && editItem && !editItem.isDefault && (
              <Button size="sm" variant="destructive" className="h-8 text-xs gap-1" onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5" /> Elimina
              </Button>
            )}
            <div className="flex-1" />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditItem(null); setIsNew(false); }}>
              Annulla
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={handleSave}>
              <Save className="w-3.5 h-3.5" /> Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
