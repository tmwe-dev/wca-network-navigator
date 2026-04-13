/**
 * SendConfirmationGate — Unified pre-send confirmation modal.
 * Appears before ANY outbound message from any part of the app.
 */
import * as React from "react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Mail, MessageSquare, Linkedin, Phone, AlertTriangle,
  CheckCircle2, Send, Edit3, X, Shield, Clock, TrendingUp,
  User, Building2, Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import DOMPurify from "dompurify";

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4 text-blue-400" />,
  whatsapp: <MessageSquare className="h-4 w-4 text-green-400" />,
  linkedin: <Linkedin className="h-4 w-4 text-sky-400" />,
  sms: <Phone className="h-4 w-4 text-orange-400" />,
};

export interface SendGatePayload {
  recipientName?: string;
  recipientEmail: string;
  partnerName?: string;
  partnerId?: string;
  channel: "email" | "whatsapp" | "linkedin" | "sms";
  subject?: string;
  bodyHtml: string;
  aiGenerated?: boolean;
  readinessScore?: number;
  toneMatch?: boolean;
  topicCheck?: boolean;
}

interface SendConfirmationGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: SendGatePayload | null;
  onConfirmSend: (payload: SendGatePayload) => void;
  onEdit?: (payload: SendGatePayload) => void;
  onCreateRule?: (payload: SendGatePayload) => void;
  loading?: boolean;
}

interface Warning {
  icon: React.ReactNode;
  text: string;
  severity: "warn" | "info";
}

