/**
 * InviatiSubTab — Sent outreach items with response tracking
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, MessageCircle, CheckCircle2, Clock, AlertTriangle, Loader2, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { findSentOutreach } from "@/data/outreachPipeline";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { sanitizeHtml } from "@/lib/security/htmlSanitizer";
import { useState } from "react";

interface SentItem {
  id: string;
  email: string;
  partner_name: string;
  channel: string;
  subject: string;
  body: string;
  source: string;
  sent_at: string;
}

export function InviatiSubTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["outreach-sent"],
    queryFn: findSentOutreach,
  });

  const items = useMemo((): SentItem[] => {
    if (!data) return [];
    const result: SentItem[] = [];

    for (const a of data.activities) {
      result.push({
        id: a.id, email: (a as Record<string, unknown>).source_meta ? ((a as Record<string, unknown>).source_meta as Record<string, string>).email || "" : "",
        partner_name: (a.partners as Record<string, string>)?.company_name || "—",
        channel: a.activity_type, subject: a.email_subject || a.title,
        body: a.email_body || "", source: a.source_type || "partner",
        sent_at: a.completed_at || a.created_at,
      });
    }
    for (const ma of data.missionActions) {
      result.push({
        id: ma.id, email: (ma.metadata as Record<string, string>)?.email || "",
        partner_name: (ma.metadata as Record<string, string>)?.company_name || ma.action_label || "—",
        channel: ma.action_type, subject: ma.action_label || "",
        body: (ma.metadata as Record<string, string>)?.email_body || "",
        source: "mission", sent_at: ma.completed_at || ma.created_at,
      });
    }

    return result.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
  }, [data]);

  // Simple response status determination by how long ago it was sent
  const getResponseStatus = (sentAt: string) => {
    const daysSince = (Date.now() - new Date(sentAt).getTime()) / 86400000;
    if (daysSince < 7) return { label: "In attesa", color: "text-amber-500", dot: "bg-amber-500", icon: Clock };
    return { label: "Nessuna risposta", color: "text-destructive", dot: "bg-destructive", icon: AlertTriangle };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 py-2 border-b border-border/30 flex items-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-medium">Messaggi Inviati</span>
        <Badge variant="outline" className="text-[10px] h-5 ml-auto">{items.length}</Badge>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nessun messaggio inviato</div>
        ) : (
          <div className="p-2 space-y-1">
            {items.map((item) => {
              const rs = getResponseStatus(item.sent_at);
              const isExpanded = expandedId === item.id;

              return (
                <Collapsible key={item.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : item.id)}>
                  <CollapsibleTrigger asChild>
                    <div className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer", isExpanded && "bg-muted/20 rounded-b-none")}>
                      <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Mail className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground truncate">{item.partner_name}</span>
                          {item.email && <span className="text-[10px] text-muted-foreground truncate">{item.email}</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{item.subject}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn("w-2 h-2 rounded-full", rs.dot)} />
                        <span className={cn("text-[10px]", rs.color)}>{rs.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(item.sent_at), "dd MMM HH:mm", { locale: it })}
                      </span>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 bg-muted/10 rounded-b-lg border-t border-border/20 space-y-2">
                      {item.subject && <p className="text-xs font-medium">Oggetto: {item.subject}</p>}
                      {item.body && (
                        <div className="text-xs border rounded-md p-2.5 max-h-[180px] overflow-auto bg-background"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.body) }} />
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <CornerDownRight className="w-3 h-3" />
                        <span>Inviato: {format(new Date(item.sent_at), "dd MMM yyyy HH:mm", { locale: it })}</span>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
