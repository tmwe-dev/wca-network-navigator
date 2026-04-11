import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ClipboardList, Sparkles, Briefcase, Send, StickyNote,
  X, Loader2, Square, Save, AlertCircle, Inbox,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/log";
import { createInteraction } from "@/data/interactions";

const log = createLogger("UnifiedActionBar");

interface UnifiedActionBarProps {
  selectedIds: Set<string>;
  focusedPartner: any | null;
  onClearSelection: () => void;
  onAssignActivity: () => void;
  onDeepSearch: () => void;
  onStopDeepSearch: () => void;
  onEmail: () => void;
  onSendToWorkspace: () => void;
  onSendToCockpit?: () => void;
  sendingToWorkspace?: boolean;
  sendingToCockpit?: boolean;
  deepSearching?: boolean;
  deepSearchProgress?: { current: number; total: number } | null;
  onSingleDeepSearch?: (id: string) => void;
  singleDeepSearching?: boolean;
}

export function UnifiedActionBar({
  selectedIds,
  focusedPartner,
  onClearSelection,
  onAssignActivity,
  onDeepSearch,
  onStopDeepSearch,
  onEmail,
  onSendToWorkspace,
  onSendToCockpit,
  sendingToWorkspace,
  sendingToCockpit,
  deepSearching,
  deepSearchProgress,
  onSingleDeepSearch,
  singleDeepSearching,
}: UnifiedActionBarProps) {
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const queryClient = useQueryClient();

  const isBulk = selectedIds.size > 0;
  const isSingle = !isBulk && !!focusedPartner;
  const isVisible = isBulk || isSingle;

  const needsEnrichment = isSingle && (!focusedPartner?.enrichment_data || !focusedPartner?.company_alias);

  const handleSaveNote = useCallback(async () => {
    if (!noteText.trim() || !focusedPartner) return;
    setSavingNote(true);
    try {
      await createInteraction({
        partner_id: focusedPartner.id,
        interaction_type: "note",
        subject: noteText.trim().slice(0, 80),
        notes: noteText.trim(),
      });
      if (error) throw error;
      toast.success("Nota salvata");
      setNoteText("");
      setNoteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["partner", focusedPartner.id] });
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      toast.error("Errore salvataggio nota");
    } finally {
      setSavingNote(false);
    }
  }, [noteText, focusedPartner, queryClient]);

  if (!isVisible) return null;

  const btnClass = "h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:bg-violet-500/10 hover:text-foreground";

  return (
    <>
      <div className="px-3 py-1.5 border-b border-violet-500/15 bg-gradient-to-r from-violet-500/[0.06] to-purple-500/[0.04] backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Context label */}
          {isBulk && (
            <span className="text-xs font-semibold text-violet-300 mr-1">{selectedIds.size} sel.</span>
          )}
          {isSingle && (
            <span className="text-xs font-semibold text-violet-300 mr-1 truncate max-w-[140px]">
              {focusedPartner.company_name}
            </span>
          )}

          {/* Attività */}
          <Button size="sm" variant="ghost" onClick={onAssignActivity}
            className={btnClass} disabled={deepSearching}>
            <ClipboardList className="w-3.5 h-3.5" />
            {isBulk ? "Attività Diverse" : "Attività"}
          </Button>

          {/* Deep Search */}
          {!deepSearching && !singleDeepSearching && (
            <div className="relative">
              <Button size="sm" variant="ghost"
                onClick={() => isBulk ? onDeepSearch() : onSingleDeepSearch?.(focusedPartner.id)}
                className={btnClass}>
                <Sparkles className="w-3.5 h-3.5" /> Deep Search
              </Button>
              {needsEnrichment && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border border-background" />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">Alias o enrichment mancante — Deep Search consigliata</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {/* Deep Search progress */}
          {(deepSearching || singleDeepSearching) && (
            <>
              <span className="text-[11px] flex items-center gap-1 text-violet-300">
                <Loader2 className="w-3 h-3 animate-spin" />
                {deepSearchProgress ? `${deepSearchProgress.current}/${deepSearchProgress.total}` : "..."}
              </span>
              {deepSearching && (
                <Button size="sm" variant="ghost" onClick={onStopDeepSearch}
                  className="h-6 px-2 text-[11px] gap-1 text-destructive hover:bg-destructive/15">
                  <Square className="w-2.5 h-2.5 fill-current" /> Stop
                </Button>
              )}
            </>
          )}

          {/* Cockpit */}
          {onSendToCockpit && (
            <Button size="sm" variant="ghost"
              onClick={onSendToCockpit}
              className={btnClass} disabled={deepSearching || sendingToCockpit}>
              {sendingToCockpit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Inbox className="w-3.5 h-3.5" />}
              Cockpit
            </Button>
          )}

          {/* Workspace */}
          <Button size="sm" variant="ghost"
            onClick={() => isBulk ? onSendToWorkspace() : onSendToWorkspace()}
            className={btnClass} disabled={deepSearching || sendingToWorkspace}>
            {sendingToWorkspace ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
            Workspace
          </Button>

          {/* Email */}
          <Button size="sm" variant="ghost" onClick={onEmail}
            className={btnClass} disabled={deepSearching}>
            <Send className="w-3.5 h-3.5" /> Email
          </Button>

          {/* Note — solo singolo */}
          {isSingle && (
            <Button size="sm" variant="ghost" onClick={() => setNoteDialogOpen(true)}
              className={btnClass}>
              <StickyNote className="w-3.5 h-3.5" /> Note
            </Button>
          )}

          {/* Clear — solo bulk */}
          {isBulk && (
            <button onClick={onClearSelection}
              className="ml-auto hover:bg-violet-500/20 rounded-full p-0.5 transition-colors text-violet-400"
              disabled={deepSearching}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-violet-500/20">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-violet-400" />
              Nota — {focusedPartner?.company_name}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Scrivi una nota su questo partner..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="min-h-[80px] bg-card/60 border-violet-500/10 text-sm"
            rows={3}
          />
          <DialogFooter>
            <Button size="sm" onClick={handleSaveNote} disabled={savingNote || !noteText.trim()}
              className="h-8 px-4 text-xs gap-1.5">
              {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Salva Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
