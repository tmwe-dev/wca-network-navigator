/**
 * AgentPersonasTab — Per-agent persona editor (Prompt Lab).
 *
 * Pure UI: legge agenti + persona via DAL e fa upsert su agent_personas.
 * Le modifiche si applicano istantaneamente (no redeploy) alle edge functions
 * che caricano la persona via _shared/agentPersonaLoader.ts (es. agent-loop,
 * agent-execute).
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Loader2, Save, User, Sparkles, BookOpen, Mic, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { listAgentsForCapabilities } from "@/data/agentsForPromptLab";
import {
  getAgentPersonaByAgent,
  upsertAgentPersona,
  type AgentPersona,
} from "@/data/agentPersonas";
import { queryKeys } from "@/lib/queryKeys";

const TONES = [
  { value: "formale", label: "Formale" },
  { value: "diretto", label: "Diretto" },
  { value: "amichevole", label: "Amichevole" },
  { value: "tecnico", label: "Tecnico" },
  { value: "custom", label: "Custom (definito sotto)" },
] as const;

const LANGS = [
  { value: "it", label: "Italiano" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
] as const;

interface Draft {
  tone: string;
  custom_tone_prompt: string;
  language: string;
  style_rules: string[];
  vocabulary_do: string[];
  vocabulary_dont: string[];
  signature_template: string;
}

const EMPTY_DRAFT: Draft = {
  tone: "formale",
  custom_tone_prompt: "",
  language: "it",
  style_rules: [],
  vocabulary_do: [],
  vocabulary_dont: [],
  signature_template: "",
};

function fromPersona(p: AgentPersona | null): Draft {
  if (!p) return { ...EMPTY_DRAFT };
  return {
    tone: p.tone ?? "formale",
    custom_tone_prompt: p.custom_tone_prompt ?? "",
    language: p.language ?? "it",
    style_rules: p.style_rules ?? [],
    vocabulary_do: p.vocabulary_do ?? [],
    vocabulary_dont: p.vocabulary_dont ?? [],
    signature_template: p.signature_template ?? "",
  };
}

function joinLines(arr: string[]): string {
  return arr.join("\n");
}

function parseLines(text: string): string[] {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

export function AgentPersonasTab() {
  const qc = useQueryClient();

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

  const personaQuery = useQuery({
    queryKey: queryKeys.agents.persona(selectedAgentId),
    queryFn: () => getAgentPersonaByAgent(selectedAgentId),
    enabled: !!selectedAgentId,
  });

  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT });
  const [baseline, setBaseline] = useState<Draft>({ ...EMPTY_DRAFT });

  useEffect(() => {
    const next = fromPersona(personaQuery.data ?? null);
    setDraft(next);
    setBaseline(next);
  }, [personaQuery.data, selectedAgentId]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );

  const selectedAgent = useMemo(
    () => agentsQuery.data?.find((a) => a.id === selectedAgentId) ?? null,
    [agentsQuery.data, selectedAgentId],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgentId) throw new Error("Nessun agente selezionato");
      await upsertAgentPersona({
        agent_id: selectedAgentId,
        tone: draft.tone,
        custom_tone_prompt: draft.tone === "custom" ? draft.custom_tone_prompt.trim() || null : null,
        language: draft.language,
        style_rules: draft.style_rules,
        vocabulary_do: draft.vocabulary_do,
        vocabulary_dont: draft.vocabulary_dont,
        signature_template: draft.signature_template.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Persona salvata — applicata istantaneamente");
      qc.invalidateQueries({ queryKey: queryKeys.agents.persona(selectedAgentId) });
      setBaseline({ ...draft });
    },
    onError: (e: Error) => toast.error(`Errore salvataggio: ${e.message}`),
  });

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
          <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1.5">
            <ShieldCheck className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
            <span>
              Identità di <strong>{selectedAgent.name}</strong>. Le modifiche si applicano in tempo reale alle edge functions
              (agent-loop, agent-execute) — nessun redeploy. I guardrail tecnici di sicurezza restano sempre attivi.
            </span>
          </p>
        )}
      </Card>

      {personaQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico persona…
        </div>
      ) : (
        <>
          <Card className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Identità & tono</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tono di base</Label>
                <Select value={draft.tone} onValueChange={(v) => setDraft({ ...draft, tone: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Lingua</Label>
                <Select value={draft.language} onValueChange={(v) => setDraft({ ...draft, language: v })}>
                  <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {draft.tone === "custom" && (
              <div>
                <Label className="text-xs">Descrizione tono custom</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={draft.custom_tone_prompt}
                  onChange={(e) => setDraft({ ...draft, custom_tone_prompt: e.target.value })}
                  placeholder="Es. Ironico ma professionale, con riferimenti alla logistica internazionale."
                />
              </div>
            )}
          </Card>

          <Card className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Comportamenti consentiti</h3>
              <span className="text-[11px] text-muted-foreground">una regola per riga</span>
            </div>
            <div>
              <Label className="text-xs">Regole di stile</Label>
              <Textarea
                className="mt-1 font-mono text-xs"
                rows={4}
                value={joinLines(draft.style_rules)}
                onChange={(e) => setDraft({ ...draft, style_rules: parseLines(e.target.value) })}
                placeholder={"Frasi corte, max 2 righe per paragrafo.\nNon usare emoji.\nFirma sempre con nome + ruolo."}
              />
            </div>
          </Card>

          <Card className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Vocabolario</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-emerald-600 dark:text-emerald-400">Usa sempre (uno per riga)</Label>
                <Textarea
                  className="mt-1 font-mono text-xs"
                  rows={5}
                  value={joinLines(draft.vocabulary_do)}
                  onChange={(e) => setDraft({ ...draft, vocabulary_do: parseLines(e.target.value) })}
                  placeholder={"partner\ncorridoio commerciale\nWCA network"}
                />
              </div>
              <div>
                <Label className="text-xs text-destructive">Evita sempre (uno per riga)</Label>
                <Textarea
                  className="mt-1 font-mono text-xs"
                  rows={5}
                  value={joinLines(draft.vocabulary_dont)}
                  onChange={(e) => setDraft({ ...draft, vocabulary_dont: parseLines(e.target.value) })}
                  placeholder={"cliente\nleads\nspettabile"}
                />
              </div>
            </div>
          </Card>

          <Card className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Firma / template chiusura</h3>
            </div>
            <Textarea
              rows={3}
              value={draft.signature_template}
              onChange={(e) => setDraft({ ...draft, signature_template: e.target.value })}
              placeholder={"-- \nMarco Rossi\nWCA Network Navigator"}
            />
          </Card>

          <div className="flex items-center gap-2 sticky bottom-0 bg-background py-2 border-t">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
              size="sm"
              className="gap-2"
            >
              {saveMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Save className="h-3.5 w-3.5" />}
              Salva persona
            </Button>
            {dirty && <Badge variant="outline" className="text-[10px]">Modifiche non salvate</Badge>}
            {!dirty && personaQuery.data && (
              <span className="text-[11px] text-muted-foreground">
                Persona configurata
              </span>
            )}
            {!personaQuery.data && !dirty && (
              <span className="text-[11px] text-muted-foreground">
                Nessuna persona — verranno usati i default dell'agente
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}