import { ChevronRight, ChevronLeft, Check, MapPin } from "lucide-react";
import { REGIONI_ITALIANE, PROVINCE_ITALIANE } from "@/data/italianProvinces";
import { WizardStepBar } from "./WizardStepBar";

interface GeographyStepProps {
  isDark: boolean;
  regions: string[];
  provinces: string[];
  onToggleRegion: (region: string) => void;
  onToggleProvince: (sigla: string) => void;
  onStepClick: (step: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function GeographyStep({ isDark, regions, provinces, onToggleRegion, onToggleProvince, onStepClick, onNext, onBack }: GeographyStepProps) {
  const card = `rounded-xl border ${isDark ? "bg-card/30 border-border" : "bg-card/60 border-border"}`;
  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${active
      ? "bg-primary/20 text-primary border-primary/30"
      : isDark ? "bg-muted/30 text-muted-foreground border-border hover:border-primary/20" : "bg-card text-muted-foreground border-border hover:border-primary/20"
    }`;

  const visibleProvinces = regions.length > 0 ? PROVINCE_ITALIANE.filter(p => regions.includes(p.regione)) : [];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-2">
        <WizardStepBar currentStep={2} onStepClick={onStepClick} />
        <div className={`${card} p-3 space-y-1`}>
          <h2 className="text-sm font-bold text-foreground">Zona geografica</h2>
          <p className="text-xs text-muted-foreground">Seleziona le regioni di interesse. Poi puoi affinare per provincia.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onToggleRegion("__ALL__")} className={chip(regions.length === 0)}>🇮🇹 Tutta Italia</button>
          {REGIONI_ITALIANE.map(r => (
            <button key={r} onClick={() => onToggleRegion(r)} className={chip(regions.includes(r))}>
              {regions.includes(r) && <Check className="w-3 h-3 inline mr-1" />}{r}
            </button>
          ))}
        </div>

        {visibleProvinces.length > 0 && (
          <div className={`${card} p-3 space-y-2`}>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Province ({regions.join(", ")})</p>
            <div className="flex flex-wrap gap-1.5">
              {visibleProvinces.map(p => (
                <button key={p.sigla} onClick={() => onToggleProvince(p.sigla)} className={`px-2 py-1 rounded-lg text-[11px] border transition-all ${provinces.includes(p.sigla) ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"}`}>
                  <span className="font-mono font-bold">{p.sigla}</span> {p.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {(regions.length > 0 || provinces.length > 0) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>
              {regions.length > 0 ? `${regions.join(", ")}` : ""}
              {provinces.length > 0 ? ` · Province: ${provinces.join(", ")}` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border">
          <ChevronLeft className="w-4 h-4" /> Indietro
        </button>
        <button onClick={onNext} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">
          Avanti <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
