/**
 * CreateBlockDialog — Form unificato per creare nuovi blocchi (KB, prompt, regole).
 *
 * Punto d'ingresso unico per aggiungere contenuto al sistema:
 * - KB Doctrine entries
 * - Prompt operativi
 * - Regole email
 * - Playbook
 *
 * Salva direttamente su Supabase e notifica il Prompt Lab per refresh.
 */
import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CreateBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-seleziona il tipo di blocco (es. da Atlas → "kb_entry") */
  defaultType?: BlockType;
  /** Callback post-creazione per refresh delle tab */
  onCreated?: () => void;
}

type BlockType = "kb_entry" | "operative_prompt" | "email_prompt" | "playbook";

const BLOCK_TYPES: Array<{ value: BlockType; label: string; description: string }> = [
  { value: "kb_entry", label: "KB Doctrine", description: "Nuova voce knowledge base (dottrina, procedura, regola)" },
  { value: "operative_prompt", label: "Prompt Operativo", description: "Nuovo prompt con objective/procedure/criteria" },
  { value: "email_prompt", label: "Prompt Email", description: "Nuove istruzioni per un tipo email" },
  { value: "playbook", label: "Playbook", description: "Nuovo playbook commerciale con trigger e template" },
];

const KB_CATEGORIES = [
  "system_doctrine",
  "system_core",
  "sales_doctrine",
  "doctrine",
  "memory_protocol",
  "learning_protocol",
  "workflow_gate",
  "procedure",
  "tone-and-format",
  "commercial_procedure",
  "operative_procedure",
  "administrative_procedure",
  "support_procedure",
];

export function CreateBlockDialog({ open, onOpenChange, defaultType, onCreated }: CreateBlockDialogProps) {
  const [blockType, setBlockType] = useState<BlockType>(defaultType ?? "kb_entry");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("doctrine");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const resetForm = useCallback(() => {
    setTitle("");
    setContent("");
    setCategory("doctrine");
    setSaving(false);
    setDone(false);
  }, []);

  const handleClose = useCallback((nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }, [onOpenChange, resetForm]);

  const handleSave = useCallback(async () => {
    if (!title.trim() || !content.trim()) {
      toast.warning("Titolo e contenuto sono obbligatori");
      return;
    }

    setSaving(true);

    try {
      switch (blockType) {
        case "kb_entry": {
          const { error } = await supabase.from("kb_entries").insert({
            title: title.trim(),
            content: content.trim(),
            category: category,
            is_active: true,
          });
          if (error) throw error;
          break;
        }
        case "operative_prompt": {
          const { error } = await supabase.from("operative_prompts").insert({
            name: title.trim(),
            objective: content.trim(),
            procedure: "",
            criteria: "",
            is_active: true,
          });
          if (error) throw error;
          break;
        }
        case "email_prompt": {
          const { error } = await supabase.from("email_prompts").insert({
            title: title.trim(),
            instructions: content.trim(),
            is_active: true,
          });
          if (error) throw error;
          break;
        }
        case "playbook": {
          const { error } = await supabase.from("commercial_playbooks").insert({
            name: title.trim(),
            description: content.trim(),
            prompt_template: "",
            trigger_conditions: "{}",
            is_active: true,
          });
          if (error) throw error;
          break;
        }
      }

      setDone(true);
      toast.success(`Creato: ${title.trim()}`);
      onCreated?.();

      // Chiudi dopo un attimo
      setTimeout(() => handleClose(false), 800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  }, [blockType, title, content, category, handleClose, onCreated]);

  const selectedTypeDef = BLOCK_TYPES.find((t) => t.value === blockType);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" />
            Nuovo blocco
          </DialogTitle>
          <DialogDescription className="text-xs">
            Crea una nuova voce nel sistema. Dopo il salvataggio apparirà nel Prompt Lab per editing e miglioramento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Tipo blocco */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tipo</label>
            <Select value={blockType} onValueChange={(v) => setBlockType(v as BlockType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="font-medium">{t.label}</span>
                    <span className="ml-2 text-muted-foreground text-xs">— {t.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoria KB (solo per kb_entry) */}
          {blockType === "kb_entry" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Categoria KB</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KB_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Titolo */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Titolo</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={blockType === "kb_entry" ? "Es: Procedura onboarding partner EU" : "Es: Follow-up post-meeting"}
              className="mt-1"
            />
          </div>

          {/* Contenuto */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Contenuto</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Scrivi il contenuto del blocco..."
              className="mt-1 min-h-[160px] font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Dopo la creazione potrai migliorarlo con il Lab Agent nel Prompt Lab.
            </p>
          </div>

          {/* Azioni */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={saving || done || !title.trim() || !content.trim()}>
              {done ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Creato
                </>
              ) : saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Crea blocco
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
