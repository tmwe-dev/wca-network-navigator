import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingDown, TrendingUp, Sparkles, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { createMemory } from "@/data/aiMemory";

const log = createLogger("EmailEditLearning");

export interface EditAnalysis {
  significance: "low" | "medium" | "high";
  length_change_pct: number;
  tone_shift: string | null;
  structural_changes: string[];
  suggested_memory: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  analysis: EditAnalysis;
  onSendAndSave: () => void;
  onSendWithoutSaving: () => void;
}

export default function EmailEditLearningDialog({
  open, onClose, analysis, onSendAndSave, onSendWithoutSaving,
}: Props) {
  const [saving, setSaving] = useState(false);

  const handleSaveAndSend = async () => {
    if (!analysis.suggested_memory) {
      onSendWithoutSaving();
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await createMemory({
        user_id: user.id,
        content: analysis.suggested_memory,
        memory_type: "style_preference",
        level: 1,
        source: "email_edit_learning",
        importance: analysis.significance === "high" ? 8 : 5,
        confidence: 0.6,
        tags: ["style_preference", "email"],
        context_page: "email-composer",
      });

      if (error) throw error;
      toast.success("Preferenza di stile salvata nella memoria AI");
      log.info("Style preference saved", { memory: analysis.suggested_memory });
    } catch (err) {
      log.error("Failed to save style preference", { error: err instanceof Error ? err.message : String(err) });
      toast.error("Errore nel salvataggio della preferenza");
    } finally {
      setSaving(false);
    }
    onSendAndSave();
  };

  const lengthIcon = analysis.length_change_pct < 0 ? TrendingDown : TrendingUp;
  const LengthIcon = lengthIcon;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Apprendimento Stile
          </DialogTitle>
          <DialogDescription>
            Ho rilevato modifiche significative al draft AI. Vuoi che le memorizzi per le prossime email?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Length change */}
          {Math.abs(analysis.length_change_pct) >= 10 && (
            <div className="flex items-center gap-2">
              <LengthIcon className="w-4 h-4 text-muted-foreground" />
              <Badge variant="outline" className="text-xs">
                {analysis.length_change_pct > 0
                  ? `+${analysis.length_change_pct}% testo`
                  : `${analysis.length_change_pct}% testo`}
              </Badge>
            </div>
          )}

          {/* Tone shift */}
          {analysis.tone_shift && (
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <Badge variant="secondary" className="text-xs">
                Tono: {analysis.tone_shift}
              </Badge>
            </div>
          )}

          {/* Structural changes */}
          {analysis.structural_changes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {analysis.structural_changes.slice(0, 4).map((change, i) => (
                <Badge key={i} variant="outline" className="text-xs text-muted-foreground">
                  {change}
                </Badge>
              ))}
            </div>
          )}

          {/* Suggested memory */}
          {analysis.suggested_memory && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground italic">
              "{analysis.suggested_memory}"
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-3.5 h-3.5 mr-1" />
            Annulla
          </Button>
          <Button variant="outline" size="sm" onClick={onSendWithoutSaving}>
            <Send className="w-3.5 h-3.5 mr-1" />
            Invia senza salvare
          </Button>
          <Button size="sm" onClick={handleSaveAndSend} disabled={saving || !analysis.suggested_memory}>
            <Brain className="w-3.5 h-3.5 mr-1" />
            {saving ? "Salvo..." : "Salva e invia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
