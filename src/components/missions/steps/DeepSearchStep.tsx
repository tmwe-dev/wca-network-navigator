import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Zap, ThumbsUp, Trophy, Info } from "lucide-react";
import {
  ALL_QUALITIES, getDeepSearchMeta, presetToMissionConfig, type DeepSearchQuality,
} from "@/lib/deepSearchPresets";
import type { MissionStepProps } from "./types";

const QUALITY_ICONS = { fast: Zap, standard: ThumbsUp, premium: Trophy } as const;

export function DeepSearchStep({ data, onChange }: MissionStepProps) {
  const ds = data.deepSearch || { enabled: false, scrapeWebsite: true, scrapeLinkedIn: true, verifyWhatsApp: false, aiAnalysis: true };
  const [quality, setQuality] = useState<DeepSearchQuality>("standard");
  const meta = getDeepSearchMeta(quality);

  const setEnabled = (v: boolean) => {
    if (v) {
      // Quando attivo, applica subito il preset corrente.
      onChange({ ...data, deepSearch: presetToMissionConfig(quality) });
    } else {
      onChange({ ...data, deepSearch: { ...ds, enabled: false } });
    }
  };

  const pickQuality = (q: DeepSearchQuality) => {
    setQuality(q);
    onChange({ ...data, deepSearch: presetToMissionConfig(q) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Attivare Deep Search prima dell'invio?</p>
          <p className="text-xs text-muted-foreground">Arricchisce i dati dei contatti per messaggi più personalizzati</p>
        </div>
        <Switch checked={ds.enabled} onCheckedChange={setEnabled} />
      </div>

      {ds.enabled && (
        <div className="space-y-3 pl-1 border-l-2 border-primary/30 ml-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Profondità di analisi
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ALL_QUALITIES.map((q) => {
                const Icon = QUALITY_ICONS[q];
                const m = getDeepSearchMeta(q);
                const active = q === quality;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => pickQuality(q)}
                    className={`flex flex-col items-center justify-center gap-1 rounded border px-2 py-2 transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{m.label}</span>
                    <span className="text-[10px] text-muted-foreground">~{m.estimatedSecondsPerRecord}s/record</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded border border-primary/20 bg-primary/5 p-2.5 flex items-start gap-2">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">{meta.label} include:</div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {meta.includedLabels.map((l) => (
                  <Badge key={l} variant="secondary" className="text-[10px] py-0 px-1.5 h-4 font-normal">{l}</Badge>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5 leading-tight">{meta.description}</div>
            </div>
          </div>
        </div>
      )}

      {!ds.enabled && (
        <div className="bg-muted/20 rounded-lg p-3 text-xs text-muted-foreground">
          💡 Senza Deep Search, i messaggi saranno generati con i dati già presenti nel database. Puoi sempre attivarlo dopo.
        </div>
      )}
    </div>
  );
}
