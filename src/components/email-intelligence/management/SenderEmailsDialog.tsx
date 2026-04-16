/**
 * SenderEmailsDialog — Shows emails from a specific sender in sequence
 */
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Calendar, ArrowRight, ArrowLeft, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";

interface SenderEmail {
  id: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  email_date: string | null;
  direction: string;
  from_address: string | null;
  to_address: string | null;
}

interface SenderEmailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailAddress: string;
  companyName: string;
}

/** Strip common email noise from plain text */
function cleanPlainText(raw: string): string {
  let text = raw;
  // Remove base64 / encoded blocks
  text = text.replace(/^[A-Za-z0-9+/=]{60,}$/gm, "");
  // Remove MIME headers
  text = text.replace(/^(Content-Type|Content-Transfer-Encoding|MIME-Version|X-\S+):.*$/gim, "");
  // Remove boundary markers
  text = text.replace(/^--[\w=+/.-]+--?$/gm, "");
  // Collapse excessive blank lines
  text = text.replace(/\n{4,}/g, "\n\n\n");
  // Trim leading/trailing whitespace
  return text.trim();
}

/** Sanitize HTML for safe rendering */
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "div", "span", "a", "b", "strong", "i", "em", "u",
      "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
      "table", "thead", "tbody", "tr", "td", "th",
      "blockquote", "pre", "code", "hr", "img", "sup", "sub",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "width", "height", "style", "class"],
    ALLOW_DATA_ATTR: false,
  });
}

export function SenderEmailsDialog({ open, onOpenChange, emailAddress, companyName }: SenderEmailsDialogProps) {
  const [emails, setEmails] = useState<SenderEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!open || !emailAddress) return;
    setSelectedIdx(0);
    loadEmails();
  }, [open, emailAddress]);

  const fetchAllSenderEmails = async (): Promise<SenderEmail[]> => {
    const PAGE_SIZE = 1000;
    const allEmails: SenderEmail[] = [];
    let from = 0;
    let done = false;

    while (!done) {
      const { data, error } = await supabase
        .from("channel_messages")
        .select("id, subject, body_text, body_html, email_date, direction, from_address, to_address")
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

  const current = emails[selectedIdx];

  const renderedBody = useMemo(() => {
    if (!current) return null;
    if (current.body_html) {
      return { type: "html" as const, content: sanitizeHtml(current.body_html) };
    }
    if (current.body_text) {
      return { type: "text" as const, content: cleanPlainText(current.body_text) };
    }
    return null;
  }, [current]);

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
            {/* Email list sidebar */}
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
                        <ArrowLeft className="h-3 w-3 text-sky-400 shrink-0" />
                      ) : (
                        <ArrowRight className="h-3 w-3 text-emerald-400 shrink-0" />
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

            {/* Email detail */}
            {current && (
              <div className="flex-1 flex flex-col min-w-0 border rounded-md overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b bg-muted/20 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {current.direction === "inbound" ? (
                      <Badge className="text-[10px] gap-1 bg-sky-500/15 text-sky-400 border-sky-500/20 hover:bg-sky-500/20">
                        <ArrowLeft className="h-3 w-3" /> Ricevuta
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                        <ArrowRight className="h-3 w-3" /> Inviata
                      </Badge>
                    )}
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
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-sky-400">
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

                {/* Body */}
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {!renderedBody ? (
                      <p className="text-sm text-muted-foreground italic">
                        (contenuto non disponibile)
                      </p>
                    ) : renderedBody.type === "html" ? (
                      <div
                        className="email-body-render text-sm leading-relaxed text-foreground/90 max-w-none"
                        dangerouslySetInnerHTML={{ __html: renderedBody.content }}
                      />
                    ) : (
                      <div className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap font-sans">
                        {renderedBody.content}
                      </div>
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