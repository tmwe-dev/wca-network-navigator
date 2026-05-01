/**
 * EmailPreviewPane — Pannello laterale che mostra l'anteprima completa di una
 * email in coda/inviata: oggetto, corpo, destinatario, sorgente, prossimi step
 * e azioni (autorizza, riprogramma, annulla).
 */
import { useState } from "react";
import { Mail, Calendar as CalendarIcon, X, Send, Edit3, AlertTriangle, RotateCcw, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sanitizeHtml } from "@/lib/security/htmlSanitizer";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export interface EmailPreviewItem {
  readonly id: string;
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly companyName?: string | null;
  readonly subject: string;
  readonly htmlBody: string;
  readonly sourceLabel: string;            // "Bozza AI", "Campagna", "Step 2/5 sequenza Primo Contatto WCA"
  readonly sourceTone?: "primary" | "blue" | "amber" | "purple" | "muted";
  readonly scheduledAt?: string | null;
  readonly errorMessage?: string | null;
  readonly readonly?: boolean;             // true per Inviati
}

interface EmailPreviewPaneProps {
  readonly item: EmailPreviewItem | null;
  readonly onClose: () => void;
  readonly onAuthorize?: (id: string) => void;
  readonly onCancel?: (id: string) => void;
  readonly onReschedule?: (id: string, date: Date) => void;
  readonly onEdit?: (id: string) => void;
  readonly onRetry?: (id: string) => void;
}

const TONE_CLASS: Record<NonNullable<EmailPreviewItem["sourceTone"]>, string> = {
  primary: "bg-primary/15 text-primary border-primary/30",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  amber: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  muted: "bg-muted text-muted-foreground border-border",
};

export function EmailPreviewPane({ item, onClose, onAuthorize, onCancel, onReschedule, onEdit, onRetry }: EmailPreviewPaneProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 text-muted-foreground bg-muted/5 border-l border-border/30">
        <Mail className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium">Seleziona un messaggio</p>
        <p className="text-xs mt-1">Clicca una riga a sinistra per vedere oggetto, corpo, sorgente e bottoni di azione.</p>
      </div>
    );
  }

  const tone = TONE_CLASS[item.sourceTone ?? "muted"];

  return (
    <div className="h-full flex flex-col border-l border-border/30 bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{item.recipientName || "—"}</span>
            {item.companyName && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Building2 className="w-2.5 h-2.5" /> {item.companyName}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{item.recipientEmail}</p>
        </div>
        <Button size="icon" variant="ghost" aria-label="Chiudi" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Source + scheduled */}
      <div className="shrink-0 px-4 py-2 border-b border-border/30 flex items-center gap-2 flex-wrap text-[11px]">
        <Badge variant="outline" className={`text-[10px] h-5 ${tone}`}>{item.sourceLabel}</Badge>
        {item.scheduledAt && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CalendarIcon className="w-3 h-3" />
            Pianificata: {format(new Date(item.scheduledAt), "dd MMM yyyy HH:mm", { locale: it })}
          </span>
        )}
        {item.errorMessage && (
          <span className="inline-flex items-center gap-1 text-destructive">
            <AlertTriangle className="w-3 h-3" /> {item.errorMessage}
          </span>
        )}
      </div>

      {/* Subject + body */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Oggetto</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{item.subject || <span className="italic text-muted-foreground">(nessun oggetto)</span>}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide mb-1">Corpo email</p>
            {item.htmlBody ? (
              <div
                className="text-sm border border-border/40 rounded-md p-3 bg-muted/10 prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.htmlBody) }}
              />
            ) : (
              <p className="text-xs italic text-muted-foreground">Corpo non disponibile (la mail verrà composta al momento dell'invio dal template).</p>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      {!item.readonly && (
        <div className="shrink-0 border-t border-border/40 px-4 py-2.5 flex items-center gap-1.5 flex-wrap">
          {onAuthorize && (
            <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => onAuthorize(item.id)}>
              <Send className="w-3 h-3" /> Autorizza invio
            </Button>
          )}
          {onRetry && (
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => onRetry(item.id)}>
              <RotateCcw className="w-3 h-3" /> Riprova
            </Button>
          )}
          {onReschedule && (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                  <CalendarIcon className="w-3 h-3" /> Riprogramma
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  onSelect={(d) => {
                    if (d) {
                      onReschedule(item.id, d);
                      setPickerOpen(false);
                    }
                  }}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}
          {onEdit && (
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => onEdit(item.id)}>
              <Edit3 className="w-3 h-3" /> Modifica
            </Button>
          )}
          {onCancel && (
            <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 text-destructive ml-auto" onClick={() => onCancel(item.id)}>
              <X className="w-3 h-3" /> Annulla
            </Button>
          )}
        </div>
      )}
    </div>
  );
}