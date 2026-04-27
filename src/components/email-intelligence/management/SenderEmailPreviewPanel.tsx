/**
 * SenderEmailPreviewPanel — pannello inline 35% sinistra dell'area inferiore.
 *
 * Mostra le ultime 20 email del sender selezionato con:
 *  • lista compatta: direzione + canale + subject + data + anteprima 1 riga
 *  • dettaglio in basso: from/to + badge canale/direzione + corpo 6 righe
 */
import { useState, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Mail, Loader2,
  ArrowDownLeft, ArrowUpRight, MessageCircle, Linkedin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PreviewEmail {
  id: string;
  subject: string | null;
  email_date: string | null;
  direction: string;
  channel: string | null;
  from_address: string | null;
  to_address: string | null;
  body_text: string | null;
}

interface SenderEmailPreviewPanelProps {
  senderEmail: string | null;
  companyName: string | null;
}

const PAGE_SIZE = 20;

function ChannelIcon({ channel, className }: { channel: string | null; className?: string }) {
  if (channel === "whatsapp") return <MessageCircle className={cn("text-emerald-500", className)} />;
  if (channel === "linkedin") return <Linkedin className={cn("text-sky-500", className)} />;
  return <Mail className={cn("text-primary", className)} />;
}

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
          .select("id, subject, email_date, direction, channel, from_address, to_address, body_text")
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
    return current.body_text.replace(/\s+/g, " ").trim().slice(0, 600);
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
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-1.5 space-y-1">
              {emails.map((em, idx) => {
                const bodyPreview = (em.body_text ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
                return (
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

          {/* Pannello dettaglio email selezionata */}
          {current && (
            <div className="border-t flex-shrink-0 max-h-[45%] overflow-y-auto bg-muted/10">
              <div className="px-3 py-2 space-y-1.5">
                {/* Badge canale + direzione + data */}
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

                {/* From / To */}
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

                {/* Subject in evidenza */}
                {current.subject && (
                  <div className="text-xs font-semibold text-foreground pt-1 border-t">
                    {current.subject}
                  </div>
                )}

                {/* Corpo */}
                <p className="text-xs text-foreground/85 leading-relaxed line-clamp-6 whitespace-pre-wrap pt-1">
                  {previewText || "(corpo email non disponibile)"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
