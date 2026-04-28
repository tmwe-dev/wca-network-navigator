/**
 * AgentRoutingTab — DB-driven persona-aware routing rules editor.
 *
 * Each row controls how an agent persona biases the AI classifier and
 * overrides post-classification escalation (next lead_status, action type,
 * confidence floor, skip-action). Persona-specific rules win over globals.
 * No agent_id = global rule.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { queryKeys } from "@/lib/queryKeys";
import {
  listAgentRoutingRules,
  createAgentRoutingRule,
  updateAgentRoutingRule,
  deleteAgentRoutingRule,
  type AgentRoutingRule,
} from "@/data/agentRoutingRules";
import { listAgentsForCapabilities, type AgentMini } from "@/data/agentsForPromptLab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Save, ShieldAlert, Sparkles, Globe2 } from "lucide-react";
import { toast } from "sonner";

const DOMAINS = ["", "commercial", "operative", "administrative", "support", "internal"] as const;
const CATEGORIES = [
  "", "interested", "not_interested", "request_info", "question", "meeting_request",
  "complaint", "follow_up", "auto_reply", "unsubscribe", "bounce", "spam", "uncategorized",
  "quote_request", "booking_request", "shipment_tracking", "documentation_request",
  "rate_inquiry", "cargo_status", "invoice_query", "payment_request", "payment_confirmation",
  "credit_note", "account_statement", "service_inquiry", "technical_issue", "feedback",
  "newsletter", "system_notification", "internal_communication",
] as const;
const SENTIMENTS = ["", "positive", "negative", "neutral", "mixed"] as const;
const LEAD_STATUSES = ["", "new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"] as const;
const PRIORITIES = ["", "low", "normal", "high", "critical"] as const;

type Draft = Partial<AgentRoutingRule> & { _new?: boolean; _dirty?: boolean };

function emptyDraft(userId: string): Draft {
  return {
    _new: true,
    _dirty: true,
    user_id: userId,
    agent_id: null,
    name: "Nuova regola",
    description: "",
    enabled: true,
    priority: 100,
    match_domain: null,
    match_category: null,
    match_sentiment: null,
    match_lead_status: null,
    match_min_confidence: 0,
    match_keywords: [],
    bias_domain_hint: null,
    bias_category_hint: null,
    bias_tone_hint: null,
    bias_extra_instructions: null,
    override_next_status: null,
    override_action_type: null,
    override_priority: null,
    override_confidence_floor: null,
    override_skip_action: false,
  };
}

function nullableSelect(v: string | null | undefined): string {
  return v ?? "__none__";
}
function fromSelect(v: string): string | null {
  return v === "__none__" || v === "" ? null : v;
}

function RuleEditor({
  rule,
  agents,
  onChange,
  onSave,
  onDelete,
  saving,
}: {
  rule: Draft;
  agents: AgentMini[];
  onChange: (patch: Partial<AgentRoutingRule>) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const isGlobal = !rule.agent_id;
  return (
    <Card className={rule._dirty ? "border-primary/40" : ""}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <Input
              value={rule.name ?? ""}
              onChange={(e) => onChange({ name: e.target.value })}
              className="font-medium"
              placeholder="Nome regola"
            />
            {isGlobal ? (
              <Badge variant="outline" className="gap-1"><Globe2 className="h-3 w-3" /> globale</Badge>
            ) : (
              <Badge variant="default" className="gap-1"><Sparkles className="h-3 w-3" /> persona</Badge>
            )}
            {rule.match_count !== undefined && rule.match_count > 0 && (
              <Badge variant="secondary" className="text-[10px]">{rule.match_count} match</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={!!rule.enabled}
                onCheckedChange={(v) => onChange({ enabled: v })}
              />
              <span className="text-xs text-muted-foreground">attiva</span>
            </div>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={onSave} disabled={!rule._dirty || saving}>
              <Save className="h-4 w-4 mr-1" /> Salva
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={2}
          value={rule.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Descrizione (a cosa serve questa regola)"
        />

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Persona (vuoto = globale)</Label>
            <Select
              value={nullableSelect(rule.agent_id)}
              onValueChange={(v) => onChange({ agent_id: fromSelect(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— globale —</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.avatar_emoji ?? "🤖"} {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Priorità (basso = applicata prima)</Label>
            <Input
              type="number"
              value={rule.priority ?? 100}
              onChange={(e) => onChange({ priority: Number(e.target.value) || 100 })}
            />
          </div>
          <div>
            <Label className="text-xs">Confidence minima</Label>
            <Input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={rule.match_min_confidence ?? 0}
              onChange={(e) => onChange({ match_min_confidence: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        <section>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Match (quando applicare)</h4>
          <div className="grid md:grid-cols-4 gap-3">
            <SelectField label="Dominio" value={rule.match_domain} options={DOMAINS as readonly string[]} onChange={(v) => onChange({ match_domain: v })} />
            <SelectField label="Categoria" value={rule.match_category} options={CATEGORIES as readonly string[]} onChange={(v) => onChange({ match_category: v })} />
            <SelectField label="Sentiment" value={rule.match_sentiment} options={SENTIMENTS as readonly string[]} onChange={(v) => onChange({ match_sentiment: v })} />
            <SelectField label="Lead status" value={rule.match_lead_status} options={LEAD_STATUSES as readonly string[]} onChange={(v) => onChange({ match_lead_status: v })} />
          </div>
          <div className="mt-3">
            <Label className="text-xs">Keywords (any-match, separate da virgola)</Label>
            <Input
              value={(rule.match_keywords ?? []).join(", ")}
              onChange={(e) =>
                onChange({
                  match_keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="es. urgente, preventivo, booking"
            />
          </div>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Bias pre-classificazione (suggerimenti AI)</h4>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Hint dominio</Label>
              <Input value={rule.bias_domain_hint ?? ""} onChange={(e) => onChange({ bias_domain_hint: e.target.value || null })} placeholder="es. operative" />
            </div>
            <div>
              <Label className="text-xs">Hint categoria</Label>
              <Input value={rule.bias_category_hint ?? ""} onChange={(e) => onChange({ bias_category_hint: e.target.value || null })} placeholder="es. quote_request" />
            </div>
            <div>
              <Label className="text-xs">Hint tono</Label>
              <Input value={rule.bias_tone_hint ?? ""} onChange={(e) => onChange({ bias_tone_hint: e.target.value || null })} placeholder="es. urgente, formale" />
            </div>
          </div>
          <div className="mt-3">
            <Label className="text-xs">Istruzioni extra per il classificatore</Label>
            <Textarea
              rows={2}
              value={rule.bias_extra_instructions ?? ""}
              onChange={(e) => onChange({ bias_extra_instructions: e.target.value || null })}
              placeholder="es. Per email da freight forwarder, considera richieste tariffe come operative anche se la categoria sembra commerciale."
            />
          </div>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Override post-classificazione</h4>
          <div className="grid md:grid-cols-4 gap-3">
            <SelectField label="Forza next lead_status" value={rule.override_next_status} options={LEAD_STATUSES as readonly string[]} onChange={(v) => onChange({ override_next_status: v })} />
            <div>
              <Label className="text-xs">Forza action_type</Label>
              <Input value={rule.override_action_type ?? ""} onChange={(e) => onChange({ override_action_type: e.target.value || null })} placeholder="es. schedule_meeting" />
            </div>
            <SelectField label="Forza priorità" value={rule.override_priority} options={PRIORITIES as readonly string[]} onChange={(v) => onChange({ override_priority: v })} />
            <div>
              <Label className="text-xs">Confidence floor</Label>
              <Input
                type="number" step="0.05" min={0} max={1}
                value={rule.override_confidence_floor ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({ override_confidence_floor: v === "" ? null : Number(v) });
                }}
                placeholder="opzionale"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <Switch
              checked={!!rule.override_skip_action}
              onCheckedChange={(v) => onChange({ override_skip_action: v })}
            />
            <Label className="text-xs">Salta azione automatica (no escalation, no pending action)</Label>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function SelectField({
  label, value, options, onChange,
}: {
  label: string;
  value: string | null | undefined;
  options: readonly string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={nullableSelect(value)} onValueChange={(v) => onChange(fromSelect(v))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— qualsiasi —</SelectItem>
          {options.filter((o) => o).map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AgentRoutingTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const { data: rulesData, isLoading } = useQuery({
    queryKey: queryKeys.agents.routingRules(),
    queryFn: listAgentRoutingRules,
  });
  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.allForCapabilities(),
    queryFn: listAgentsForCapabilities,
  });

  const merged = useMemo<Draft[]>(() => {
    const list: Draft[] = (rulesData ?? []).map((r) => drafts[r.id] ?? r);
    // Append unsaved new drafts
    Object.values(drafts).forEach((d) => {
      if (d._new && !list.find((r) => r.id === d.id)) list.unshift(d);
    });
    return list;
  }, [rulesData, drafts]);

  const saveMut = useMutation({
    mutationFn: async (draft: Draft) => {
      if (draft._new) {
        const created = await createAgentRoutingRule({
          user_id: draft.user_id!,
          agent_id: draft.agent_id ?? null,
          name: draft.name ?? "Senza nome",
          description: draft.description ?? null,
          enabled: !!draft.enabled,
          priority: draft.priority ?? 100,
          match_domain: draft.match_domain ?? null,
          match_category: draft.match_category ?? null,
          match_sentiment: draft.match_sentiment ?? null,
          match_lead_status: draft.match_lead_status ?? null,
          match_min_confidence: draft.match_min_confidence ?? 0,
          match_keywords: draft.match_keywords ?? [],
          bias_domain_hint: draft.bias_domain_hint ?? null,
          bias_category_hint: draft.bias_category_hint ?? null,
          bias_tone_hint: draft.bias_tone_hint ?? null,
          bias_extra_instructions: draft.bias_extra_instructions ?? null,
          override_next_status: draft.override_next_status ?? null,
          override_action_type: draft.override_action_type ?? null,
          override_priority: draft.override_priority ?? null,
          override_confidence_floor: draft.override_confidence_floor ?? null,
          override_skip_action: !!draft.override_skip_action,
        });
        return created.id;
      }
      const { _new, _dirty, user_id, id, created_at, updated_at, match_count, last_matched_at, ...patch } = draft;
      await updateAgentRoutingRule(id!, patch as Partial<AgentRoutingRule>);
      return id!;
    },
    onSuccess: (savedId, draft) => {
      toast.success("Regola salvata");
      setDrafts((d) => {
        const next = { ...d };
        delete next[draft.id ?? savedId];
        return next;
      });
      qc.invalidateQueries({ queryKey: queryKeys.agents.routingRules() });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore salvataggio"),
  });

  const deleteMut = useMutation({
    mutationFn: async (rule: Draft) => {
      if (rule._new) return;
      await deleteAgentRoutingRule(rule.id!);
    },
    onSuccess: (_v, rule) => {
      toast.success(rule._new ? "Bozza scartata" : "Regola eliminata");
      setDrafts((d) => {
        const next = { ...d };
        delete next[rule.id ?? ""];
        return next;
      });
      qc.invalidateQueries({ queryKey: queryKeys.agents.routingRules() });
    },
  });

  function patch(id: string, p: Partial<AgentRoutingRule>) {
    setDrafts((d) => {
      const base = d[id] ?? merged.find((r) => r.id === id) ?? {};
      return { ...d, [id]: { ...base, ...p, _dirty: true } as Draft };
    });
  }

  function addNew() {
    if (!user?.id) return;
    const draft = emptyDraft(user.id);
    const tmpId = `new-${Date.now()}`;
    draft.id = tmpId;
    setDrafts((d) => ({ ...d, [tmpId]: draft }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Routing persona-aware</h2>
          <p className="text-sm text-muted-foreground">
            Regole DB che il classificatore email applica per ogni persona. Sostituiscono la logica
            hardcoded di escalation: bias pre-classificazione + override post-classificazione.
            Persona-specifiche battono globali; priorità più bassa = valutata prima.
          </p>
        </div>
        <Button onClick={addNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuova regola
        </Button>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Le regole NON aggirano i guardrail di sicurezza (hard guards: tabelle vietate, soft-delete,
          bulk caps, lead_status_guard). L'override del lead_status passa comunque per
          <code className="mx-1">applyLeadStatusChange</code>.
        </AlertDescription>
      </Alert>

      {isLoading && <Skeleton className="h-48 w-full" />}

      <div className="space-y-3">
        {merged.map((rule) => (
          <RuleEditor
            key={rule.id}
            rule={rule}
            agents={agents}
            onChange={(p) => patch(rule.id!, p)}
            onSave={() => saveMut.mutate(rule)}
            onDelete={() => deleteMut.mutate(rule)}
            saving={saveMut.isPending}
          />
        ))}
        {!isLoading && merged.length === 0 && (
          <Alert>
            <AlertDescription>
              Nessuna regola di routing configurata. Crea la prima per personalizzare come ogni
              persona interpreta le email in arrivo.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

export default AgentRoutingTab;