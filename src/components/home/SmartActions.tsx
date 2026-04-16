/**
 * SmartActions — Data-driven actionable suggestions for the dashboard
 */
import { useNavigate } from "react-router-dom";
import { useSmartSuggestions } from "@/v2/hooks/useSmartSuggestions";
import { ChevronRight } from "lucide-react";

export function SmartActions() {
  const navigate = useNavigate();
  const { data: suggestions = [] } = useSmartSuggestions();

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 px-1">
        ⚡ Azioni suggerite
      </div>
      <div className="flex flex-col gap-1">
        {suggestions.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(s.route)}
            className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-left transition-all hover:bg-card/90 hover:border-primary/30 group"
          >
            <span className="text-base leading-none">{s.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground">{s.label}</div>
              <div className="text-[10px] text-muted-foreground/70 truncate">{s.description}</div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
