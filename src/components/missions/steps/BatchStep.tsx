import { Slider } from "@/components/ui/slider";
import type { MissionStepProps } from "./types";

export function BatchStep({ data, onChange, stats }: MissionStepProps) {
  const selected = data.targets?.countries || [];
  const countries = (stats?.countries || []).filter(c => selected.includes(c.code));
  const batches = data.batching?.batches || countries.map(c => ({ country: c.code, count: Math.min(c.count, 50) }));

  const updateBatch = (country: string, count: number) => {
    const updated = batches.map(b => b.country === country ? { ...b, count } : b);
    onChange({ ...data, batching: { batches: updated } });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Regola il numero di contatti per batch:</p>
      {countries.map(c => {
        const batch = batches.find(b => b.country === c.code);
        return (
          <div key={c.code} className="flex items-center gap-3">
            <span className="text-sm w-24 truncate">{c.name}</span>
            <Slider value={[batch?.count || 0]} onValueChange={([v]) => updateBatch(c.code, v)} max={c.count} min={1} step={1} className="flex-1" />
            <span className="text-sm font-mono w-12 text-right">{batch?.count || 0}</span>
          </div>
        );
      })}
      <p className="text-xs text-primary font-medium">Totale: {batches.reduce((s, b) => s + b.count, 0)} contatti</p>
    </div>
  );
}
