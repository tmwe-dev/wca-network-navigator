import { ChevronRight, ChevronLeft, Phone, Mail, Globe, SkipForward } from "lucide-react";
import type { ProspectFilters } from "../ProspectAdvancedFilters";
import { FATTURATO_PRESETS, DIPENDENTI_PRESETS } from "./useImportWizard";
import { WizardStepBar } from "./WizardStepBar";

interface ProfileStepProps {
  isDark: boolean;
  filters: ProspectFilters;
  fatturatoPreset: number | null;
  dipendentiPreset: number | null;
  onSetFilters: (fn: (f: ProspectFilters) => ProspectFilters) => void;
  onApplyFatturato: (idx: number) => void;
  onApplyDipendenti: (idx: number) => void;
  onStepClick: (step: number) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function ProfileStep({ isDark, filters, fatturatoPreset, dipendentiPreset, onSetFilters, onApplyFatturato, onApplyDipendenti, onStepClick, onNext, onBack, onSkip }: ProfileStepProps) {
  const card = `rounded-xl border ${isDark ? "bg-card/30 border-border" : "bg-card/60 border-border"}`;

  const presetChip = (active: boolean, label: string, desc: string, onClick: () => void) => (
    <button onClick={onClick} className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center transition-all ${active ? "bg-primary/20 text-primary border-primary/30" : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"}`}>
      <span className="text-xs font-bold">{label}</span>
      <span className={`text-[10px] ${active ? "" : "text-muted-foreground/60"}`}>{desc}</span>
    </button>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-2">
        <WizardStepBar currentStep={3} onStepClick={onStepClick} />
        <div className={`${card} p-3 space-y-1`}>
          <h2 className="text-sm font-bold text-foreground">Profilo aziendale <span className="text-xs font-normal text-muted-foreground">(opzionale)</span></h2>
          <p className="text-xs text-muted-foreground">Filtra per dimensione aziendale e disponibilità di contatti.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-3">
        <div className={`${card} p-3 space-y-2`}>
          <p className="text-[10px] uppercase tracking-wider font-bold text-primary/80">💰 Fatturato</p>
          <div className="grid grid-cols-4 gap-2">
            {FATTURATO_PRESETS.map((p, i) => presetChip(fatturatoPreset === i, p.label, p.desc, () => onApplyFatturato(i)))}
          </div>
        </div>

        <div className={`${card} p-3 space-y-2`}>
          <p className="text-[10px] uppercase tracking-wider font-bold text-primary/80">👥 Dipendenti</p>
          <div className="grid grid-cols-4 gap-2">
            {DIPENDENTI_PRESETS.map((p, i) => presetChip(dipendentiPreset === i, p.label, p.desc, () => onApplyDipendenti(i)))}
          </div>
        </div>

        <div className={`${card} p-3 space-y-2`}>
          <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-400/80">📞 Contatti disponibili</p>
          <div className="flex gap-2">
            <button onClick={() => onSetFilters(f => ({ ...f, has_phone: !f.has_phone, has_phone_and_email: false }))} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${filters.has_phone ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"}`}>
              <Phone className="w-3.5 h-3.5" /> Ha telefono
            </button>
            <button onClick={() => onSetFilters(f => ({ ...f, has_email: !f.has_email, has_phone_and_email: false }))} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${filters.has_email ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"}`}>
              <Mail className="w-3.5 h-3.5" /> Ha email
            </button>
            <button onClick={() => onSetFilters(f => ({ ...f, has_phone_and_email: !f.has_phone_and_email, has_phone: false, has_email: false }))} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${filters.has_phone_and_email ? "bg-primary/20 text-primary border-primary/30" : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"}`}>
              <Globe className="w-3.5 h-3.5" /> Entrambi
            </button>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border">
          <ChevronLeft className="w-4 h-4" /> Indietro
        </button>
        <div className="flex gap-2">
          <button onClick={onSkip} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all text-muted-foreground hover:text-foreground">
            Salta <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button onClick={onNext} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">
            Avanti <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
