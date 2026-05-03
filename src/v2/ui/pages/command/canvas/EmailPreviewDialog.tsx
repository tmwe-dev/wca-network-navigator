/**
 * EmailPreviewDialog — anteprima read-only dell'email come arriverà al destinatario.
 * Pure UI: nessuna chiamata di invio, nessuna mutazione. Sanitizza l'HTML lato client.
 */
import { useMemo, useState } from "react";
import DOMPurify from "dompurify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Code2, Eye } from "lucide-react";

interface EmailPreviewDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly recipients: ReadonlyArray<{ readonly email: string; readonly name?: string }>;
  readonly subject: string;
  readonly body: string;
}

export default function EmailPreviewDialog({
  open, onOpenChange, recipients, subject, body,
}: EmailPreviewDialogProps) {
  const [showRaw, setShowRaw] = useState(false);

  const safeHtml = useMemo(
    () =>
      DOMPurify.sanitize(body || "<em>(corpo vuoto)</em>", {
        ALLOWED_TAGS: ["br", "p", "b", "i", "strong", "em", "a", "ul", "ol", "li", "h1", "h2", "h3", "span", "div"],
        ALLOWED_ATTR: ["href", "target", "rel", "style"],
      }),
    [body],
  );

  const toLine = recipients.length > 0
    ? recipients.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)).join(", ")
    : "(nessun destinatario)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4" /> Anteprima email
          </DialogTitle>
          <DialogDescription className="text-xs">
            Così la riceverà il destinatario. Firma e footer vengono aggiunti automaticamente al momento dell'invio (server-side).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-lg border border-border bg-background">
          {/* Header simulato */}
          <div className="border-b border-border px-4 py-3 text-xs space-y-1 bg-muted/30">
            <div><span className="text-muted-foreground">A:</span> <span className="text-foreground">{toLine}</span></div>
            <div><span className="text-muted-foreground">Oggetto:</span> <span className="text-foreground font-medium">{subject || "(senza oggetto)"}</span></div>
          </div>

          {/* Body */}
          <div className="p-5">
            {showRaw ? (
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-foreground/80">
                {body}
              </pre>
            ) : (
              <div
                className="prose prose-sm max-w-none text-foreground [&_p]:my-2 [&_a]:text-primary"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: safeHtml }}
              />
            )}

            <div className="mt-6 pt-4 border-t border-dashed border-border/60 text-[11px] text-muted-foreground italic">
              ✱ Firma agente e footer aziendale aggiunti automaticamente all'invio.
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRaw((v) => !v)}
            className="text-xs"
          >
            <Code2 className="w-3.5 h-3.5 mr-1.5" />
            {showRaw ? "Vista renderizzata" : "Vista HTML grezzo"}
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>Chiudi</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}