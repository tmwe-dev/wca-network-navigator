import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findActiveEmailPrompts } from "@/data/emailPrompts";
import type { MissionStepProps, CommunicationConfig } from "./types";

interface EmailPromptEntry { id: string; title: string; scope: string }

export function CommunicationStep({ data, onChange }: MissionStepProps) {
  const comm = data.communication || { templateMode: "ai_generate" };
  const set = (patch: Partial<CommunicationConfig>) => onChange({ ...data, communication: { ...comm, ...patch } });

  const [emailTypes, setEmailTypes] = useState<EmailPromptEntry[]>([]);

  useEffect(() => {
    findActiveEmailPrompts().then((d) => { if (d) setEmailTypes(d as EmailPromptEntry[]); });
  }, []);

  const modes: { key: CommunicationConfig["templateMode"]; label: string; desc: string }[] = [
    { key: "ai_generate", label: "🤖 AI genera in tempo reale", desc: "L'AI crea un messaggio personalizzato per ogni contatto basandosi sui dati" },
    { key: "preset", label: "📋 Scegli un tipo email", desc: "Usa un modello di comunicazione già configurato (es. Hook → CTA)" },
    { key: "custom", label: "✏️ Scrivi tu il modello", desc: "Definisci oggetto e corpo — l'AI li adatterà per ogni destinatario" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Come vuoi preparare i messaggi?</p>
      <div className="space-y-2">
        {modes.map(m => (
          <button key={m.key} onClick={() => set({ templateMode: m.key })}
            className={`w-full p-3 rounded-xl border text-left transition-all ${
              comm.templateMode === m.key ? "bg-primary/10 border-primary ring-1 ring-primary/30" : "bg-muted/30 border-border hover:border-primary/50"
            }`}>
            <div className="text-sm font-medium">{m.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {comm.templateMode === "preset" && emailTypes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Seleziona il tipo:</p>
          <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto">
            {emailTypes.map(et => (
              <button key={et.id} onClick={() => set({ presetId: et.id, emailType: et.title })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  comm.presetId === et.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:border-primary/50"
                }`}>
                {et.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {comm.templateMode === "custom" && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Oggetto (template)</Label>
            <Input value={comm.customSubject || ""} onChange={e => set({ customSubject: e.target.value })}
              placeholder="Es: Partnership opportunity — {{company}}" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs">Corpo (template)</Label>
            <Textarea value={comm.customBody || ""} onChange={e => set({ customBody: e.target.value })}
              placeholder="Scrivi il modello del messaggio. Usa {{name}}, {{company}}, {{country}} come variabili..."
              className="text-sm min-h-[100px]" />
          </div>
          <p className="text-xs text-muted-foreground">💡 L'AI adatterà questo modello per ogni destinatario, personalizzando il tono e i dettagli.</p>
        </div>
      )}

      {comm.templateMode === "ai_generate" && (
        <div className="bg-muted/20 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p>💡 <strong>L'AI genererà un messaggio unico per ogni contatto</strong>, usando:</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>Dati del partner (servizi, certificazioni, rating)</li>
            <li>Profilo scaricato (se disponibile)</li>
            <li>Knowledge Base aziendale</li>
            <li>Risultati Deep Search (se attivato)</li>
          </ul>
          <p>Chiedi all'AI nella chat di generare un esempio di anteprima!</p>
        </div>
      )}
    </div>
  );
}
