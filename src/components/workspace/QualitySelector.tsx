import { Zap, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type EmailQuality = "fast" | "standard" | "premium";

interface QualitySelectorProps {
  value: EmailQuality;
  onChange: (q: EmailQuality) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

const tiers: { key: EmailQuality; icon: typeof Zap; label: string; credits: string; desc: string }[] = [
  { key: "fast", icon: Zap, label: "Rapida", credits: "~3 cr", desc: "Modello leggero, KB ridotta. Ideale per email di routine." },
  { key: "standard", icon: Sparkles, label: "Standard", credits: "~8 cr", desc: "KB completa (sez. 1-8), profilo partner, documenti." },
  { key: "premium", icon: Crown, label: "Premium", credits: "~15-20 cr", desc: "KB completa, scraping link, LinkedIn, profilo esteso." },
];

export default function QualitySelector({ value, onChange, disabled, size = "sm" }: QualitySelectorProps) {
  const h = size === "sm" ? "h-7" : "h-8";

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("inline-flex items-center rounded-md border border-border bg-muted/30 p-0.5 gap-0.5", disabled && "opacity-50 pointer-events-none")}>
        {tiers.map((t) => {
          const Icon = t.icon;
          const active = value === t.key;
          return (
            <Tooltip key={t.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onChange(t.key)}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 text-xs font-medium transition-all",
                    h,
                    active
                      ? "bg-background text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50 border border-transparent"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px]">
                <p className="font-semibold text-xs">{t.label} <span className="text-muted-foreground font-normal">({t.credits})</span></p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
