import { useTextIntensity, type TextIntensity } from "@/providers/TextIntensityProvider";
import { cn } from "@/lib/utils";

const STEPS: { value: TextIntensity; label: string; hint: string }[] = [
  { value: "soft", label: "Aa", hint: "Tenue" },
  { value: "normal", label: "Aa", hint: "Normale" },
  { value: "strong", label: "Aa", hint: "Forte" },
  { value: "max", label: "Aa", hint: "Massimo" },
];

interface Props {
  className?: string;
  compact?: boolean;
}

/**
 * Toggle a 4 step per regolare l'intensità del testo (chiaro/scuro)
 * in tutta la piattaforma. Persistente in localStorage.
 */
export function TextIntensityToggle({ className, compact = false }: Props) {
  const { intensity, setIntensity } = useTextIntensity();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-card/40 p-0.5",
        className,
      )}
      role="radiogroup"
      aria-label="Intensità testo"
    >
      {STEPS.map((step, idx) => {
        const active = step.value === intensity;
        const sizeClass =
          idx === 0 ? "text-[10px]" : idx === 1 ? "text-xs" : idx === 2 ? "text-sm" : "text-base font-semibold";
        return (
          <button
            key={step.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={`Intensità testo: ${step.hint}`}
            onClick={() => setIntensity(step.value)}
            className={cn(
              "rounded-sm px-2 py-1 leading-none transition-colors",
              compact ? "min-w-[22px]" : "min-w-[28px]",
              sizeClass,
              active
                ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
            )}
          >
            {step.label}
          </button>
        );
      })}
    </div>
  );
}

export default TextIntensityToggle;