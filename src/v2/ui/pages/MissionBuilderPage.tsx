/**
 * MissionBuilderPage — Mission creation for AI agents with wizard
 */
import * as React from "react";
import { useState } from "react";
import { useMissionBuilderV2 } from "@/v2/hooks/useMissionBuilderV2";
import { useAgentsV2 } from "@/v2/hooks/useAgentsV2";
import { Button } from "../atoms/Button";
import { Crosshair, Send, Bot, ChevronLeft, ChevronRight } from "lucide-react";

const STEP_LABELS: Record<string, string> = {
  target: "Target",
  channel: "Canale",
  communication: "Messaggio",
  agents: "Agente",
  schedule: "Pianificazione",
  confirm: "Conferma",
};

export function MissionBuilderPage(): React.ReactElement {
  const {
    currentStep, stepIndex, totalSteps, config,
    nextStep, prevStep, updateConfig, submitMission, isSubmitting,
  } = useMissionBuilderV2();
  const { data: agents } = useAgentsV2();

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-card p-4 space-y-4">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Crosshair className="h-4 w-4" />Missione
        </h3>
        <p className="text-xs text-muted-foreground">
          Crea una missione per i tuoi agenti AI con il wizard step-by-step.
        </p>

        {/* Steps progress */}
        <div className="space-y-1">
          {Object.entries(STEP_LABELS).map(([key, label], i) => (
            <div
              key={key}
              className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                currentStep === key
                  ? "bg-primary text-primary-foreground font-medium"
                  : i < stepIndex
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <span className="w-4 text-center">{i < stepIndex ? "✓" : i + 1}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Agents list */}
        {agents && agents.length > 0 ? (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">Agenti disponibili</p>
            {agents.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm text-foreground">
                <span>{a.avatarEmoji}</span><span>{a.name}</span>
              </div>
            ))}
          </div>
        ) : null}
      </aside>

      {/* Content area */}
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b bg-card">
          <h2 className="font-semibold text-foreground">
            Step {stepIndex + 1}/{totalSteps}: {STEP_LABELS[currentStep] ?? currentStep}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === "target" && (
            <div className="space-y-4 max-w-lg">
              <p className="text-sm text-muted-foreground">Definisci il target della missione.</p>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Es: Partner in Germania senza email"
                onChange={(e) => updateConfig({ targetFilter: { description: e.target.value } })}
              />
            </div>
          )}
          {currentStep === "channel" && (
            <div className="space-y-3 max-w-lg">
              <p className="text-sm text-muted-foreground">Seleziona il canale di comunicazione.</p>
              {["email", "whatsapp", "linkedin", "call"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => updateConfig({ channel: ch })}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${config.channel === ch ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-accent/50"}`}
                >
                  {ch.charAt(0).toUpperCase() + ch.slice(1)}
                </button>
              ))}
            </div>
          )}
          {currentStep === "communication" && (
            <div className="space-y-4 max-w-lg">
              <p className="text-sm text-muted-foreground">Scrivi il template del messaggio.</p>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground min-h-[200px] font-mono"
                placeholder="Ciao {nome}, ..."
                value={config.messageTemplate}
                onChange={(e) => updateConfig({ messageTemplate: e.target.value })}
              />
            </div>
          )}
          {currentStep === "agents" && (
            <div className="space-y-3 max-w-lg">
              <p className="text-sm text-muted-foreground">Assegna un agente alla missione.</p>
              {agents?.map((a) => (
                <button
                  key={a.id}
                  onClick={() => updateConfig({ agentId: a.id })}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm flex items-center gap-3 transition-colors ${config.agentId === a.id ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-accent/50"}`}
                >
                  <span className="text-xl">{a.avatarEmoji}</span>
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs opacity-70">{a.role}</p>
                  </div>
                </button>
              )) ?? <p className="text-sm text-muted-foreground">Nessun agente disponibile</p>}
            </div>
          )}
          {currentStep === "schedule" && (
            <div className="space-y-4 max-w-lg">
              <p className="text-sm text-muted-foreground">Pianifica l'esecuzione.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => updateConfig({ scheduledAt: null })}
                  className={`px-4 py-3 rounded-lg border text-sm transition-colors ${!config.scheduledAt ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
                >
                  Esegui subito
                </button>
                <input
                  type="datetime-local"
                  className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                  onChange={(e) => updateConfig({ scheduledAt: e.target.value || null })}
                />
              </div>
            </div>
          )}
          {currentStep === "confirm" && (
            <div className="space-y-4 max-w-lg">
              <h3 className="font-semibold text-foreground">Riepilogo missione</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Canale</span>
                  <span className="text-foreground">{config.channel}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Agente</span>
                  <span className="text-foreground">{agents?.find((a) => a.id === config.agentId)?.name ?? "Non selezionato"}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Pianificazione</span>
                  <span className="text-foreground">{config.scheduledAt ?? "Immediata"}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="p-4 border-t bg-card flex justify-between">
          <Button variant="outline" onClick={prevStep} disabled={stepIndex === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" />Indietro
          </Button>
          {currentStep === "confirm" ? (
            <Button onClick={submitMission} isLoading={isSubmitting} className="gap-2">
              <Send className="h-4 w-4" />Lancia missione
            </Button>
          ) : (
            <Button onClick={nextStep}>
              Avanti<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
