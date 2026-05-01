/**
 * BriefingPanel — opening briefing rendered in the empty state of Command.
 *
 * Pure presentational component: receives a `CommandBriefing` from the hook
 * and renders a short summary + clickable action chips. Each chip dispatches
 * the associated prompt back to the parent via `onPromptSelect`.
 */
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { CommandBriefing } from "../hooks/useCommandBriefing";

interface Props {
  briefing: CommandBriefing;
  onPromptSelect: (prompt: string) => void;
}

export function BriefingPanel({ briefing, onPromptSelect }: Props) {
  if (briefing.loading) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="mx-auto w-full max-w-2xl px-6 pt-6"
    >
      <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Briefing all'apertura
          </span>
        </div>
        <p className="text-sm text-foreground/95 font-light leading-relaxed">
          {briefing.summary}
        </p>
        {briefing.chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {briefing.chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => onPromptSelect(chip.prompt)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 hover:bg-accent hover:text-accent-foreground px-2.5 py-1 text-[11px] transition-colors"
              >
                <span aria-hidden>{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default BriefingPanel;