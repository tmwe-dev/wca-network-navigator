/**
 * SenderEmailPreviewPanel — pannello inline 35% sinistra dell'area inferiore.
 *
 * Mostra le ultime 20 email del sender selezionato con:
 *  • lista compatta: direzione + canale + subject + data + anteprima 1 riga
 *  • dettaglio in basso: from/to + badge canale/direzione + corpo 6 righe
 */
import { useState, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  ChevronLeft, ChevronRight, Mail, Loader2,
  ArrowDownLeft, ArrowUpRight, MessageCircle, Linkedin,
  ListCollapse, ListTree,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useEmailMessageContent } from "@/hooks/useEmailMessageContent";
import { normalizeEmailContent } from "@/components/outreach/email/emailContentNormalization";
import { EmailHtmlFrame } from "@/components/outreach/email/EmailHtmlFrame";

interface PreviewEmail {
  id: string;
  subject: string | null;
  email_date: string | null;
  direction: string;
  channel: string | null;
  from_address: string | null;
  to_address: string | null;
  body_text: string | null;
  body_html: string | null;
}

interface SenderEmailPreviewPanelProps {
  senderEmail: string | null;
  companyName: string | null;
}

const PAGE_SIZE = 20;

function ChannelIcon({ channel, className }: { channel: string | null; className?: string }) {
  if (channel === "whatsapp") return <MessageCircle className={cn("text-primary", className)} />;
  if (channel === "linkedin") return <Linkedin className={cn("text-primary", className)} />;
  return <Mail className={cn("text-primary", className)} />;
}

/**
 * EmailBody — rendering identico a Outreach/EmailDetailView:
 * normalizza HTML/text, sanitizza con DOMPurify e usa EmailHtmlFrame
 * per visualizzare la mail così com'è arrivata.
 */
