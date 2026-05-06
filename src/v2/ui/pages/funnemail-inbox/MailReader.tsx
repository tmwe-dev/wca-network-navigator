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
import { Button } from "@/components/ui/button";
import { Sparkles, Building2, RefreshCw, Brain, Zap } from "lucide-react";
import type { FunnemailFolder, FunnemailMailRow, SenderIntelRow } from "@/data/funnemailInbox";
import { getSenderIntelByDomain } from "@/data/funnemailInbox";
import { fetchContentIntelligence, type EmailContentIntelligenceRow } from "@/data/emailContentIntelligence";

interface Props {
  mail: FunnemailMailRow | null;
  folders: FunnemailFolder[];
  onOverrideFolder: (messageId: string, newSlug: string) => void;
  onReclassify?: (messageId: string) => void;
  reclassifying?: boolean;
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

export function MailReader({ mail, folders, onOverrideFolder, onReclassify, reclassifying }: Props): React.ReactElement {
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

  // Scout intel per il dominio mittente (lazy)
  const [intel, setIntel] = React.useState<SenderIntelRow | null>(null);
  // Content Intelligence (Strato 2): intent + business value + azioni suggerite.
  const [ci, setCi] = React.useState<EmailContentIntelligenceRow | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    setIntel(null);
    const addr = mail.from_address?.toLowerCase() ?? "";
    const m = addr.match(/@([a-z0-9.-]+\.[a-z]{2,})$/);
    if (!m) return;
    getSenderIntelByDomain(m[1]).then((x) => { if (!cancelled) setIntel(x); }).catch(() => {});
    return () => { cancelled = true; };
  }, [mail.from_address, mail.message_id]);

  React.useEffect(() => {
    let cancelled = false;
    setCi(null);
    fetchContentIntelligence(mail.message_id)
      .then((row) => { if (!cancelled) setCi(row); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [mail.message_id]);

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
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wide">Funnemail</h4>
                </div>
                {onReclassify && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1"
                    disabled={reclassifying}
                    onClick={() => onReclassify(mail.message_id)}
                    title="Forza riclassificazione AI"
                  >
                    <RefreshCw className={`h-3 w-3 ${reclassifying ? "animate-spin" : ""}`} />
                    Riclassifica
                  </Button>
                )}
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
                <Building2 className="h-3.5 w-3.5 text-success" />
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

            {/* Content Intelligence — Strato 2 */}
            <div className="pt-3 border-t border-border/40">
              <div className="flex items-center gap-1.5 mb-2">
                <Brain className="h-3.5 w-3.5 text-violet-600" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Lettura contenuto</h4>
              </div>
              {!ci && (
                <p className="text-xs text-muted-foreground">In attesa di analisi…</p>
              )}
              {ci && (
                <div className="space-y-1.5 text-xs">
                  {ci.content_label && (
                    <Field label="Tipo">
                      <Badge variant="secondary" className="text-[10px]">{ci.content_label}</Badge>
                    </Field>
                  )}
                  {ci.intent_summary && (
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground mt-1 mb-1">Intento</div>
                      <p className="text-xs text-foreground/90">{ci.intent_summary}</p>
                    </div>
                  )}
                  {ci.business_value && (
                    <Field label="Valore">
                      <span className="text-foreground/80">{ci.business_value}</span>
                    </Field>
                  )}
                  {ci.urgency && (
                    <Field label="Urgenza">
                      <Badge variant="outline" className="text-[10px]">{URGENCY_LABEL[ci.urgency] ?? ci.urgency}</Badge>
                    </Field>
                  )}
                  {ci.target_role && (
                    <Field label="Per">
                      <span className="text-foreground/80">{ci.target_role}</span>
                    </Field>
                  )}
                  <Field label="Confidenza">
                    <span className="tabular-nums">{Math.round((ci.confidence ?? 0) * 100)}%</span>
                  </Field>
                  {Array.isArray(ci.suggested_actions) && ci.suggested_actions.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground mt-2 mb-1 flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Azioni suggerite
                      </div>
                      <ul className="space-y-1">
                        {ci.suggested_actions.map((a, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs">
                            <span className="text-violet-600 mt-0.5">•</span>
                            <span className="text-foreground/85">
                              <span className="font-medium">{a.label ?? a.title ?? a.type}</span>
                              {a.reason && <span className="text-muted-foreground"> — {a.reason}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {ci.pending_action_ids && ci.pending_action_ids.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1.5 italic">
                          {ci.pending_action_ids.length} azione/i materializzate in coda approvazioni.
                        </p>
                      )}
                    </div>
                  )}
                  {ci.reasoning && (
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground mt-2 mb-1">Ragionamento</div>
                      <p className="text-xs text-foreground/70 italic">"{ci.reasoning}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Scout intel mittente */}
            <div className="pt-3 border-t border-border/40">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-warning" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Scout mittente</h4>
              </div>
              {!intel && (
                <p className="text-xs text-muted-foreground">In attesa di analisi…</p>
              )}
              {intel && (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant={intel.is_known_partner ? "default" : "outline"} className="text-[10px]">
                      {intel.is_known_partner ? "Mittente noto (CRM)" : "Mittente sconosciuto"}
                    </Badge>
                  </div>
                  <Field label="Tipo">{intel.company_type ?? "—"}</Field>
                  <Field label="Ruolo">{intel.role_guess ?? "—"}</Field>
                  <Field label="Paese">{intel.country ?? "—"}</Field>
                  {intel.website && (
                    <Field label="Sito">
                      <a href={intel.website} target="_blank" rel="noreferrer" className="text-primary underline truncate">
                        {intel.website}
                      </a>
                    </Field>
                  )}
                </div>
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