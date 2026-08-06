/**
 * SuggestRuleButton — Componente inline per proporre una regola dalla chat.
 *
 * Quando l'AI rileva una divergenza o l'utente corregge qualcosa,
 * il sistema mostra questo componente nel flusso della chat.
 * L'utente clicca → il suggerimento viene salvato in suggested_improvements.
 *
 * Props:
 * - title: titolo breve della regola proposta
 * - content: testo completo della regola
 * - reasoning: perché l'AI lo propone
 * - sourceContext: da dove viene (chat, email_edit, feedback, etc.)
 * - suggestionType: tipo (user_preference per utenti, kb_rule/prompt_adjustment per admin)
 * - targetBlockId: blocco target opzionale
 * - targetCategory: categoria KB target opzionale
 * - priority: priorità stimata dall'AI
 * - userId: chi lo propone
 * - onSaved: callback post-salvataggio
 */
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { BookmarkPlus, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createSuggestion,
  type SuggestionSource,
  type SuggestionType,
  type SuggestionPriority,
} from "@/data/suggestedImprovements";

interface SuggestRuleButtonProps {
  title: string;
  content: string;
  reasoning?: string;
  sourceContext?: SuggestionSource;
  suggestionType?: SuggestionType;
  targetBlockId?: string;
  targetCategory?: string;
  priority?: SuggestionPriority;
  userId: string;
  onSaved?: () => void;
}

export function SuggestRuleButton({
  title,
  content,
  reasoning,
  sourceContext = "chat",
  suggestionType = "kb_rule",
  targetBlockId,
  targetCategory,
  priority = "medium",
  userId,
  onSaved,
}: SuggestRuleButtonProps) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSave = useCallback(async () => {
    if (saved || saving) return;
    setSaving(true);
    try {
      await createSuggestion(userId, {
        source_context: sourceContext,
        suggestion_type: suggestionType,
        title,
        content,
        reasoning,
        target_block_id: targetBlockId,
        target_category: targetCategory,
        priority,
      });
      setSaved(true);
      const label = suggestionType === "user_preference"
        ? "Preferenza salvata"
        : "Proposta inviata per approvazione admin";
      toast.success(label);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }, [saved, saving, userId, sourceContext, suggestionType, title, content, reasoning, targetBlockId, targetCategory, priority, onSaved]);

  return (
    <div className="my-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium flex items-center gap-1.5">
            <BookmarkPlus className="h-3.5 w-3.5 text-primary shrink-0" />
            {suggestionType === "user_preference" ? "Salvare come preferenza?" : "Proporre come regola?"}
          </p>
          <p className="text-[11px] font-medium mt-1">{title}</p>
          {reasoning && (
            <p className="text-[10px] text-muted-foreground mt-0.5 italic">{reasoning}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Comprimi" : "Mostra dettagli"}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            className="h-7 px-3 text-[11px] gap-1"
            disabled={saved || saving}
            onClick={handleSave}
          >
            {saved ? (
              <>
                <Check className="h-3 w-3" />
                {suggestionType === "user_preference" ? "Salvata" : "Inviata"}
              </>
            ) : saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <BookmarkPlus className="h-3 w-3" />
                {suggestionType === "user_preference" ? "Salva" : "Proponi"}
              </>
            )}
          </Button>
        </div>
      </div>
      {expanded && (
        <pre className="mt-2 rounded bg-background/60 p-2 text-[10px] font-mono leading-snug overflow-auto max-h-32 whitespace-pre-wrap">
          {content}
        </pre>
      )}
    </div>
  );
}
