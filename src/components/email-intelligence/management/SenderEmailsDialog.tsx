/**
 * SenderEmailsDialog — Shows emails from a specific sender in sequence
 */
import { useState, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Calendar, ArrowRight, ArrowLeft, User, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useEmailMessageContent } from "@/hooks/useEmailMessageContent";
import { normalizeEmailContent } from "@/components/outreach/email/emailContentNormalization";
import { EmailHtmlFrame } from "@/components/outreach/email/EmailHtmlFrame";

interface SenderEmail {
  id: string;
  subject: string | null;
  email_date: string | null;
  direction: string;
  from_address: string | null;
  to_address: string | null;
  body_text?: string | null;
  body_html?: string | null;
}

interface SenderEmailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailAddress: string;
  companyName: string;
}

export function SenderEmailsDialog({ open, onOpenChange, emailAddress, companyName }: SenderEmailsDialogProps) {
  const [emails, setEmails] = useState<SenderEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!open || !emailAddress) return;
    setSelectedIdx(0);
    void loadEmails();
  }, [open, emailAddress]);

  const fetchAllSenderEmails = async (): Promise<SenderEmail[]> => {
    const PAGE_SIZE = 1000;
    const allEmails: SenderEmail[] = [];
    let from = 0;
    let done = false;

    while (!done) {
      const { data, error } = await supabase
        .from("channel_messages")
        .select("id, subject, email_date, direction, from_address, to_address")
        .eq("channel", "email")
        .or(`from_address.ilike.%${emailAddress}%,to_address.ilike.%${emailAddress}%`)
        .order("email_date", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      const batch = (data as SenderEmail[]) || [];
      allEmails.push(...batch);

      if (batch.length < PAGE_SIZE) done = true;
      else from += PAGE_SIZE;
    }

    return allEmails;
  };

  const loadEmails = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await fetchAllSenderEmails();
      setEmails(data);
    } catch {
      setEmails([]);
    } finally {
      setIsLoading(false);
    }
  };

  const current = emails[selectedIdx] ?? null;
  const {
    bodyHtml,
    bodyText,
    isLoading: isContentLoading,
    isError: isContentError,
  } = useEmailMessageContent(current?.id ?? null, {
    bodyHtml: current?.body_html,
    bodyText: current?.body_text,
  });

  const normalizedContent = useMemo(
    () => normalizeEmailContent({ bodyHtml, bodyText }),
    [bodyHtml, bodyText],
  );

  const sanitizedHtml = useMemo(() => {
    if (!normalizedContent.bodyHtml) return null;

    return DOMPurify.sanitize(normalizedContent.bodyHtml, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["style", "center"],
      ADD_ATTR: [
        "target",
        "style",
        "class",
        "bgcolor",
        "background",
        "align",
        "valign",
        "width",
        "height",
        "cellpadding",
        "cellspacing",
        "border",
        "color",
        "face",
        "size",
      ],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ["script", "form", "input", "textarea", "select", "button"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur"],
    });
  }, [normalizedContent.bodyHtml]);

  const hasContent = Boolean(normalizedContent.bodyHtml || normalizedContent.bodyText);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email di {companyName}
            <Badge variant="secondary" className="ml-2">{emailAddress}</Badge>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : emails.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground text-sm">Nessuna email trovata</p>
        ) : (
          <div className="flex flex-1 gap-3 min-h-0">
            <ScrollArea className="w-[220px] shrink-0 border rounded-md">
              <div className="p-1 space-y-0.5">
                {emails.map((em, idx) => (
                  <button
                    key={em.id}
                    onClick={() => setSelectedIdx(idx)}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors",
                      idx === selectedIdx
                        ? "bg-primary/15 text-primary border border-primary/20"
                        : "hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {em.direction === "inbound" ? (
                        <ArrowLeft className="h-3 w-3 text-primary shrink-0" />
                      ) : (
                        <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                      )}
                      <span className="truncate font-medium leading-tight">
                        {em.subject || "(senza oggetto)"}
                      </span>
                    </div>
                    {em.email_date && (
                      <span className="text-[10px] text-muted-foreground/60 pl-[18px]">
                        {new Date(em.email_date).toLocaleDateString("it-IT", {
                          day: "2-digit", month: "short", year: "2-digit"
                        })}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>

            {current && (
              <div className="flex-1 flex flex-col min-w-0 border rounded-md overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/20 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] gap-1 text-primary border-primary/20">
                      {current.direction === "inbound" ? <ArrowLeft className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                      {current.direction === "inbound" ? "Ricevuta" : "Inviata"}
                    </Badge>
                    {current.email_date && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(current.email_date).toLocaleString("it-IT", {
                          day: "2-digit", month: "long", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      {selectedIdx + 1}/{emails.length}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-primary leading-snug">
                    {current.subject || "(senza oggetto)"}
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] flex-wrap">
                    <span className="flex items-center gap-1 text-primary">
                      <User className="h-3 w-3" />
                      <span className="font-medium">Da:</span>
                      <span className="text-foreground/80">{current.from_address || "—"}</span>
                    </span>
                    <span className="text-muted-foreground/40">→</span>
                    <span className="text-muted-foreground">
                      <span className="font-medium">A:</span>{" "}
                      <span className="text-foreground/70">{current.to_address || "—"}</span>
                    </span>
                  </div>
                </div>

                <ScrollArea className="flex-1 min-h-0">
                  <div className="space-y-4 p-4">
                    {isContentError && (
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
                        Contenuto caricato in modo parziale: sto mostrando la versione disponibile.
                      </div>
                    )}

                    {isContentLoading && !hasContent ? (
                      <div className="flex h-40 items-center justify-center rounded-md border border-border bg-background">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : sanitizedHtml ? (
                      <EmailHtmlFrame html={sanitizedHtml} mode="safe" blockRemote={false} />
                    ) : normalizedContent.bodyText ? (
                      <div className="rounded-md border border-border bg-background p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {normalizedContent.bodyText}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">(contenuto non disponibile)</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
