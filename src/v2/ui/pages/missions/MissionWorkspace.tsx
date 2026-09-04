/**
 * MissionWorkspace — centro della maschera: la missione, il suo prompt e il
 * campo libero dove l'agente risponde e produce canvas (stesso modello Command).
 * Puramente presentazionale: riceve dati e callback dalla pagina.
 */
import * as React from "react";
import { Rocket, SendHorizonal, Sparkles, Activity } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/v2/ui/molecules/StatusDot";
import { openCoPilot } from "@/v2/ui/templates/StandardPageFrame";
import { EVENT_LABELS, statusMeta, type MissionEvent } from "./missionMeta";
import type { WorkspaceMessage } from "@/v2/hooks/useMissionWorkspaceChat";
import type { AgentMissionRow } from "@/data/agentMissions";

export interface MissionWorkspaceProps {
  readonly mission: AgentMissionRow | null;
  readonly events: readonly MissionEvent[];
  readonly messages: readonly WorkspaceMessage[];
  readonly isSending: boolean;
  readonly onSend: (text: string) => void;
  readonly goalDraft: string;
  readonly onGoalDraftChange: (v: string) => void;
  readonly onGoalSave: () => void;
  readonly isSavingGoal: boolean;
  readonly onCreate: () => void;
}

export function MissionWorkspace({
  mission,
  events,
  messages,
  isSending,
  onSend,
  goalDraft,
  onGoalDraftChange,
  onGoalSave,
  isSavingGoal,
  onCreate,
}: MissionWorkspaceProps): React.ReactElement {
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showActivity, setShowActivity] = React.useState(false);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isSending]);

  if (!mission) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <Rocket className="h-9 w-9 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">Nessuna missione aperta</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Scegli una missione dall'elenco a sinistra oppure creane una nuova per iniziare a lavorare con l'agente.
        </p>
        <Button size="sm" onClick={onCreate}>
          Nuova missione
        </Button>
      </div>
    );
  }

  const meta = statusMeta(mission.status);
  const goalDirty = goalDraft !== (mission.goal_description ?? "");

  const submit = () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    onSend(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Intestazione missione + prompt/obiettivo editabile */}
      <div className="shrink-0 border-b border-border/40 px-5 py-3">
        <div className="flex items-center gap-2">
          <StatusDot tone={meta.tone} label={meta.label} />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{mission.title}</h2>
          <button
            type="button"
            onClick={() => setShowActivity((v) => !v)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition-colors",
              showActivity
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={showActivity}
          >
            <Activity className="h-3.5 w-3.5" /> Attività
          </button>
        </div>

        <Textarea
          value={goalDraft}
          onChange={(e) => onGoalDraftChange(e.target.value)}
          rows={2}
          placeholder="Prompt della missione: cosa deve ottenere l'agente…"
          aria-label="Prompt della missione"
          className="mt-2 resize-none border-transparent bg-muted/25 text-xs focus-visible:border-border"
        />
        {goalDirty && (
          <div className="mt-1.5 flex justify-end">
            <Button size="sm" variant="outline" className="h-7" onClick={onGoalSave} disabled={isSavingGoal}>
              {isSavingGoal ? "Salvataggio…" : "Salva prompt"}
            </Button>
          </div>
        )}
      </div>

      {/* Thread agente + canvas */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {showActivity && (
          <div className="mb-4 rounded-lg border border-border/60 bg-card/60 p-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Attività della missione
            </h3>
            {events.length === 0 ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">Nessun evento ancora.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {events.map((e) => (
                  <li key={e.id} className="flex items-baseline gap-2 text-[11px]">
                    <span className="shrink-0 tabular-nums text-muted-foreground/80">
                      {new Date(e.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-foreground">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {messages.length === 0 && !isSending ? (
          <p className="text-xs text-muted-foreground">
            Scrivi qui sotto cosa deve fare l'agente su questa missione: analizzare il target, preparare i messaggi,
            proporre il piano di azioni.
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "ml-auto max-w-[85%] border-primary/30 bg-primary/10 text-foreground"
                    : "mr-auto max-w-[95%] border-border/60 bg-card/60 text-foreground",
                )}
              >
                {m.content}
              </li>
            ))}
            {isSending && (
              <li className="mr-auto max-w-[95%] rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
                L'agente sta lavorando…
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Campo libero: AI e voce dentro il campo, non in una barra separata */}
      <div className="shrink-0 border-t border-border/40 px-5 py-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-card/60 px-2 py-1.5 focus-within:border-primary/50">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Scrivi cosa deve fare l'agente…"
            aria-label="Messaggio all'agente"
            className="min-h-[32px] max-h-40 resize-none border-0 bg-transparent p-1 text-xs shadow-none focus-visible:ring-0"
          />
          <div className="flex shrink-0 items-center gap-1 pb-0.5">
            <button
              type="button"
              onClick={openCoPilot}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
              aria-label="Apri assistente AI"
              title="Assistente AI"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <Button
              size="icon"
              className="h-7 w-7"
              onClick={submit}
              disabled={isSending || input.trim().length === 0}
              aria-label="Invia"
            >
              <SendHorizonal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MissionWorkspace;
