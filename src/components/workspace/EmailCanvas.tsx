import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Wand2, Loader2, Send, Copy, Edit3, Eye, RotateCcw, Mail, User, AlertCircle, ChevronLeft, ChevronRight, Zap, AtSign, AlertTriangle } from "lucide-react";
import { type AllActivity } from "@/hooks/useActivities";
import { useEmailGenerator } from "@/hooks/useEmailGenerator";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import { useAppSettings } from "@/hooks/useAppSettings";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { invokeEdge } from "@/lib/api/invokeEdge";
import DOMPurify from "dompurify";
import ContactPicker from "@/components/workspace/ContactPicker";
import { useTrackActivity } from "@/hooks/useTrackActivity";

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
  quality?: "fast" | "standard" | "premium";
}

export default function EmailCanvas({
  activity, goal, baseProposal, documentIds, referenceUrls,
  generatedEmails, onEmailGenerated, currentEmailIndex, onIndexChange,
  totalEmails, batchGenerating, batchProgress, quality = "standard"
}: EmailCanvasProps) {
  const { generate, isGenerating } = useEmailGenerator();
  const { data: settings } = useAppSettings();
  const [editMode, setEditMode] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sending, setSending] = useState(false);
  const trackActivity = useTrackActivity();
  const partnerId = activity?.partner_id || null;
  const sourceType = activity?.source_type || "partner";
  const _hasContact = !!activity?.selected_contact_id || sourceType !== "partner";
  const { data: socialLinks = [] } = useSocialLinks(partnerId);
  const companyLinkedIn = socialLinks.find((l) => l.platform === "linkedin" && !l.contact_id);
  const contactLinkedIn = socialLinks.find(
    (l) => l.platform === "linkedin" && l.contact_id === activity?.selected_contact_id
  );

  const senderName = settings?.ai_contact_alias || settings?.ai_contact_name || "";
  const senderCompany = settings?.ai_company_alias || settings?.ai_company_name || "";
  const senderEmail = settings?.ai_email_signature || "";

  const currentStoredEmail = activity ? generatedEmails.get(activity.id) : null;

  const handleGenerate = async () => {
    if (!activity) return;
    if (sourceType === "partner" && !activity.selected_contact_id) {
      toast({ title: "Seleziona un contatto", description: "Devi selezionare un contatto prima di generare l'email", variant: "destructive" });
      return;
    }
    const result = await generate({
      activity_id: activity.id, goal, base_proposal: baseProposal,
      document_ids: documentIds, reference_urls: referenceUrls, quality,
    });
    if (result) {
      const stored: StoredEmail = {
        subject: result.subject, body: result.body, contactEmail: result.contact_email,
        partnerName: result.partner_name, contactName: result.contact_name, activityId: activity.id,
      };
      onEmailGenerated(activity.id, stored);
      setEditSubject(result.subject);
      setEditBody(result.body);
      setEditMode(false);
    }
  };

  const displayEmail = currentStoredEmail;
  const displaySubject = editMode ? editSubject : (displayEmail?.subject || "");
  const displayBody = editMode ? editBody : (displayEmail?.body || "");

  const handleStartEdit = () => {
    if (displayEmail) { setEditSubject(displayEmail.subject); setEditBody(displayEmail.body); }
    setEditMode(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${displaySubject}\n\n${displayBody}`);
    toast({ title: "Email copiata" });
  };

  const handleSend = async () => {
    if (!displayEmail?.contactEmail) { toast({ title: "Nessun indirizzo email", variant: "destructive" }); return; }
    setSending(true);
    try {
      const sanitizedHtml = DOMPurify.sanitize(displayBody.replace(/\n/g, "<br>"), { ALLOWED_TAGS: ['br', 'p', 'b', 'i', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span', 'div'], ALLOWED_ATTR: ['href', 'target', 'rel', 'style'] });
      const data = await invokeEdge<Record<string, unknown>>("send-email", { body: { to: displayEmail.contactEmail, subject: displaySubject, html: sanitizedHtml }, context: "EmailCanvas.send_email" });
      if (data?.error) throw new Error(String(data.error));
      toast({ title: "Email inviata!", description: `A: ${displayEmail.contactEmail}` });
      // Track activity
      trackActivity.mutate({
        activityType: "send_email",
        title: `${displayEmail.partnerName || "—"} — ${displayEmail.contactName || displayEmail.contactEmail}`,
        sourceId: activity?.partner_id || activity?.source_id || crypto.randomUUID(),
        sourceType: (activity?.source_type === "contact" || activity?.source_type === "prospect") ? "imported_contact" : "partner",
        partnerId: activity?.partner_id || undefined,
        emailSubject: displaySubject,
        description: `Email inviata a ${displayEmail.contactEmail}`,
      });
    } catch (err: unknown) {
      toast({ title: "Errore invio", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSending(false); }
  };

  const partner = activity?.partners;
  const contact = activity?.selected_contact;
  const meta = activity?.source_meta || {};
  const displayCompany = partner?.company_alias || partner?.company_name || meta.company_name || activity?.title;
  const displayCountry = partner?.country_name || meta.country || "";
  const displayCity = partner?.city || meta.city || "";
  const displayCountryCode = partner?.country_code || meta.country_code || "";

  // Empty state
  if (!activity) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Mail className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <h3 className="text-sm font-medium text-foreground">Seleziona un contatto</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Scegli un'attività dalla lista per generare un'email personalizzata
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Batch progress */}
      {batchGenerating && batchProgress && (
        <div className="px-4 py-2 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2 text-xs text-primary mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Generazione {batchProgress.current}/{batchProgress.total}...</span>
          </div>
          <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-1.5" />
        </div>
      )}

      {/* Email navigation */}
      {totalEmails > 0 && (
        <div className="px-4 py-1.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              disabled={currentEmailIndex <= 0} onClick={() => onIndexChange(currentEmailIndex - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground min-w-[50px] text-center">
              {currentEmailIndex + 1} / {totalEmails}
            </span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              disabled={currentEmailIndex >= totalEmails - 1} onClick={() => onIndexChange(currentEmailIndex + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating || batchGenerating} size="sm"
            className="h-7 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs">
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : displayEmail ? <RotateCcw className="w-3.5 h-3.5" /> : <Wand2 className="w-3.5 h-3.5" />}
            {displayEmail ? "Rigenera" : "Genera"}
          </Button>
        </div>
      )}

      {/* Email content */}
      <ScrollArea className="flex-1">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Wand2 className="w-6 h-6 text-primary" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
            </div>
            <p className="text-sm text-muted-foreground">Generazione in corso...</p>
            <p className="text-xs text-muted-foreground/60">Analisi profilo {displayCompany}</p>
          </div>
        ) : displayEmail ? (
          <div className="p-4">
            {/* Email card */}
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              {/* Header — Da / A / Oggetto */}
              <div className="border-b border-border px-5 pt-4 pb-3 space-y-2 bg-muted/20">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-10 shrink-0 font-medium">Da:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-3 h-3 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">{senderName}</span>
                    {senderCompany && <span className="text-muted-foreground">({senderCompany})</span>}
                    {senderEmail && <span className="text-muted-foreground">&lt;{senderEmail}&gt;</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-10 shrink-0 font-medium">A:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                      <AtSign className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <span className="font-medium text-foreground">
                      {contact?.contact_alias || contact?.name || meta.contact_name || displayCompany || displayEmail.partnerName || activity?.title}
                    </span>
                    {displayEmail.contactEmail ? (
                      <span className="text-muted-foreground">&lt;{displayEmail.contactEmail}&gt;</span>
                    ) : (
                      <span className="text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Nessun indirizzo
                      </span>
                    )}
                    {contactLinkedIn && (
                      <a href={contactLinkedIn.url} target="_blank" rel="noopener" className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
                        <LinkedInIcon className="w-2.5 h-2.5 text-blue-500" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground w-10 shrink-0 font-medium pt-0.5">Ogg:</span>
                  {editMode ? (
                    <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)}
                      className="h-7 text-xs font-medium border-border" />
                  ) : (
                    <span className="font-semibold text-foreground leading-snug">{displaySubject}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {getCountryFlag(displayCountryCode)} {displayCity}{displayCity && displayCountry ? ", " : ""}{displayCountry}
                  </span>
                  {companyLinkedIn && (
                    <a href={companyLinkedIn.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-400">
                      <LinkedInIcon className="w-3 h-3 text-blue-500" /> LinkedIn
                    </a>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-5">
                {editMode ? (
                  <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)}
                    className="min-h-[350px] text-sm leading-relaxed border-border font-[inherit]" />
                ) : (
                  <div className="text-sm leading-[1.75] text-foreground/80 whitespace-pre-wrap">
                    {displayBody}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <Button variant={editMode ? "default" : "outline"} size="sm"
                onClick={() => editMode ? setEditMode(false) : handleStartEdit()}
                className="gap-1.5 h-8 text-xs">
                {editMode ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                {editMode ? "Anteprima" : "Modifica"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 h-8 text-xs">
                <Copy className="w-3.5 h-3.5" /> Copia
              </Button>
              <div className="flex-1" />
              <Button size="sm" onClick={handleSend} disabled={sending || !displayEmail.contactEmail}
                className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Invia
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center p-8">
            <Wand2 className="w-10 h-10 text-muted-foreground/40" />
            {/* Contact picker for partner-source activities */}
            {sourceType === "partner" && partnerId && (
              <div className="w-full max-w-xs mb-2">
                <ContactPicker
                  activityId={activity.id}
                  partnerId={partnerId}
                  selectedContactId={activity.selected_contact_id}
                />
              </div>
            )}
            {sourceType === "partner" && !activity.selected_contact_id ? (
              <div className="flex items-center gap-2 text-warning text-sm">
                <AlertTriangle className="w-4 h-4" />
                Seleziona un contatto per generare l'email
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Compila Goal e Proposta, poi clicca <strong className="text-primary">Genera</strong>
                </p>
                {!totalEmails && (
                  <Button onClick={handleGenerate} disabled={isGenerating} size="sm"
                    className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground mt-2">
                    <Wand2 className="w-3.5 h-3.5" /> Genera Email
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
