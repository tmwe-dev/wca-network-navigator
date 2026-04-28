/**
 * AgentCapabilitiesTab — Per-agent capability editor (Prompt Lab).
 *
 * Pure UI: legge agenti + capabilities via DAL e delega le mutation
 * a `useAgentCapabilities`. Hard guards di sicurezza restano enforced
 * lato backend e NON sono modificabili da qui.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Loader2, Save, Shield, ListChecks, Ban } from "lucide-react";
import { useAgentCapabilities } from "../hooks/useAgentCapabilities";
import { listAgentsForCapabilities } from "@/data/agentsForPromptLab";
import { queryKeys } from "@/lib/queryKeys";

const TOOL_REGISTRY = [
  "navigate", "read_page", "read_dom", "read_table",
  "click", "type_text", "wait_for", "scroll_to",
  "select_option", "upload_file", "submit_form", "take_snapshot",
  "list_kb", "read_kb", "scrape_url",
  "send_email", "send_whatsapp", "send_linkedin",
  "execute_bulk_outreach", "schedule_campaign",
  "update_partner_status_bulk", "update_contact_status_bulk",
  "ask_user", "finish",
] as const;

const EXEC_MODES = [
  { value: "supervised", label: "Supervisionato (approvazione tool con side-effect)" },
  { value: "autonomous", label: "Autonomo (entro i limiti tecnici)" },
  { value: "read_only", label: "Solo lettura (nessuna scrittura)" },
] as const;

const MODELS = [
  { value: "", label: "Default funzione (gemini-2.5-flash)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (veloce)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (ragionamento)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { value: "openai/gpt-5", label: "GPT-5 (alta qualità)" },
] as const;

export function AgentCapabilitiesTab() {
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.allForCapabilities(),
    queryFn: listAgentsForCapabilities,
    staleTime: 60_000,
  });

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  useEffect(() => {
    if (!selectedAgentId && agentsQuery.data?.length) {
      setSelectedAgentId(agentsQuery.data[0].id);
    }
  }, [agentsQuery.data, selectedAgentId]);

  const { capabilities, loading, saving, save, draft, setDraft, dirty } =
    useAgentCapabilities(selectedAgentId);

  const selectedAgent = useMemo(
    () => agentsQuery.data?.find((a) => a.id === selectedAgentId) ?? null,
    [agentsQuery.data, selectedAgentId],
  );

  if (agentsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Carico agenti…
      </div>
    );
  }
  if (!agentsQuery.data?.length) {
    return <div className="p-4 text-sm text-muted-foreground">Nessun agente configurato.</div>;
  }

  return (
    <div className="flex flex-col gap-3 h-full overflow-auto pr-1">
      <Card className="p-3">
        <Label className="text-xs">Agente</Label>
        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
          <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {agentsQuery.data.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.avatar_emoji} {a.name} <span className="text-muted-foreground">· {a.role}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAgent && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Modifica le capacità di esecuzione di <strong>{selectedAgent.name}</strong>.
            I guardrail di sicurezza (azioni distruttive, tabelle vietate, cap bulk) restano sempre attivi.
          </p>
        )}
      </Card>

      {loading || !draft ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico capacità…
        </div>
      ) : (
        <>
          <Card className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Modalità di esecuzione</h3>
            </div>
            <Select
              value={draft.execution_mode}
              onValueChange={(v) => setDraft({ ...draft, execution_mode: v as typeof draft.execution_mode })}
            >
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXEC_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Modello AI preferito</Label>
                <Select
                  value={draft.preferred_model ?? ""}
                  onValueChange={(v) => setDraft({ ...draft, preferred_model: v || null })}
                >
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value || "default"} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Temperatura ({draft.temperature.toFixed(2)})</Label>
                <Input
                  type="number" min={0} max={2} step={0.05}
                  className="h-8 mt-1"
                  value={draft.temperature}
                  onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <NumField label="Concorrenza max" value={draft.max_concurrent_tools} min={1} max={25}
                onChange={(v) => setDraft({ ...draft, max_concurrent_tools: v })} />
              <NumField label="Timeout step (ms)" value={draft.step_timeout_ms} min={1000} max={120000} step={500}
                onChange={(v) => setDraft({ ...draft, step_timeout_ms: v })} />
              <NumField label="Iterazioni max" value={draft.max_iterations} min={1} max={50}
                onChange={(v) => setDraft({ ...draft, max_iterations: v })} />
              <NumField label="Token max/call" value={draft.max_tokens_per_call} min={100} max={16000} step={100}
                onChange={(v) => setDraft({ ...draft, max_tokens_per_call: v })} />
            </div>
          </Card>

          <Card className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Tool consentiti (whitelist)</h3>
              <span className="text-[11px] text-muted-foreground">
                Vuoto = tutti i tool del registry sono disponibili (filtrati da blacklist e modalità).
              </span>
            </div>
            <ToolGrid
              selected={draft.allowed_tools}
              onToggle={(name) => setDraft({
                ...draft,
                allowed_tools: toggle(draft.allowed_tools, name),
              })}
            />

            <div className="flex items-center gap-2 pt-2 border-t">
              <Ban className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold">Tool bloccati (blacklist)</h3>
            </div>
            <ToolGrid
              selected={draft.blocked_tools}
              variant="danger"
              onToggle={(name) => setDraft({
                ...draft,
                blocked_tools: toggle(draft.blocked_tools, name),
              })}
            />

            <div className="flex items-center gap-2 pt-2 border-t">
              <Shield className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">Tool che richiedono approvazione</h3>
              <span className="text-[11px] text-muted-foreground">
                In aggiunta agli hard guards di sicurezza.
              </span>
            </div>
            <ToolGrid
              selected={draft.approval_required_tools}
              variant="warning"
              onToggle={(name) => setDraft({
                ...draft,
                approval_required_tools: toggle(draft.approval_required_tools, name),
              })}
            />
          </Card>

          <Card className="p-3 space-y-2">
            <Label className="text-xs">Note operative</Label>
            <Textarea
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={3}
              placeholder="Es. agente dedicato a deep search Sherlock — non inviare email."
            />
          </Card>

          <div className="flex items-center gap-2 sticky bottom-0 bg-background py-2 border-t">
            <Button onClick={save} disabled={!dirty || saving} size="sm" className="gap-2">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salva capacità
            </Button>
            {dirty && <Badge variant="outline" className="text-[10px]">Modifiche non salvate</Badge>}
            {capabilities && !dirty && (
              <span className="text-[11px] text-muted-foreground">
                Aggiornato {new Date(capabilities.updated_at).toLocaleString("it-IT")}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NumField({
  label, value, onChange, min, max, step = 1,
}: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number" min={min} max={max} step={step}
        className="h-8 mt-1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function ToolGrid({
  selected, onToggle, variant = "default",
}: {
  selected: string[];
  onToggle: (name: string) => void;
  variant?: "default" | "danger" | "warning";
}) {
  const sel = new Set(selected);
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
      {TOOL_REGISTRY.map((name) => {
        const active = sel.has(name);
        const cls = active
          ? variant === "danger"
            ? "border-destructive bg-destructive/10"
            : variant === "warning"
            ? "border-amber-500 bg-amber-500/10"
            : "border-primary bg-primary/10"
          : "border-border";
        return (
          <label
            key={name}
            className={`flex items-center gap-2 px-2 py-1 rounded border text-xs cursor-pointer hover:bg-muted/50 ${cls}`}
          >
            <Switch checked={active} onCheckedChange={() => onToggle(name)} />
            <span className="font-mono truncate">{name}</span>
          </label>
        );
      })}
    </div>
  );
}

function toggle(list: string[], name: string): string[] {
  return list.includes(name) ? list.filter((x) => x !== name) : [...list, name];
}