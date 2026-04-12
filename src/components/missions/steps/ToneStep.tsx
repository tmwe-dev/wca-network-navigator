import type { MissionStepProps, ToneConfig } from "./types";

export function ToneStep({ data, onChange }: MissionStepProps) {
  const tc = data.toneConfig || { quality: "standard", tone: "professionale", language: "auto" };
  const set = (patch: Partial<ToneConfig>) => onChange({ ...data, toneConfig: { ...tc, ...patch } });

  const qualities: { key: ToneConfig["quality"]; label: string; desc: string }[] = [
    { key: "fast", label: "⚡ Rapida", desc: "~3 crediti. Modello leggero, KB ridotta" },
    { key: "standard", label: "✨ Standard", desc: "~8 crediti. KB completa, profilo partner" },
    { key: "premium", label: "💎 Premium", desc: "~15 crediti. KB completa + Deep Search + advisor" },
  ];

  const tones = ["professionale", "amichevole", "formale", "diretto", "persuasivo", "colloquiale"];
  const languages = [
    { key: "auto", label: "🌍 Auto (basato sul paese)" },
    { key: "english", label: "🇬🇧 Inglese" },
    { key: "italiano", label: "🇮🇹 Italiano" },
    { key: "français", label: "🇫🇷 Francese" },
    { key: "deutsch", label: "🇩🇪 Tedesco" },
    { key: "español", label: "🇪🇸 Spagnolo" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">Livello di qualità</p>
        <div className="space-y-2">
          {qualities.map(q => (
            <button key={q.key} onClick={() => set({ quality: q.key })}
              className={`w-full p-3 rounded-xl border text-left transition-all ${
                tc.quality === q.key ? "bg-primary/10 border-primary ring-1 ring-primary/30" : "bg-muted/30 border-border hover:border-primary/50"
              }`}>
              <div className="text-sm font-medium">{q.label}</div>
              <div className="text-xs text-muted-foreground">{q.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Tono</p>
        <div className="flex flex-wrap gap-2">
          {tones.map(t => (
            <button key={t} onClick={() => set({ tone: t })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${
                tc.tone === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:border-primary/50"
              }`}>{t}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Lingua</p>
        <div className="flex flex-wrap gap-2">
          {languages.map(l => (
            <button key={l.key} onClick={() => set({ language: l.key })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                tc.language === l.key ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:border-primary/50"
              }`}>{l.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
