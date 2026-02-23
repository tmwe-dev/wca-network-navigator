import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Wand2, Loader2, Send, Copy, Edit3, Eye, RotateCcw,
  Mail, User, Building2, CheckCircle2, AlertCircle,
  ChevronLeft, ChevronRight, Zap
} from "lucide-react";
import { type AllActivity } from "@/hooks/useActivities";
import { type GeneratedEmail, useEmailGenerator } from "@/hooks/useEmailGenerator";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={cn("w-4 h-4 fill-current", className)}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

interface StoredEmail {
  subject: string;
  body: string;
  contactEmail: string | null;
  partnerName: string;
  contactName: string | null;
  activityId: string;
}

interface EmailCanvasProps {
  activity: AllActivity | null;
  goal: string;
  baseProposal: string;
  documentIds?: string[];
  referenceUrls?: string[];
  generatedEmails: Map<string, StoredEmail>;
  onEmailGenerated: (activityId: string, email: StoredEmail) => void;
  currentEmailIndex: number;
  onIndexChange: (idx: number) => void;
  totalEmails: number;
  batchGenerating: boolean;
  batchProgress: { current: number; total: number } | null;
}

export default function EmailCanvas({
  activity, goal, baseProposal, documentIds, referenceUrls,
  generatedEmails, onEmailGenerated, currentEmailIndex, onIndexChange,
  totalEmails, batchGenerating, batchProgress
}: EmailCanvasProps) {
  const { generate, isGenerating } = useEmailGenerator();
  const [editMode, setEditMode] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sending, setSending] = useState(false);

  const partnerId = activity?.partner_id || null;
  const { data: socialLinks = [] } = useSocialLinks(partnerId);
  const companyLinkedIn = socialLinks.find((l) => l.platform === "linkedin" && !l.contact_id);
  const contactLinkedIn = socialLinks.find(
    (l) => l.platform === "linkedin" && l.contact_id === activity?.selected_contact_id
  );
  const hasAnyLinkedIn = !!companyLinkedIn || !!contactLinkedIn;

  // Current email from the map
  const currentStoredEmail = activity ? generatedEmails.get(activity.id) : null;

  const handleGenerate = async () => {
    if (!activity) return;
    const result = await generate({
      activity_id: activity.id,
      goal,
      base_proposal: baseProposal,
      document_ids: documentIds,
      reference_urls: referenceUrls,
    });
    if (result) {
      const stored: StoredEmail = {
        subject: result.subject,
        body: result.body,
        contactEmail: result.contact_email,
        partnerName: result.partner_name,
        contactName: result.contact_name,
        activityId: activity.id,
      };
      onEmailGenerated(activity.id, stored);
      setEditSubject(result.subject);
      setEditBody(result.body);
      setEditMode(false);
    }
  };

  // Sync edit fields when navigating or when stored email changes
  const displayEmail = currentStoredEmail;
  const displaySubject = editMode ? editSubject : (displayEmail?.subject || "");
  const displayBody = editMode ? editBody : (displayEmail?.body || "");

  const handleStartEdit = () => {
    if (displayEmail) {
      setEditSubject(displayEmail.subject);
      setEditBody(displayEmail.body);
    }
    setEditMode(true);
  };

  const handleCopy = () => {
    const text = `Subject: ${displaySubject}\n\n${displayBody}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Email copiata" });
  };

  const handleSend = async () => {
    if (!displayEmail?.contactEmail) {
      toast({ title: "Nessun indirizzo email", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: displayEmail.contactEmail,
          subject: displaySubject,
          html: displayBody.replace(/\n/g, "<br>"),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Email inviata!", description: `A: ${displayEmail.contactEmail}` });
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
        <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
          <Mail className="w-7 h-7 text-violet-400" />
        </div>
        <h3 className="text-base font-semibold text-stone-600">Seleziona un contatto</h3>
        <p className="text-sm text-stone-400 mt-1 max-w-xs">
          Scegli un'attività dalla lista per generare un'email personalizzata
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Partner info bar */}
      <div className="p-3 border-b border-stone-200/60 bg-white/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-stone-700">{partner?.company_name}</span>
                {partner?.company_alias && (
                  <Badge className="text-[9px] bg-stone-100 text-stone-500 hover:bg-stone-100 border-0">{partner.company_alias}</Badge>
                )}
                <span className="text-sm">{getCountryFlag(partner?.country_code || "")}</span>
                {companyLinkedIn && (
                  <a href={companyLinkedIn.url} target="_blank" rel="noopener" className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-50 hover:bg-blue-100 transition-colors">
                    <LinkedInIcon className="w-3 h-3 text-blue-600" />
                  </a>
                )}
              </div>
              {contact ? (
                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                  <User className="w-3 h-3" />
                  <span>{contact.contact_alias || contact.name}</span>
                  {contact.title && <span className="text-violet-400">· {contact.title}</span>}
                  {contact.email && (
                    <>
                      <Mail className="w-3 h-3 ml-1 text-stone-400" />
                      <span className="text-stone-400">{contact.email}</span>
                    </>
                  )}
                  {contactLinkedIn && (
                    <a href={contactLinkedIn.url} target="_blank" rel="noopener" className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-50 hover:bg-blue-100 transition-colors ml-0.5">
                      <LinkedInIcon className="w-2.5 h-2.5 text-blue-600" />
                    </a>
                  )}
                </div>
              ) : (
                <span className="text-xs text-amber-500">Nessun contatto selezionato</span>
              )}
              {!hasAnyLinkedIn && (
                <div className="flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 text-stone-400" />
                  <span className="text-[10px] text-stone-400">LinkedIn non disponibile — eseguire Deep Search</span>
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || batchGenerating}
            size="sm"
            className="gap-1.5 bg-violet-500 hover:bg-violet-600 text-white shadow-sm"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : displayEmail ? (
              <RotateCcw className="w-3.5 h-3.5" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            {displayEmail ? "Rigenera" : "Genera"}
          </Button>
        </div>
      </div>

      {/* Batch progress */}
      {batchGenerating && batchProgress && (
        <div className="px-4 py-2 border-b border-stone-200/60 bg-violet-50/50">
          <div className="flex items-center gap-2 text-xs text-violet-600 mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Generazione {batchProgress.current}/{batchProgress.total}...</span>
          </div>
          <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-1.5" />
        </div>
      )}

      {/* Email navigation */}
      {totalEmails > 0 && (
        <div className="px-4 py-2 border-b border-stone-200/60 flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-stone-400 hover:text-violet-500"
            disabled={currentEmailIndex <= 0}
            onClick={() => onIndexChange(currentEmailIndex - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-medium text-stone-500 min-w-[60px] text-center">
            {currentEmailIndex + 1} / {totalEmails}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-stone-400 hover:text-violet-500"
            disabled={currentEmailIndex >= totalEmails - 1}
            onClick={() => onIndexChange(currentEmailIndex + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Email content - 3D Canvas style */}
      <ScrollArea className="flex-1 bg-stone-50/50">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center animate-pulse">
                <Wand2 className="w-6 h-6 text-violet-500" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-violet-300/30 animate-ping" />
            </div>
            <p className="text-sm text-stone-500">Generazione in corso...</p>
            <p className="text-xs text-stone-400">Analisi profilo {partner?.company_name}</p>
          </div>
        ) : displayEmail ? (
          <div className="p-5">
            {/* 3D Canvas Card */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4 transition-all">
              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Oggetto</label>
                {editMode ? (
                  <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="text-sm font-medium border-stone-200 focus:ring-violet-300/50" />
                ) : (
                  <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-100 text-sm font-medium text-stone-700">{displaySubject}</div>
                )}
              </div>

              {/* Recipient */}
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <Mail className="w-3.5 h-3.5" />
                <span>A: {displayEmail.contactEmail || "Nessun indirizzo"}</span>
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Corpo</label>
                {editMode ? (
                  <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="min-h-[300px] text-sm leading-relaxed border-stone-200 focus:ring-violet-300/50" />
                ) : (
                  <div className="p-4 rounded-xl bg-stone-50/80 border border-stone-100 text-sm leading-relaxed text-stone-600 whitespace-pre-wrap">{displayBody}</div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4">
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => editMode ? setEditMode(false) : handleStartEdit()}
                className={cn(
                  "gap-1.5",
                  editMode
                    ? "bg-violet-500 hover:bg-violet-600 text-white"
                    : "border-stone-200 text-stone-500 hover:bg-violet-50"
                )}
              >
                {editMode ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                {editMode ? "Anteprima" : "Modifica"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 border-stone-200 text-stone-500 hover:bg-violet-50">
                <Copy className="w-3.5 h-3.5" />
                Copia
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sending || !displayEmail.contactEmail}
                className="gap-1.5 bg-violet-500 hover:bg-violet-600 text-white"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Invia
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center p-8">
            <CheckCircle2 className="w-10 h-10 text-stone-300" />
            <p className="text-sm text-stone-400">
              Compila il Goal e la Proposta, poi clicca <strong className="text-violet-500">Genera</strong>
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
