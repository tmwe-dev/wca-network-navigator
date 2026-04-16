/**
 * SenderEmailsDialog — Shows emails from a specific sender in sequence
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Calendar, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SenderEmail {
  id: string;
  subject: string | null;
  body_text: string | null;
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

export function SenderEmailsDialog({ open, onOpenChange, emailAddress, companyName }: SenderEmailsDialogProps) {
  const [emails, setEmails] = useState<SenderEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!open || !emailAddress) return;
    setSelectedIdx(0);
    loadEmails();
  }, [open, emailAddress]);

  const loadEmails = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("channel_messages")
        .select("id, subject, body_text, email_date, direction, from_address, to_address")
        .eq("user_id", user.id)
        .or(`from_address.ilike.%${emailAddress}%,to_address.ilike.%${emailAddress}%`)
        .order("email_date", { ascending: false })
        .limit(50);
      setEmails((data as SenderEmail[]) || []);
    } catch {
      setEmails([]);
    } finally {
      setIsLoading(false);
    }
  };

  const current = emails[selectedIdx];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
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
            <ScrollArea className="w-[200px] shrink-0 border rounded-md">
              <div className="p-1 space-y-1">
                {emails.map((em, idx) => (
                  <button
                    key={em.id}
                    onClick={() => setSelectedIdx(idx)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
                      idx === selectedIdx
                        ? "bg-primary/15 text-primary"
                        : "hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      {em.direction === "inbound" ? (
                        <ArrowLeft className="h-3 w-3 text-blue-400 shrink-0" />
                      ) : (
                        <ArrowRight className="h-3 w-3 text-green-400 shrink-0" />
                      )}
                      <span className="truncate font-medium">
                        {em.subject || "(senza oggetto)"}
                      </span>
                    </div>
                    {em.email_date && (
                      <span className="text-[10px] text-muted-foreground/70">
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
              <div className="flex-1 flex flex-col min-w-0 border rounded-md">
                <div className="px-3 py-2 border-b bg-muted/20 space-y-1">
                  <div className="flex items-center gap-2">
                    {current.direction === "inbound" ? (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <ArrowLeft className="h-3 w-3" /> Ricevuta
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <ArrowRight className="h-3 w-3" /> Inviata
                      </Badge>
                    )}
                    {current.email_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(current.email_date).toLocaleString("it-IT")}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {selectedIdx + 1}/{emails.length}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-semibold truncate">
                    {current.subject || "(senza oggetto)"}
                  </h3>
                  <div className="text-[10px] text-muted-foreground truncate">
                    Da: {current.from_address} → A: {current.to_address}
                  </div>
                </div>
                <ScrollArea className="flex-1 p-3">
                  <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                    {current.body_text || "(contenuto non disponibile)"}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
