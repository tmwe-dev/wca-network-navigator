import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Linkedin, Clock } from "lucide-react";
import { useBulkLinkedInDispatch, type BulkLinkedInTarget } from "@/hooks/useBulkLinkedInDispatch";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: BulkLinkedInTarget[];
}

export default function BulkLinkedInDialog({ open, onOpenChange, targets }: Props) {
  const [message, setMessage] = useState("");
  const { dispatch, sending, progress, timing, previewSchedule } = useBulkLinkedInDispatch();

  const eligible = targets.filter(t => !!t.profileUrl);
  const skipped = targets.length - eligible.length;
  const remaining = 300 - message.length;
  const preview = useMemo(() => previewSchedule(eligible.length), [eligible.length, previewSchedule]);

  const handleSend = async () => {
    const result = await dispatch(targets, message);
    if (result.queued > 0) {
      setMessage("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Linkedin className="w-4 h-4 text-[#0A66C2]" />
            Invio LinkedIn massivo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs space-y-1.5 bg-muted/40 rounded-lg p-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Destinatari validi:</span>
              <span className="font-semibold">{eligible.length}</span>
            </div>
            {skipped > 0 && (
              <div className="flex justify-between text-warning">
                <span>Senza URL LinkedIn (saltati):</span>
                <span className="font-semibold">{skipped}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-border/40">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Finestra:
              </span>
              <span className="font-semibold">{timing.startHour}:00 → {timing.endHour}:00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delay tra invii:</span>
              <span className="font-semibold">{timing.minDelaySeconds}-{timing.maxDelaySeconds}s</span>
            </div>
            {eligible.length > 0 && (
              <div className="flex justify-between text-primary">
                <span>Ultimo invio stimato:</span>
                <span className="font-semibold">{preview.humanLabel}</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Messaggio</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 300))}
              placeholder="Ciao {{name}}, ho visto che lavori in {{company}}..."
              rows={6}
              className="resize-none"
              disabled={sending}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Placeholders: <code>{"{{name}}"}</code>, <code>{"{{company}}"}</code></span>
              <span className={remaining < 30 ? "text-warning" : ""}>{remaining}/300</span>
            </div>
          </div>

          {sending && progress.total > 0 && (
            <div className="text-xs space-y-1 bg-primary/5 rounded-lg p-2">
              <div className="flex justify-between">
                <span>Accodamento {progress.current}/{progress.total}</span>
                <span className="text-success">✓ {progress.queued}</span>
              </div>
              <div className="h-1 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            ⚠️ Timing configurabile in <span className="font-medium">Settings → Connessioni → Timing multichannel</span>.
            L'invio reale avviene tramite la tua estensione browser.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={sending}>
            Annulla
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!message.trim() || sending || eligible.length === 0}
            className="bg-[#0A66C2] hover:bg-[#004182] text-white gap-1.5"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Programma {eligible.length} invii
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
