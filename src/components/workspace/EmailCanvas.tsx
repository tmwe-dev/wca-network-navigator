import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wand2, Loader2, Send, Copy, Edit3, Eye, RotateCcw,
  Mail, User, Building2, Globe2, CheckCircle2
} from "lucide-react";
import { type AllActivity } from "@/hooks/useActivities";
import { type GeneratedEmail, useEmailGenerator } from "@/hooks/useEmailGenerator";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EmailCanvasProps {
  activity: AllActivity | null;
  goal: string;
  baseProposal: string;
}

export default function EmailCanvas({ activity, goal, baseProposal }: EmailCanvasProps) {
  const { generate, isGenerating, email, setEmail, reset } = useEmailGenerator();
  const [editMode, setEditMode] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleGenerate = async () => {
    if (!activity) return;
    const result = await generate({
      activity_id: activity.id,
      goal,
      base_proposal: baseProposal,
    });
    if (result) {
      setEditSubject(result.subject);
      setEditBody(result.body);
      setEditMode(false);
    }
  };

  const handleCopy = () => {
    const text = `Subject: ${editSubject}\n\n${editBody}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Email copiata negli appunti" });
  };

  const handleSend = async () => {
    if (!email || !activity) return;
    const recipientEmail = email.contact_email;
    if (!recipientEmail) {
      toast({ title: "Nessun indirizzo email disponibile", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: recipientEmail,
          subject: editSubject,
          html: editBody.replace(/\n/g, "<br>"),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Email inviata!", description: `A: ${recipientEmail}` });
    } catch (err: any) {
      toast({ title: "Errore invio", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const partner = activity?.partners;
  const contact = activity?.selected_contact;

  // Empty state
  if (!activity) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-primary/50" />
        </div>
        <h3 className="text-lg font-semibold text-foreground/80">Seleziona un contatto</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Scegli un'attività dalla lista per generare un'email personalizzata con l'AI
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Partner info bar */}
      <div className="p-4 border-b border-border/30 bg-card/40 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {partner?.company_name}
                </span>
                {partner?.company_alias && (
                  <Badge variant="outline" className="text-[10px]">{partner.company_alias}</Badge>
                )}
                <span className="text-sm">{getCountryFlag(partner?.country_code || "")}</span>
              </div>
              {contact ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>{contact.name}</span>
                  {contact.title && <span className="text-primary/60">· {contact.title}</span>}
                  {contact.email && (
                    <>
                      <Mail className="w-3 h-3 ml-1" />
                      <span>{contact.email}</span>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-xs text-warning">Nessun contatto selezionato</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-2"
              size="sm"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : email ? (
                <RotateCcw className="w-4 h-4" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {email ? "Rigenera" : "Genera Email"}
            </Button>
          </div>
        </div>
      </div>

      {/* Email content */}
      <ScrollArea className="flex-1">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Wand2 className="w-6 h-6 text-primary" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
            </div>
            <p className="text-sm text-muted-foreground">Generazione in corso...</p>
            <p className="text-xs text-muted-foreground/60">
              Analisi profilo {partner?.company_name}
            </p>
          </div>
        ) : email ? (
          <div className="p-5 space-y-4">
            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Oggetto
              </label>
              {editMode ? (
                <Input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="text-sm font-medium"
                />
              ) : (
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/30 text-sm font-medium">
                  {editSubject}
                </div>
              )}
            </div>

            {/* Recipient */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="w-3.5 h-3.5" />
              <span>A: {email.contact_email || "Nessun indirizzo"}</span>
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Corpo
              </label>
              {editMode ? (
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="min-h-[300px] text-sm leading-relaxed"
                />
              ) : (
                <div className="p-4 rounded-xl bg-background/80 border border-border/30 text-sm leading-relaxed whitespace-pre-wrap">
                  {editBody}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/20">
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode(!editMode)}
                className="gap-1.5"
              >
                {editMode ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                {editMode ? "Anteprima" : "Modifica"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                <Copy className="w-3.5 h-3.5" />
                Copia
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sending || !email.contact_email}
                className="gap-1.5"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Invia
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center p-8">
            <CheckCircle2 className="w-10 h-10 text-primary/30" />
            <p className="text-sm text-muted-foreground">
              Compila il Goal e la Proposta di base, poi clicca <strong>Genera Email</strong>
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
