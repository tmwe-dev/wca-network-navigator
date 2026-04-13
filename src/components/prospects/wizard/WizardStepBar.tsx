import { Check, Building2, MapPin, Search, Rocket } from "lucide-react";

const STEPS = [
  { id: 1, label: "Settore", icon: Building2 },
  { id: 2, label: "Zona", icon: MapPin },
  { id: 3, label: "Profilo", icon: Search },
  { id: 4, label: "Avvia", icon: Rocket },
];

interface WizardStepBarProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function WizardStepBar({ currentStep, onStepClick }: WizardStepBarProps) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done = currentStep > s.id;
        const active = currentStep === s.id;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => done && onStepClick(s.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? "bg-primary/20 text-primary"
                  : done
                    ? "text-emerald-400 hover:bg-muted/30"
                    : "text-muted-foreground/40"
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{s.label}</span>
              <span className={`text-[10px] font-mono ${active ? "" : "hidden sm:inline"}`}>
                {!done && !active && `${s.id}`}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px mx-0.5 ${done ? "bg-emerald-500/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
