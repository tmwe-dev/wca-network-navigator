/**
 * VoiceElevenLabsTab — 3 colonne: persona | coerenza | voice prompt ElevenLabs.
 */
import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Sparkles, Loader2 } from "lucide-react";
import { findAgents, updateAgent, type Agent } from "@/data/agents";
import { findAgentPersonas, updateAgentPersona, type AgentPersona } from "@/data/agentPersonas";
import { useAuth } from "@/providers/AuthProvider";
import { useLabAgent } from "../hooks/useLabAgent";
import { useVoiceCoherenceCheck } from "../hooks/useVoiceCoherenceCheck";
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function VoiceElevenLabsTab() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const lab = useLabAgent();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [personas, setPersonas] = useState<AgentPersona[]>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [voicePrompt, setVoicePrompt] = useState<string>("");
  const [improvedVoice, setImprovedVoice] = useState<string | null>(null);
  const [personaTone, setPersonaTone] = useState<string>("");
  const [personaCustomPrompt, setPersonaCustomPrompt] = useState<string>("");
  const [styleRules, setStyleRules] = useState<string>("");
  const [vocabDo, setVocabDo] = useState<string>("");
  const [vocabDont, setVocabDont] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [savingPersona, setSavingPersona] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);

  // Load agents + personas
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const [a, p] = await Promise.all([findAgents(), findAgentPersonas(userId)]);
        const voiceAgents = a.filter((x) => x.elevenlabs_agent_id || x.elevenlabs_voice_id || x.role === "voice" || true);
        setAgents(voiceAgents);
        setPersonas(p);
        if (voiceAgents.length > 0 && !agentId) setAgentId(voiceAgents[0].id);
      } catch (e) {
        toast.error(`Errore caricamento agenti: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const currentAgent = useMemo(() => agents.find((a) => a.id === agentId) ?? null, [agents, agentId]);
  const currentPersona = useMemo(() => personas.find((p) => p.agent_id === agentId) ?? null, [personas, agentId]);

  // Sync UI fields when selection changes
  useEffect(() => {
    setVoicePrompt(currentAgent?.system_prompt ?? "");
    setImprovedVoice(null);
    setPersonaTone(currentPersona?.tone ?? "");
    setPersonaCustomPrompt(currentPersona?.custom_tone_prompt ?? "");
    setStyleRules((currentPersona?.style_rules ?? []).join("\n"));
    setVocabDo((currentPersona?.vocabulary_do ?? []).join("\n"));
    setVocabDont((currentPersona?.vocabulary_dont ?? []).join("\n"));
  }, [agentId, currentAgent, currentPersona]);

  const personaSummary = useMemo(() => ({
    language: currentPersona?.language ?? "it",
    tone: personaTone,
    vocabulary_do: vocabDo.split("\n").map((s) => s.trim()).filter(Boolean),
    vocabulary_dont: vocabDont.split("\n").map((s) => s.trim()).filter(Boolean),
  }), [currentPersona, personaTone, vocabDo, vocabDont]);

  const coherence = useVoiceCoherenceCheck(personaSummary, voicePrompt);

  async function handleSync() {
    if (!currentPersona) {
      toast.error("Nessuna persona associata a questo agente");
      return;
    }
    setSyncing(true);
    try {
      const personaJson = JSON.stringify({
        tone: personaTone,
        custom_tone_prompt: personaCustomPrompt,
        language: currentPersona.language,
        style_rules: styleRules.split("\n").filter(Boolean),
        vocabulary_do: vocabDo.split("\n").filter(Boolean),
        vocabulary_dont: vocabDont.split("\n").filter(Boolean),
      }, null, 2);

      const improved = await lab.improveBlock({
        block: {
          id: `voice-sync-${agentId}`,
          label: "Voice prompt ElevenLabs",
          content: `Persona di riferimento:\n${personaJson}\n\n--- Voice prompt attuale ---\n${voicePrompt}`,
          source: { kind: "ephemeral" },
          dirty: false,
        },
        instruction: "Genera un voice prompt naturale e conversazionale per ElevenLabs (no markdown, no bullet, no liste numerate, frasi parlate). Deve essere coerente con la persona indicata. Restituisci SOLO il prompt.",
        tabLabel: "Voice / ElevenLabs",
      });
      setImprovedVoice(improved);
    } catch (e) {
      toast.error(`Sync fallito: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleAcceptVoice() {
    if (!improvedVoice || !currentAgent) return;
    setVoicePrompt(improvedVoice);
    setImprovedVoice(null);
  }

  async function handleSaveAgent() {
    if (!currentAgent) return;
    setSavingAgent(true);
    try {
      await updateAgent(currentAgent.id, { system_prompt: voicePrompt });
      await logSupervisorAudit({ action: "prompt_lab_save", target_table: "agents", target_id: currentAgent.id });
      toast.success("Voice prompt salvato");
    } catch (e) {
      toast.error(`Errore salvataggio agente: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingAgent(false);
    }
  }

  async function handleSavePersona() {
    if (!currentPersona) return;
    setSavingPersona(true);
    try {
      await updateAgentPersona(currentPersona.id, {
        tone: personaTone,
        custom_tone_prompt: personaCustomPrompt,
        style_rules: styleRules.split("\n").map((s) => s.trim()).filter(Boolean),
        vocabulary_do: vocabDo.split("\n").map((s) => s.trim()).filter(Boolean),
        vocabulary_dont: vocabDont.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      await logSupervisorAudit({ action: "prompt_lab_save", target_table: "agent_personas", target_id: currentPersona.id });
      toast.success("Persona salvata");
    } catch (e) {
      toast.error(`Errore salvataggio persona: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingPersona(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground">Agente:</label>
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger className="w-[280px] h-8 text-xs">
            <SelectValue placeholder="Seleziona agente" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id} className="text-xs">
                {a.avatar_emoji} {a.name} {a.elevenlabs_agent_id && <Badge variant="outline" className="ml-1 text-[9px]">11L</Badge>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* COL 1: PERSONA INTERNA */}
        <div className="col-span-5 border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prompt interno (Persona)</h3>
            <Button size="sm" variant="outline" className="h-6 text-xs" disabled={!currentPersona || savingPersona} onClick={handleSavePersona}>
              {savingPersona ? "..." : "Salva persona"}
            </Button>
          </div>
          {!currentPersona && <p className="text-xs text-muted-foreground italic">Nessuna persona associata.</p>}
          {currentPersona && (
            <>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">Tono</label>
                <Textarea value={personaTone} onChange={(e) => setPersonaTone(e.target.value)} className="text-xs min-h-[40px]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">Custom tone prompt</label>
                <Textarea value={personaCustomPrompt} onChange={(e) => setPersonaCustomPrompt(e.target.value)} className="text-xs min-h-[60px] font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">Style rules (1 per riga)</label>
                <Textarea value={styleRules} onChange={(e) => setStyleRules(e.target.value)} className="text-xs min-h-[50px] font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">Vocabolario DO</label>
                  <Textarea value={vocabDo} onChange={(e) => setVocabDo(e.target.value)} className="text-xs min-h-[50px] font-mono" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">Vocabolario DON'T</label>
                  <Textarea value={vocabDont} onChange={(e) => setVocabDont(e.target.value)} className="text-xs min-h-[50px] font-mono" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* COL 2: COHERENCE CHECK */}
        <div className="col-span-2 border rounded-md p-3 space-y-2 bg-muted/30">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coerenza</h3>
          {coherence.length === 0 && <p className="text-xs text-muted-foreground italic">Nessun dato.</p>}
          {coherence.map((c) => (
            <div key={c.field} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  c.status === "ok" && "bg-green-500",
                  c.status === "warn" && "bg-amber-500",
                  c.status === "fail" && "bg-destructive",
                )} />
                {c.field}
              </div>
              <p className="text-[10px] text-muted-foreground">{c.message}</p>
            </div>
          ))}
          <Button size="sm" className="w-full mt-3 h-7 text-xs" onClick={handleSync} disabled={syncing || !currentPersona}>
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Sparkles className="h-3 w-3" /> Sync <ArrowRight className="h-3 w-3" /></>}
          </Button>
        </div>

        {/* COL 3: VOICE PROMPT */}
        <div className="col-span-5 border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prompt ElevenLabs (Voice)</h3>
            <Button size="sm" variant="outline" className="h-6 text-xs" disabled={!currentAgent || savingAgent} onClick={handleSaveAgent}>
              {savingAgent ? "..." : "Salva voice"}
            </Button>
          </div>
          <Textarea
            value={voicePrompt}
            onChange={(e) => setVoicePrompt(e.target.value)}
            className="text-xs min-h-[280px] font-mono"
            placeholder="System prompt voice agent..."
          />
          {improvedVoice && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-300 dark:border-green-800 rounded-md p-2 relative">
              <label className="text-[10px] font-medium text-green-700 dark:text-green-400">Versione sincronizzata</label>
              <div className="text-xs whitespace-pre-wrap mt-1 max-h-[200px] overflow-auto pr-16">{improvedVoice}</div>
              <div className="absolute top-1 right-1 flex gap-1">
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={handleAcceptVoice}>
                  <Check className="h-3 w-3 text-green-700" /> Accetta
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}