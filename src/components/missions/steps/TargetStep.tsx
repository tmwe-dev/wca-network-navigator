import type { MissionStepProps } from "./types";

export function TargetStep({ data, onChange, stats }: MissionStepProps) {
  const countries = stats?.countries || [];
  const selected = data.targets?.countries || [];

  const toggle = (code: string) => {
    const cur = [...selected];
    const idx = cur.indexOf(code);
    if (idx >= 0) cur.splice(idx, 1); else cur.push(code);
    onChange({ ...data, targets: { ...data.targets, countries: cur, types: data.targets?.types || [], ratings: data.targets?.ratings || [], hasEmail: data.targets?.hasEmail ?? true } });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Seleziona i paesi target (dati dal tuo database):</p>
      <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
        {countries.length === 0 && <p className="text-xs text-muted-foreground italic">Chiedi all'AI di caricare le statistiche...</p>}
        {countries.map(c => (
          <button key={c.code} onClick={() => toggle(c.code)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              selected.includes(c.code) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:border-primary/50"
            }`}>
            {c.name} <span className="opacity-70">({c.count})</span>
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-primary font-medium">
          {selected.length} paesi — {countries.filter(c => selected.includes(c.code)).reduce((s, c) => s + c.count, 0)} contatti
        </p>
      )}
    </div>
  );
}
