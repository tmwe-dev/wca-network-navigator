/**
 * MailReader — pannello destro: lettura email + scheda decisioni Funnemail.
 *
 * Mostra anteprima testo pulita, scheda decisione AI con possibilità di
 * override cartella, e (se applicabile) badge handoff commerciale.
 */
import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Building2 } from "lucide-react";
import type { FunnemailFolder, FunnemailMailRow } from "@/data/funnemailInbox";

interface Props {
  mail: FunnemailMailRow | null;
  folders: FunnemailFolder[];
  onOverrideFolder: (messageId: string, newSlug: string) => void;
}

/** Pulizia rapida del corpo: strip HTML grossolano + collapse whitespace. */
function cleanBody(html: string | null, text: string | null): string {
  if (text && text.trim().length > 0) return text.replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
  if (!html) return "";
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 4000);
}

const URGENCY_LABEL: Record<string, string> = {
  critical: "Critica",
  high: "Alta",
  normal: "Normale",
  low: "Bassa",
};

const ACTION_LABEL: Record<string, string> = {
  none: "Nessuna azione",
  archive: "Archivia",
  draft_reply: "Prepara bozza di risposta",
  forward: "Inoltra",
  escalate: "Escala a senior",
  notify_human: "Solo notifica",
};

export function MailReader({ mail, folders, onOverrideFolder }: Props): React.ReactElement {
  if (!mail) {
    return (
      <section className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Seleziona una mail per leggerla
      </section>
    );
  }

  const body = React.useMemo(() => cleanBody(mail.body_html, mail.body_text), [mail.body_html, mail.body_text]);
  const decision = mail.decision;
  const currentFolder = decision?.override_folder_slug ?? decision?.folder_slug ?? "to_sort";

  return (
    <section className="flex-1 flex flex-col h-full min-w-0">
      {/* Header */}
      <header className="px-5 py-3 border-b border-border/40 flex-shrink-0">
        <h2 className="text-base font-semibold mb-1">{mail.subject || "(senza oggetto)"}</h2>
        <div className="text-xs text-muted-foreground">Da: {mail.from_address ?? "—"}</div>
        {mail.email_date && (
          <div className="text-[11px] text-muted-foreground">
            {new Date(mail.email_date).toLocaleString("it-IT")}
          </div>
        )}
      </header>

      {/* Body + decision side-by-side */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-0 min-h-0 overflow-hidden">
        <ScrollArea className="border-r border-border/40">
          <pre className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground">
            {body || "(corpo vuoto)"}
          </pre>
        </ScrollArea>

        <ScrollArea className="bg-muted/20">
          <div className="p-4 space-y-4">
            {/* Funnemail decision */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Funnemail</h4>
              </div>
              {!decision && (
                <div className="text-xs text-muted-foreground">Nessuna decisione registrata</div>
              )}
              {decision && (
                <div className="space-y-2 text-xs">
                  <Field label="Cartella">
                    <Select value={currentFolder} onValueChange={(v) => onOverrideFolder(mail.message_id, v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {folders.map((f) => (
                          <SelectItem key={f.slug} value={f.slug} className="text-xs">
                            {f.icon} {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Azione consigliata">
                    <span>{ACTION_LABEL[decision.suggested_action] ?? decision.suggested_action}</span>
                  </Field>
                  <Field label="Urgenza">
                    <Badge variant="outline" className="text-[10px]">
                      {URGENCY_LABEL[decision.urgency] ?? decision.urgency}
                    </Badge>
                  </Field>
                  <Field label="Confidenza">
                    <span className="tabular-nums">{Math.round(decision.confidence * 100)}%</span>
                  </Field>
                  <Field label="In agenda">
                    <span>{decision.goes_to_agenda ? "Sì" : "No"}</span>
                  </Field>
                  {decision.reasoning && (
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground mt-2 mb-1">Perché</div>
                      <p className="text-xs text-foreground/80 italic">"{decision.reasoning}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Commercial */}
            <div className="pt-3 border-t border-border/40">
              <div className="flex items-center gap-1.5 mb-2">
                <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Commerciale</h4>
              </div>
              {decision?.commercial_handoff ? (
                <p className="text-xs text-foreground/80">
                  Funnemail ha segnalato questa email al cervello commerciale.
                  Il lead verrà valutato per ingresso/aggiornamento del circuito di attesa.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Nessun handoff commerciale richiesto.</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-2">
      <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}