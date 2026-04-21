/**
 * PromptsTab — editor inline dei prompt operativi (operative_prompts) rilevanti per Email Forge.
 * Permette di modificare obiettivo/procedura/criteri di ogni prompt e di toggle attivo/inattivo.
 * Dopo ogni save mostra il banner Re-genera per feedback immediato.
 */
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Scroll } from "lucide-react";
import { toast } from "sonner";
import { RegenerateBanner } from "../RegenerateBanner";

interface PromptRow {
  id: string;
  name: string;
  objective: string | null;
  procedure: string | null;
  criteria: string | null;
  tags: string[] | null;
  is_active: boolean;
  priority: number;
}

const EMAIL_TAG_RE = /email|mail|outreach|sales|negoz|vend/i;

export function PromptsTab() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();
  const [savedAt, setSavedAt] = React.useState(0);

  const promptsQuery = useQuery({
    queryKey: ["forge-operative-prompts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operative_prompts")
        .select("id, name, objective, procedure, criteria, tags, is_active, priority")
        .eq("user_id", userId!)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data as PromptRow[]) ?? [];
    },
  });

  const all = promptsQuery.data ?? [];
  // Filtra prompt rilevanti per email (per nome o tag); se nessuno, mostra tutti
  const emailRelated = all.filter((p) =>
    EMAIL_TAG_RE.test(p.name) || (p.tags ?? []).some((t) => EMAIL_TAG_RE.test(t))
  );
  const list = emailRelated.length > 0 ? emailRelated : all;

  if (!userId) return <div className="text-[11px] text-muted-foreground py-4 text-center">Non autenticato</div>;

  return (
    <div className="space-y-2 text-xs">
      <div className="text-xs text-foreground/70">
        Prompt operativi (L2) caricati dall'assembler per gli agenti email. {list.length} voci.
      </div>

      {promptsQuery.isLoading && (
        <div className="flex items-center justify-center py-4 text-[11px] text-muted-foreground gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Caricamento…
        </div>
      )}

      {!promptsQuery.isLoading && list.length === 0 && (
        <div className="text-center py-6 text-[11px] text-muted-foreground">
          <Scroll className="w-6 h-6 mx-auto mb-2 opacity-40" />
          Nessun prompt operativo configurato.
        </div>
      )}

      <div className="space-y-1.5">
        {list.map((p) => (
          <PromptRowEditor
            key={p.id}
            prompt={p}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["forge-operative-prompts", userId] });
              setSavedAt(Date.now());
            }}
          />
        ))}
      </div>

      <RegenerateBanner visible={savedAt > 0} message="Prompt aggiornato" onDismiss={() => setSavedAt(0)} />
    </div>
  );
}

function PromptRowEditor({ prompt, onSaved }: { prompt: PromptRow; onSaved: () => void }) {
  const [objective, setObjective] = React.useState(prompt.objective ?? "");
  const [procedure, setProcedure] = React.useState(prompt.procedure ?? "");
  const [criteria, setCriteria] = React.useState(prompt.criteria ?? "");
  const [priority, setPriority] = React.useState(prompt.priority);
  const [active, setActive] = React.useState(prompt.is_active);
  const [saving, setSaving] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const dirty =
    objective !== (prompt.objective ?? "") ||
    procedure !== (prompt.procedure ?? "") ||
    criteria !== (prompt.criteria ?? "") ||
    priority !== prompt.priority;

  const handleToggle = async (v: boolean) => {
    setActive(v);
    const { error } = await supabase.from("operative_prompts").update({ is_active: v }).eq("id", prompt.id);
    if (error) {
      setActive(!v);
      toast.error("Toggle fallito", { description: error.message });
      return;
    }
    onSaved();
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("operative_prompts")
      .update({ objective, procedure, criteria, priority })
      .eq("id", prompt.id);
    setSaving(false);
    if (error) {
      toast.error("Salvataggio fallito", { description: error.message });
      return;
    }
    toast.success("Prompt aggiornato");
    onSaved();
  };

  const totalChars = objective.length + procedure.length + criteria.length;

  return (
    <div className="rounded border border-border/60 bg-card p-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-xs truncate">{prompt.name}</span>
            <Badge variant="outline" className="text-[9px]">P{priority}</Badge>
            <span className="text-xs text-foreground/70">{totalChars} char</span>
            {(prompt.tags ?? []).slice(0, 3).map((t) => (
              <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>
            ))}
          </div>
          {!open && objective && (
            <div className="text-xs text-foreground/70 line-clamp-2 mt-0.5">{objective}</div>
          )}
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <Switch checked={active} onCheckedChange={handleToggle} />
        </div>
      </div>

      {open && (
        <div className="mt-2 space-y-1.5">
          <Field label="Obiettivo" value={objective} onChange={setObjective} rows={3} />
          <Field label="Procedura" value={procedure} onChange={setProcedure} rows={5} />
          <Field label="Criteri" value={criteria} onChange={setCriteria} rows={3} />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/70">Priorità</span>
              <Input
                type="number"
                min={0}
                max={10}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) || 0)}
                className="h-6 w-16 text-[10px]"
              />
            </div>
            {dirty && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-6 text-[10px]">
                {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                Salva
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-muted-foreground">{value.length}</span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="text-[11px] font-mono resize-none"
      />
    </div>
  );
}
