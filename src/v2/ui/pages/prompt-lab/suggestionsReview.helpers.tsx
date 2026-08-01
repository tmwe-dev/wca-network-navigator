/**
 * Helper puri di presentazione per SuggestionsReviewPage.
 * Estratti dal componente per snellirlo — nessuna logica di stato.
 */
import { BookOpen, Wrench, User, BookmarkPlus } from "lucide-react";
import type { SuggestionPriority } from "@/application/data/suggestedImprovements";

export function priorityColor(p: SuggestionPriority): string {
  switch (p) {
    case "critical":
      return "bg-destructive/15 text-destructive border-destructive/40";
    case "high":
      return "bg-warning/15 text-warning border-warning/40";
    case "medium":
      return "bg-warning/15 text-warning border-warning/40";
    case "low":
      return "bg-muted text-muted-foreground border-border";
  }
}

export function typeIcon(type: string) {
  switch (type) {
    case "kb_rule":
      return <BookOpen className="h-3 w-3" />;
    case "prompt_adjustment":
      return <Wrench className="h-3 w-3" />;
    case "user_preference":
      return <User className="h-3 w-3" />;
    default:
      return <BookmarkPlus className="h-3 w-3" />;
  }
}

export function typeLabel(type: string): string {
  switch (type) {
    case "kb_rule":
      return "Regola KB";
    case "prompt_adjustment":
      return "Modifica Prompt";
    case "user_preference":
      return "Preferenza utente";
    default:
      return type;
  }
}
