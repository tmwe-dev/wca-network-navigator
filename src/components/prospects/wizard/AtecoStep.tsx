import { ChevronRight, Check, SkipForward } from "lucide-react";
import { ATECO_TREE } from "@/data/atecoCategories";
import { WizardStepBar } from "./WizardStepBar";

const ATECO_SECTIONS = ATECO_TREE.filter(e => e.livello === 1);
const ATECO_GROUPS = ATECO_TREE.filter(e => e.livello === 2);

const SECTION_ICONS: Record<string, string> = {
  A: "🌾", B: "⛏️", C: "🏭", D: "⚡", E: "♻️", F: "🏗️",
  G: "🛒", H: "🚛", I: "🏨", J: "💻", K: "🏦", L: "🏘️",
  M: "🔬", N: "🧹", O: "🏛️", P: "📚", Q: "⚕️", R: "🎭",
  S: "🔧", T: "👩‍👧", U: "🌐",
};

interface AtecoStepProps {
  isDark: boolean;
  atecoCodes: string[];
  expandedSection: string | null;
  onToggleCode: (code: string) => void;
  onToggleSection: (code: string) => void;
  onExpandSection: (code: string | null) => void;
  onStepClick: (step: number) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function AtecoStep({ isDark, atecoCodes, expandedSection, onToggleCode, onToggleSection, onExpandSection, onStepClick, onNext, onSkip }: AtecoStepProps) {
  const card = `rounded-xl border ${isDark ? "bg-card/30 border-border" : "bg-card/60 border-border"}`;
  const btn = (variant: "primary" | "ghost") => {
    if (variant === "primary") return `flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30`;
    return `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all text-muted-foreground hover:text-foreground`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-2">
        <WizardStepBar currentStep={1} onStepClick={onStepClick} />
        <div className={`${card} p-3 space-y-1`}>
          <h2 className="text-sm font-bold text-foreground">Seleziona il settore ATECO</h2>
          <p className="text-xs text-muted-foreground">Scegli uno o più settori. Puoi espandere ogni sezione per selezionare gruppi specifici.</p>
        </div>
        {atecoCodes.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-primary/10 border border-primary/20 text-primary">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{atecoCodes.length} codici selezionati: {atecoCodes.slice(0, 5).join(", ")}{atecoCodes.length > 5 ? `...+${atecoCodes.length - 5}` : ""}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-2">
        {ATECO_SECTIONS.map(section => {
          const groups = ATECO_GROUPS.filter(g => g.padre === section.codice);
          const selectedInSection = groups.filter(g => atecoCodes.includes(g.codice)).length;
          const isExpanded = expandedSection === section.codice;
          const allSelected = groups.length > 0 && selectedInSection === groups.length;

          return (
            <div key={section.codice} className={`${card} overflow-hidden`}>
              <button onClick={() => onExpandSection(isExpanded ? null : section.codice)} className="w-full flex items-center gap-3 p-3 text-left transition-all hover:bg-muted/30">
                <span className="text-xl w-8 shrink-0 text-center">{SECTION_ICONS[section.codice] || "📦"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-foreground">Sezione {section.codice}</div>
                  <div className="text-[10px] truncate text-muted-foreground">{section.descrizione}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedInSection > 0 && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">{selectedInSection}/{groups.length}</span>
                  )}
                  <button onClick={e => { e.stopPropagation(); onToggleSection(section.codice); }} className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-all border ${allSelected ? "bg-primary/20 text-primary border-primary/30" : "bg-muted/30 text-muted-foreground border-border hover:border-primary/20"}`}>
                    {allSelected ? "✓ Tutti" : "Seleziona tutti"}
                  </button>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""} text-muted-foreground`} />
                </div>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border">
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {groups.map(g => {
                      const active = atecoCodes.includes(g.codice);
                      return (
                        <button key={g.codice} onClick={() => onToggleCode(g.codice)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all ${active ? "bg-primary/20 text-primary border-primary/30" : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"}`}>
                          {active && <Check className="w-3 h-3" />}
                          <span className="font-mono font-bold">{g.codice}</span>
                          <span className="truncate max-w-[160px]">{g.descrizione}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
        <span className="text-xs text-muted-foreground">{atecoCodes.length === 0 ? "Nessun settore selezionato" : ""}</span>
        <div className="flex gap-2">
          <button onClick={onSkip} className={btn("ghost")}>Salta <SkipForward className="w-3.5 h-3.5" /></button>
          <button onClick={onNext} className={btn("primary")}>Avanti <ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
