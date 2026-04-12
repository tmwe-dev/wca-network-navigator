import { Input } from "@/components/ui/input";
import type { MissionStepProps } from "./types";

export function ScheduleStep({ data, onChange }: MissionStepProps) {
  const options: { key: "immediate" | "scheduled" | "distributed"; label: string; desc: string }[] = [
    { key: "immediate", label: "⚡ Subito", desc: "Inserisci immediatamente nel cockpit" },
    { key: "scheduled", label: "📅 Programmato", desc: "Inizia in una data specifica" },
    { key: "distributed", label: "📊 Distribuito", desc: "Spalma l'invio su più giorni" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {options.map(o => (
          <button key={o.key} onClick={() => onChange({ ...data, schedule: o.key })}
            className={`p-4 rounded-xl border text-center transition-all ${data.schedule === o.key ? "bg-primary/10 border-primary ring-1 ring-primary/30" : "bg-muted/30 border-border hover:border-primary/50"}`}>
            <div className="text-sm font-medium">{o.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{o.desc}</div>
          </button>
        ))}
      </div>
      {data.schedule === "scheduled" && (
        <Input type="datetime-local" value={data.scheduleDate || ""} onChange={e => onChange({ ...data, scheduleDate: e.target.value })} className="max-w-xs" />
      )}
    </div>
  );
}
