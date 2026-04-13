import { ChevronLeft, Building2, MapPin, Search, Rocket } from "lucide-react";
import type { ProspectFilters } from "../ProspectAdvancedFilters";
import { FATTURATO_PRESETS, DIPENDENTI_PRESETS } from "./useImportWizard";
import { WizardStepBar } from "./WizardStepBar";

interface SummaryStepProps {
  isDark: boolean;
  isExtAvailable: boolean;
  atecoCodes: string[];
  regions: string[];
  provinces: string[];
  fatturatoPreset: number | null;
  dipendentiPreset: number | null;
  hasFilters: boolean;
  filters: ProspectFilters;
  onStepClick: (step: number) => void;
  onBack: () => void;
  onStart: () => void;
  onEditStep: (step: number) => void;
}

export function SummaryStep({ isDark, isExtAvailable, atecoCodes, regions, provinces, fatturatoPreset, dipendentiPreset, hasFilters, filters, onStepClick, onBack, onStart, onEditStep }: SummaryStepProps) {
  const card = `rounded-xl border ${isDark ? "bg-card/30 border-border" : "bg-card/60 border-border"}`;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-2">
        <WizardStepBar currentStep={4} onStepClick={onStepClick} />
        <div className={`${card} p-3 space-y-1`}>
          <h2 className="text-sm font-bold text-foreground">Riepilogo e avvio</h2>
          <p className="text-xs text-muted-foreground">Controlla i parametri e avvia la ricerca su Report Aziende.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-2">
        {/* ATECO */}
        <div className={`${card} p-3 flex items-start gap-3`}>
          <Building2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Settore ATECO</p>
            {atecoCodes.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {atecoCodes.slice(0, 8).map(c => (
                  <span key={c} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/15 text-primary">{c}</span>
                ))}
                {atecoCodes.length > 8 && <span className="text-[10px] text-muted-foreground">+{atecoCodes.length - 8} altri</span>}
              </div>
            ) : (
              <p className="text-xs mt-1 text-muted-foreground">Tutti i settori</p>
            )}
          </div>
          <button onClick={() => onEditStep(1)} className="text-[10px] shrink-0 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30">Modifica</button>
        </div>

        {/* Zona */}
        <div className={`${card} p-3 flex items-start gap-3`}>
          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Zona geografica</p>
            {regions.length > 0 ? (
              <p className="text-xs mt-1 text-emerald-300">
                {regions.join(", ")}
                {provinces.length > 0 && ` · Prov: ${provinces.join(", ")}`}
              </p>
            ) : (
              <p className="text-xs mt-1 text-muted-foreground">🇮🇹 Tutta Italia</p>
            )}
          </div>
          <button onClick={() => onEditStep(2)} className="text-[10px] shrink-0 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30">Modifica</button>
        </div>

        {/* Profilo */}
        <div className={`${card} p-3 flex items-start gap-3`}>
          <Search className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Profilo aziendale</p>
            {hasFilters ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {fatturatoPreset !== null && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-primary/15 text-primary border border-primary/20">
                    💰 {FATTURATO_PRESETS[fatturatoPreset].label} ({FATTURATO_PRESETS[fatturatoPreset].desc})
                  </span>
                )}
                {dipendentiPreset !== null && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-primary/15 text-primary border border-primary/20">
                    👥 {DIPENDENTI_PRESETS[dipendentiPreset].label} ({DIPENDENTI_PRESETS[dipendentiPreset].desc})
                  </span>
                )}
                {filters.has_phone && <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">📞 Ha telefono</span>}
                {filters.has_email && <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">📧 Ha email</span>}
                {filters.has_phone_and_email && <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-primary/15 text-primary border border-primary/20">📞+📧 Entrambi</span>}
              </div>
            ) : (
              <p className="text-xs mt-1 text-muted-foreground">Nessun filtro aggiuntivo</p>
            )}
          </div>
          <button onClick={() => onEditStep(3)} className="text-[10px] shrink-0 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30">Modifica</button>
        </div>

        {/* Extension status */}
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs ${isExtAvailable ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${isExtAvailable ? "bg-emerald-400" : "bg-destructive"} animate-pulse`} />
          {isExtAvailable ? "✅ Estensione RA connessa — pronto per la ricerca" : "❌ Estensione RA non rilevata — installala e ricarica la pagina prima di procedere"}
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border">
          <ChevronLeft className="w-4 h-4" /> Indietro
        </button>
        <button onClick={onStart} disabled={!isExtAvailable} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">
          <Rocket className="w-5 h-5" /> Cerca Aziende
        </button>
      </div>
    </div>
  );
}
