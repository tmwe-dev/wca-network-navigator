/**
 * SenderEmailPreviewPanel — pannello inline 35% sinistra dell'area inferiore.
 *
 * Mostra le ultime 20 email del sender selezionato (subject, data, preview corpo)
 * con frecce prev/next per scorrere. Riusa il pattern query di SenderEmailsDialog
 * ma in versione compatta (no HTML rendering completo, solo testo).
 */
import { useState, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Mail, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PreviewEmail {
  id: string;
  subject: string | null;
  email_date: string | null;
  direction: string;
  from_address: string | null;
  to_address: string | null;
  body_text: string | null;
}

interface SenderEmailPreviewPanelProps {
  /** Email del sender selezionato (null = niente da mostrare) */
  senderEmail: string | null;
  /** Nome azienda per l'header */
  companyName: string | null;
}

const PAGE_SIZE = 20;

export function SenderEmailPreviewPanel({ senderEmail, companyName }: SenderEmailPreviewPanelProps) {
  const [emails, setEmails] = useState<PreviewEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

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
          .select("id, subject, email_date, direction, from_address, to_address, body_text")
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
  const previewText = useMemo(() => {
    if (!current?.body_text) return "";
    return current.body_text.replace(/\s+/g, " ").trim().slice(0, 240);
  }, [current]);

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
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
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
              size="icon"
              variant="ghost"
              className="h-6 w-6"
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
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Lista compatta */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-1.5 space-y-1">
              {emails.map((em, idx) => (
                <button
                  key={em.id}
                  onClick={() => setSelectedIdx(idx)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
                    idx === selectedIdx
                      ? "bg-primary/15 border border-primary/20"
                      : "hover:bg-muted/40 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {em.direction === "inbound" ? (
                      <ArrowLeft className="h-3 w-3 text-primary flex-shrink-0" />
                    ) : (
                      <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="font-semibold truncate flex-1">
                      {em.subject || "(senza oggetto)"}
                    </span>
                  </div>
                  {em.email_date && (
                    <div className="text-[10px] text-muted-foreground pl-[18px]">
                      {new Date(em.email_date).toLocaleDateString("it-IT", {
                        day: "2-digit", month: "short", year: "2-digit",
                      })}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Preview corpo dell'email selezionata */}
          {current && (
            <div className="border-t p-3 flex-shrink-0 max-h-[35%] overflow-y-auto bg-muted/10">
              <p className="text-xs text-foreground/85 leading-relaxed line-clamp-6 whitespace-pre-wrap">
                {previewText || "(corpo email non disponibile)"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}