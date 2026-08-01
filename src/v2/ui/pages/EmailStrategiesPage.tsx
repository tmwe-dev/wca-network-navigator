/**
 * EmailStrategiesPage — "Strategie Email" (Fase C).
 *
 * Unico posto governabile per le due strategie email post-circuito di attesa:
 *  1. "Il cliente HA scritto" → libreria template autoresponder / onboarding
 *     (tabella funnemail_autoresponder_templates).
 *  2. "Il cliente NON riscrive" → regole di risveglio dopo X giorni di silenzio
 *     (tabella wake_up_rules).
 *
 * La pagina fornisce SOLO contenitori e connessioni: non inventa testi
 * commerciali. L'operatore scrive/abilita; il motore di outreach esegue.
 */
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Bell, Plus, Trash2, Save, MailCheck } from "lucide-react";
import {
  listAutoresponderTemplates,
  updateAutoresponderTemplate,
  insertAutoresponderTemplate,
  deleteAutoresponderTemplate,
  listWakeUpRules,
  updateWakeUpRule,
  insertWakeUpRule,
  softDeleteWakeUpRule,
} from "@/v2/io/supabase/queries/email-strategies";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { queryKeys } from "@/lib/queryKeys";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ────────────────────────────────────────────────────────────
interface AutoTemplate {
  id: string;
  name: string;
  language: string;
  subject_template: string;
  body_template: string;
  enabled: boolean;
  notes: string | null;
}

interface WakeRule {
  id: string;
  name: string;
  group_name: string | null;
  min_score: number;
  days_dormant: number;
  channel: string;
  max_per_day: number;
  is_active: boolean;
  notes: string | null;
}