export function SendConfirmationGate({
  open, onOpenChange, payload, onConfirmSend, onEdit, onCreateRule, loading,
}: SendConfirmationGateProps): React.ReactElement | null {
  const [editableSubject, setEditableSubject] = useState("");

  useEffect(() => {
    if (payload?.subject) setEditableSubject(payload.subject);
  }, [payload?.subject]);

  // Fetch contact context
  const { data: context } = useQuery({
    queryKey: ["send-gate-context", payload?.recipientEmail],
    queryFn: async () => {
      if (!payload?.recipientEmail) return null;
      const { data } = await supabase
        .from("contact_conversation_context")
        .select("interaction_count, last_interaction_at, dominant_sentiment, response_rate, avg_response_time_hours")
        .eq("email_address", payload.recipientEmail)
        .maybeSingle();
      return data;
    },
    enabled: open && !!payload?.recipientEmail,
  });

  // Fetch address rules
  const { data: rules } = useQuery({
    queryKey: ["send-gate-rules", payload?.recipientEmail],
    queryFn: async () => {
      if (!payload?.recipientEmail) return null;
      const { data } = await supabase
        .from("email_address_rules")
        .select("id, is_active, success_rate")
        .eq("email_address", payload.recipientEmail)
        .maybeSingle();
      return data;
    },
    enabled: open && !!payload?.recipientEmail,
  });

  if (!payload) return null;

  // Compute warnings
  const warnings: Warning[] = [];
  if (!context || context.interaction_count === 0) {
    warnings.push({ icon: <AlertTriangle className="h-3.5 w-3.5" />, text: "Primo contatto — nessuna interazione precedente", severity: "warn" });
  }
  if (rules && typeof rules.success_rate === "number" && rules.success_rate < 50) {
    warnings.push({ icon: <TrendingUp className="h-3.5 w-3.5" />, text: `Bassa success rate (${Math.round(rules.success_rate)}%)`, severity: "warn" });
  }
  if (context?.last_interaction_at) {
    const daysSince = (Date.now() - new Date(context.last_interaction_at).getTime()) / 86400000;
    if (daysSince < 2) {
      warnings.push({ icon: <Clock className="h-3.5 w-3.5" />, text: "Contatto recente — meno di 2 giorni fa", severity: "warn" });
    }
  }
  if (!rules) {
    warnings.push({ icon: <Shield className="h-3.5 w-3.5" />, text: "Nessuna regola AI configurata per questo indirizzo", severity: "info" });
  }

  const followUpNum = (context?.interaction_count ?? 0) > 0 ? (context?.interaction_count ?? 0) + 1 : 1;
  const sanitized = DOMPurify.sanitize(payload.bodyHtml || "", {
    ALLOWED_TAGS: ["p","br","strong","em","ul","ol","li","a","h1","h2","h3","div","span","table","tr","td","th","hr","blockquote","b","i","u"],
    ALLOWED_ATTR: ["href","target","style","class"],
  });

  const handleSend = () => {
    onConfirmSend({ ...payload, subject: editableSubject || payload.subject });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" /> Conferma Invio
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Verifica i dettagli prima di inviare il messaggio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Recipient */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">{payload.recipientName || "—"}</span>
              <span className="text-muted-foreground font-mono text-xs">{payload.recipientEmail}</span>
            </div>
            {payload.partnerName && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                <span>{payload.partnerName}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              {CHANNEL_ICONS[payload.channel]}
              <span className="capitalize text-muted-foreground">{payload.channel}</span>
            </div>
          </div>

          {/* Subject (editable for email) */}
          {payload.channel === "email" && (
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Oggetto</label>
              <Input
                value={editableSubject}
                onChange={(e) => setEditableSubject(e.target.value)}
                className="text-sm h-8"
              />
            </div>
          )}

          {/* Message preview */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Anteprima</label>
            <ScrollArea className="max-h-[200px] rounded-lg border border-border/30 bg-card p-3">
              <div
                className="text-sm leading-relaxed text-foreground/80 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: sanitized }}
              />
            </ScrollArea>
          </div>

          {/* AI Quality */}
          {payload.aiGenerated && (
            <div className="flex items-center gap-3 text-xs">
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">AI</Badge>
              {payload.readinessScore !== undefined && (
                <span className="text-muted-foreground">
                  Readiness: <span className={payload.readinessScore >= 60 ? "text-green-400" : "text-yellow-400"}>{payload.readinessScore}/100</span>
                </span>
              )}
              {payload.toneMatch !== undefined && (
                payload.toneMatch
                  ? <span className="text-green-400 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> Tono</span>
                  : <span className="text-red-400 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> Tono</span>
              )}
              {payload.topicCheck !== undefined && (
                payload.topicCheck
                  ? <span className="text-green-400 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> Topic</span>
                  : <span className="text-red-400 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> Topic</span>
              )}
            </div>
          )}

          {/* Contact context */}
          {context && (context.interaction_count ?? 0) > 0 && (
            <div className="bg-muted/20 rounded-lg p-2.5 space-y-1 text-xs text-muted-foreground">
              {context.last_interaction_at && (
                <div>Ultimo contatto: {formatDistanceToNow(new Date(context.last_interaction_at), { addSuffix: true, locale: it })} — Follow-up #{followUpNum}</div>
              )}
              <div className="flex gap-3">
                {context.dominant_sentiment && <span>Sentiment: <span className={context.dominant_sentiment === "positive" ? "text-green-400" : context.dominant_sentiment === "negative" ? "text-red-400" : "text-muted-foreground"}>{context.dominant_sentiment}</span></span>}
                {context.response_rate != null && <span>Response rate: {Math.round(context.response_rate)}%</span>}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs rounded-md px-2.5 py-1.5 ${w.severity === "warn" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" : "bg-muted/30 text-muted-foreground border border-border/30"}`}>
                  {w.icon}
                  <span>{w.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            <X className="h-3.5 w-3.5 mr-1" /> Annulla
          </Button>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit({ ...payload, subject: editableSubject })} className="text-xs">
              <Edit3 className="h-3.5 w-3.5 mr-1" /> Modifica
            </Button>
          )}
          {onCreateRule && !rules && (
            <Button variant="secondary" size="sm" onClick={() => onCreateRule({ ...payload, subject: editableSubject })} className="text-xs">
              <Shield className="h-3.5 w-3.5 mr-1" /> Invia e Crea Regola
            </Button>
          )}
          <Button size="sm" onClick={handleSend} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white text-xs">
            {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Invia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