function EmailBody({ message, compact = false }: { message: PreviewEmail; compact?: boolean }) {
  const { bodyHtml, bodyText, isLoading } = useEmailMessageContent(message.id, {
    bodyHtml: message.body_html,
    bodyText: message.body_text,
  });
  const normalized = useMemo(
    () => normalizeEmailContent({ bodyHtml, bodyText }),
    [bodyHtml, bodyText],
  );
  const sanitizedHtml = useMemo(() => {
    if (!normalized.bodyHtml) return null;
    return DOMPurify.sanitize(normalized.bodyHtml, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["style", "center"],
      ADD_ATTR: ["target", "style", "class", "bgcolor", "background", "align", "valign", "width", "height", "cellpadding", "cellspacing", "border", "color", "face", "size"],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ["script", "form", "input", "textarea", "select", "button"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur"],
    });
  }, [normalized.bodyHtml]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (sanitizedHtml) {
    return (
      <div className={cn("min-h-[120px]", compact ? "text-xs" : "text-sm")}>
        <EmailHtmlFrame html={sanitizedHtml} mode="safe" blockRemote={false} />
      </div>
    );
  }
  if (normalized.bodyText) {
    return (
      <pre
        className={cn(
          "leading-relaxed whitespace-pre-wrap break-words font-sans text-foreground/90",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {normalized.bodyText}
      </pre>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">(corpo email non disponibile)</p>
  );
}

export function SenderEmailPreviewPanel({ senderEmail, companyName }: SenderEmailPreviewPanelProps) {
  const [emails, setEmails] = useState<PreviewEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  /** Quando valorizzato, apre il dialog full-page con questa email. */
  const [fullViewEmail, setFullViewEmail] = useState<PreviewEmail | null>(null);
  /** Mostra/nasconde l'elenco delle email. Per default è nascosto:
   *  l'utente naviga con i chevron sopra il preview e l'apertura dell'elenco
   *  è on-demand tramite l'icona dedicata. */
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (!senderEmail) {
      setEmails([]);
      setSelectedIdx(0);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("channel_messages")
          .select("id, subject, email_date, direction, channel, from_address, to_address, body_text, body_html")
          .eq("channel", "email")
          .or(`from_address.ilike.%${senderEmail}%,to_address.ilike.%${senderEmail}%`)
          .order("email_date", { ascending: false })
          .limit(PAGE_SIZE);
        if (cancelled) return;
        if (error) {
          setEmails([]);
        } else {
          setEmails((data ?? []) as PreviewEmail[]);
          setSelectedIdx(0);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [senderEmail]);

  const current = emails[selectedIdx] ?? null;

  if (!senderEmail) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground p-4">
        Seleziona un mittente per vedere le sue email
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-xs font-semibold truncate">
            Email da {companyName || senderEmail}
          </span>
        </div>
        {emails.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" variant={showList ? "secondary" : "ghost"} className="h-6 w-6"
                    onClick={() => setShowList((v) => !v)}
                    aria-label={showList ? "Nascondi elenco email" : "Mostra elenco email"}
                    aria-pressed={showList}
                  >
                    {showList ? (
                      <ListCollapse className="h-3.5 w-3.5" />
                    ) : (
                      <ListTree className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">
                  {showList ? "Nascondi elenco" : "Mostra elenco email"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              size="icon" variant="ghost" className="h-6 w-6"
              disabled={selectedIdx === 0}
              onClick={() => setSelectedIdx((i) => Math.max(0, i - 1))}
              aria-label="Email precedente"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Badge variant="outline" className="text-[10px]">
              {selectedIdx + 1}/{emails.length}
            </Badge>
            <Button
              size="icon" variant="ghost" className="h-6 w-6"
              disabled={selectedIdx >= emails.length - 1}
              onClick={() => setSelectedIdx((i) => Math.min(emails.length - 1, i + 1))}
              aria-label="Email successiva"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : emails.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground p-4 text-center">
          Nessuna email trovata per questo mittente
        </div>
      ) : showList ? (
        <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={45} minSize={15}>
            <ScrollArea className="h-full">
            <div className="p-1.5 space-y-1">
              {emails.map((em, idx) => {
                const bodyPreview = (em.body_text ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
                return (
                  <button
                    key={em.id}
                    onClick={() => setSelectedIdx(idx)}
                    onDoubleClick={() => setFullViewEmail(em)}
                    title="Doppio clic per aprire a tutta pagina"
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
                      idx === selectedIdx
                        ? "bg-primary/15 border border-primary/20"
                        : "hover:bg-muted/40 border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {em.direction === "inbound" ? (
                        <ArrowDownLeft className="h-3 w-3 text-primary flex-shrink-0" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                      <ChannelIcon channel={em.channel} className="h-3 w-3 flex-shrink-0" />
                      <span className="font-semibold truncate flex-1">
                        {em.subject || "(senza oggetto)"}
                      </span>
                      {em.email_date && (
                        <span className="text-[9px] text-muted-foreground flex-shrink-0">
                          {new Date(em.email_date).toLocaleDateString("it-IT", {
                            day: "2-digit", month: "short",
                          })}
                        </span>
                      )}
                    </div>
                    {bodyPreview && (
                      <div className="text-[10px] text-muted-foreground line-clamp-1 pl-[18px]">
                        {bodyPreview}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            </ScrollArea>
          </ResizablePanel>

          {current && <ResizableHandle withHandle />}

          {/* Pannello dettaglio email selezionata — ridimensionabile verticalmente */}
          {current && (
            <ResizablePanel defaultSize={55} minSize={15}>
              <EmailDetail current={current} />
            </ResizablePanel>
          )}
        </ResizablePanelGroup>
      ) : (
        /* Modalità default: solo il preview, a tutta altezza. */
        current ? (
          <div className="flex-1 min-h-0">
            <EmailDetail current={current} />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground p-4 text-center">
            Nessuna email da mostrare
          </div>
        )
      )}

      {/* Dialog full-page email */}
      <Dialog open={fullViewEmail !== null} onOpenChange={(o) => { if (!o) setFullViewEmail(null); }}>
        <DialogContent className="max-w-4xl w-[92vw] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-3 border-b flex-shrink-0">
            <DialogTitle className="text-base flex items-center gap-2 pr-8">
              {fullViewEmail && <ChannelIcon channel={fullViewEmail.channel} className="h-4 w-4 flex-shrink-0" />}
              <span className="truncate">{fullViewEmail?.subject || "(senza oggetto)"}</span>
            </DialogTitle>
          </DialogHeader>

          {fullViewEmail && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="px-5 py-3 space-y-3">
                {/* Meta */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <ChannelIcon channel={fullViewEmail.channel} className="h-2.5 w-2.5" />
                    {fullViewEmail.channel || "email"}
                  </Badge>
                  <Badge
                    variant={fullViewEmail.direction === "inbound" ? "default" : "secondary"}
                    className="gap-1 text-[10px]"
                  >
                    {fullViewEmail.direction === "inbound" ? (
                      <ArrowDownLeft className="h-2.5 w-2.5" />
                    ) : (
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    )}
                    {fullViewEmail.direction === "inbound" ? "ricevuta" : "inviata"}
                  </Badge>
                  {fullViewEmail.email_date && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(fullViewEmail.email_date).toLocaleString("it-IT", {
                        day: "2-digit", month: "long", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>

                {/* From / To */}
                <div className="text-xs space-y-1 border rounded-md p-3 bg-muted/20">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground font-medium w-10 flex-shrink-0">Da:</span>
                    <span className="text-foreground break-all">{fullViewEmail.from_address || "—"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground font-medium w-10 flex-shrink-0">A:</span>
                    <span className="text-foreground break-all">{fullViewEmail.to_address || "—"}</span>
                  </div>
                </div>

                {/* Corpo full — stesso renderer di Outreach. */}
                <div className="pt-1">
                  <EmailBody message={fullViewEmail} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * EmailDetail — riquadro dettaglio della mail selezionata. Estratto come
 * componente per riusarlo sia nella modalità "solo preview" sia nella
 * modalità "elenco + preview".
 */
function EmailDetail({ current }: { current: PreviewEmail }) {
  return (
    <div className="h-full overflow-y-auto bg-muted/10">
      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="gap-1 text-[10px] py-0 h-5">
            <ChannelIcon channel={current.channel} className="h-2.5 w-2.5" />
            {current.channel || "email"}
          </Badge>
          <Badge
            variant={current.direction === "inbound" ? "default" : "secondary"}
            className="gap-1 text-[10px] py-0 h-5"
          >
            {current.direction === "inbound" ? (
              <ArrowDownLeft className="h-2.5 w-2.5" />
            ) : (
              <ArrowUpRight className="h-2.5 w-2.5" />
            )}
            {current.direction === "inbound" ? "ricevuta" : "inviata"}
          </Badge>
          {current.email_date && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {new Date(current.email_date).toLocaleString("it-IT", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
          )}
        </div>

        <div className="text-[10px] space-y-0.5">
          <div className="flex gap-1">
            <span className="text-muted-foreground font-medium w-8 flex-shrink-0">Da:</span>
            <span className="truncate text-foreground">{current.from_address || "—"}</span>
          </div>
          <div className="flex gap-1">
            <span className="text-muted-foreground font-medium w-8 flex-shrink-0">A:</span>
            <span className="truncate text-foreground">{current.to_address || "—"}</span>
          </div>
        </div>

        {current.subject && (
          <div className="text-xs font-semibold text-foreground pt-1 border-t">
            {current.subject}
          </div>
        )}

        <div className="pt-1">
          <EmailBody message={current} compact />
        </div>
      </div>
    </div>
  );
}