// ── Page ─────────────────────────────────────────────────────────────
export function EmailStrategiesPage(): React.ReactElement {
  return (
    <>
      <PageTitleHeader icon={Mail} title="Strategie Email" subtitle="Onboarding e risveglio dopo il circuito di attesa" />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-4 bg-muted/30">
          <p className="text-sm text-foreground font-medium mb-1">A cosa serve</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li><span className="text-foreground">Cliente HA scritto:</span> i template di risposta/onboarding inviati quando il cliente risponde.</li>
            <li><span className="text-foreground">Cliente NON riscrive:</span> le regole di risveglio che ricontattano i contatti silenti dopo X giorni.</li>
            <li>Qui si <span className="text-foreground">scrivono e si abilitano</span>; il motore di outreach le esegue automaticamente.</li>
          </ul>
        </Card>

        <Tabs defaultValue="autoresponders">
          <TabsList>
            <TabsTrigger value="autoresponders" className="gap-1.5"><MailCheck className="w-3.5 h-3.5" />Cliente HA scritto</TabsTrigger>
            <TabsTrigger value="wakeup" className="gap-1.5"><Bell className="w-3.5 h-3.5" />Cliente NON riscrive</TabsTrigger>
          </TabsList>
          <TabsContent value="autoresponders" className="mt-4">
            <AutorespondersSection />
          </TabsContent>
          <TabsContent value="wakeup" className="mt-4">
            <WakeUpSection />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

// ── Autoresponder templates ──────────────────────────────────────────
function AutorespondersSection(): React.ReactElement {
  const qc = useQueryClient();
  const { isAdmin } = useAuthV2();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.emailStrategies.autoresponders,
    queryFn: async (): Promise<AutoTemplate[]> =>
      (await listAutoresponderTemplates()) as AutoTemplate[],
  });

  const save = useMutation({
    mutationFn: async (t: Partial<AutoTemplate> & { id?: string }) => {
      if (t.id) {
        await updateAutoresponderTemplate(t.id, {
          name: t.name,
          language: t.language,
          subject_template: t.subject_template,
          body_template: t.body_template,
          enabled: t.enabled,
          notes: t.notes ?? null,
        });
      } else {
        await insertAutoresponderTemplate({
          name: t.name ?? "Nuovo template",
          language: t.language ?? "it",
          subject_template: t.subject_template ?? "",
          body_template: t.body_template ?? "",
          enabled: t.enabled ?? false,
          notes: t.notes ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Template salvato");
      qc.invalidateQueries({ queryKey: queryKeys.emailStrategies.autoresponders });
    },
    onError: (e: unknown) => toast.error(`Errore: ${(e as Error).message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteAutoresponderTemplate(id);
    },
    onSuccess: () => {
      toast.success("Template eliminato");
      qc.invalidateQueries({ queryKey: queryKeys.emailStrategies.autoresponders });
    },
    onError: (e: unknown) => toast.error(`Errore: ${(e as Error).message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isAdmin ? "Crea, modifica o disattiva i template di risposta." : "Sola lettura — serve il ruolo amministratore per modificare."}
        </p>
        {isAdmin && (
          <Button size="sm" className="gap-1.5" onClick={() => save.mutate({})} disabled={save.isPending}>
            <Plus className="w-3.5 h-3.5" />Nuovo template
          </Button>
        )}
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Caricamento…</p>
      ) : (data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessun template definito.</p>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((t) => (
            <AutoTemplateCard key={t.id} template={t} readOnly={!isAdmin} onSave={save.mutate} onDelete={remove.mutate} saving={save.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function AutoTemplateCard({
  template,
  readOnly,
  onSave,
  onDelete,
  saving,
}: {
  template: AutoTemplate;
  readOnly: boolean;
  onSave: (t: AutoTemplate) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}): React.ReactElement {
  const [draft, setDraft] = React.useState<AutoTemplate>(template);
  React.useEffect(() => setDraft(template), [template]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(template);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={draft.name}
          disabled={readOnly}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="font-medium h-8 max-w-xs"
        />
        <Badge variant="outline" className="text-[10px] uppercase">{draft.language}</Badge>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Switch checked={draft.enabled} disabled={readOnly} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
          <span className="text-[11px] text-muted-foreground">{draft.enabled ? "Attivo" : "Disattivo"}</span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Lingua</Label>
          <Select value={draft.language} disabled={readOnly} onValueChange={(v) => setDraft({ ...draft, language: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="it">Italiano</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Oggetto</Label>
          <Input value={draft.subject_template} disabled={readOnly} onChange={(e) => setDraft({ ...draft, subject_template: e.target.value })} className="h-8" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Corpo del messaggio</Label>
        <Textarea value={draft.body_template} disabled={readOnly} rows={5} onChange={(e) => setDraft({ ...draft, body_template: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Note interne</Label>
        <Input value={draft.notes ?? ""} disabled={readOnly} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="h-8" />
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
          <Button size="sm" className="gap-1.5" disabled={!dirty || saving} onClick={() => onSave(draft)}>
            <Save className="w-3.5 h-3.5" />Salva
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => onDelete(template.id)}>
            <Trash2 className="w-3.5 h-3.5" />Elimina
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── Wake-up rules ────────────────────────────────────────────────────
function WakeUpSection(): React.ReactElement {
  const qc = useQueryClient();
  const { user } = useAuthV2();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.emailStrategies.wakeUpRules,
    queryFn: async (): Promise<WakeRule[]> => (await listWakeUpRules()) as WakeRule[],
  });

  const save = useMutation({
    mutationFn: async (r: Partial<WakeRule> & { id?: string }) => {
      if (r.id) {
        await updateWakeUpRule(r.id, {
          name: r.name,
          group_name: r.group_name ?? null,
          min_score: r.min_score,
          days_dormant: r.days_dormant,
          channel: r.channel,
          max_per_day: r.max_per_day,
          is_active: r.is_active,
          notes: r.notes ?? null,
        });
      } else {
        if (!user?.id) throw new Error("Utente non autenticato");
        await insertWakeUpRule({
          user_id: user.id,
          name: r.name ?? "Nuova regola",
          group_name: r.group_name ?? null,
          min_score: r.min_score ?? 0,
          days_dormant: r.days_dormant ?? 14,
          channel: r.channel ?? "email",
          max_per_day: r.max_per_day ?? 20,
          is_active: r.is_active ?? false,
          notes: r.notes ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Regola salvata");
      qc.invalidateQueries({ queryKey: queryKeys.emailStrategies.wakeUpRules });
    },
    onError: (e: unknown) => toast.error(`Errore: ${(e as Error).message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await softDeleteWakeUpRule(id);
    },
    onSuccess: () => {
      toast.success("Regola eliminata");
      qc.invalidateQueries({ queryKey: queryKeys.emailStrategies.wakeUpRules });
    },
    onError: (e: unknown) => toast.error(`Errore: ${(e as Error).message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Regole che ricontattano i contatti silenti dopo X giorni.</p>
        <Button size="sm" className="gap-1.5" onClick={() => save.mutate({})} disabled={save.isPending}>
          <Plus className="w-3.5 h-3.5" />Nuova regola
        </Button>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Caricamento…</p>
      ) : (data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessuna regola di risveglio definita.</p>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((r) => (
            <WakeRuleCard key={r.id} rule={r} onSave={save.mutate} onDelete={remove.mutate} saving={save.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function WakeRuleCard({
  rule,
  onSave,
  onDelete,
  saving,
}: {
  rule: WakeRule;
  onSave: (r: WakeRule) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}): React.ReactElement {
  const [draft, setDraft] = React.useState<WakeRule>(rule);
  React.useEffect(() => setDraft(rule), [rule]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(rule);
  const num = (v: string, fb: number) => (v === "" ? fb : Math.max(0, Number(v) || 0));

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="font-medium h-8 max-w-xs" />
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
          <span className="text-[11px] text-muted-foreground">{draft.is_active ? "Attiva" : "Disattiva"}</span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[11px]">Giorni di silenzio</Label>
          <Input type="number" value={draft.days_dormant} onChange={(e) => setDraft({ ...draft, days_dormant: num(e.target.value, 14) })} className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Score minimo</Label>
          <Input type="number" value={draft.min_score} onChange={(e) => setDraft({ ...draft, min_score: num(e.target.value, 0) })} className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Max al giorno</Label>
          <Input type="number" value={draft.max_per_day} onChange={(e) => setDraft({ ...draft, max_per_day: num(e.target.value, 20) })} className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Canale</Label>
          <Select value={draft.channel} onValueChange={(v) => setDraft({ ...draft, channel: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Gruppo / segmento</Label>
          <Input value={draft.group_name ?? ""} onChange={(e) => setDraft({ ...draft, group_name: e.target.value })} className="h-8" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Note interne</Label>
        <Input value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="h-8" />
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <Button size="sm" className="gap-1.5" disabled={!dirty || saving} onClick={() => onSave(draft)}>
          <Save className="w-3.5 h-3.5" />Salva
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => onDelete(rule.id)}>
          <Trash2 className="w-3.5 h-3.5" />Elimina
        </Button>
      </div>
    </Card>
  );
}