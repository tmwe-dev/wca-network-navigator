import { useState, useMemo, useCallback } from "react";
import DOMPurify from "dompurify";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Send, Save, Eye, Loader2, Mail, Sparkles,
  Paperclip, Link as LinkIcon, Plus, X,
} from "lucide-react";
import { useSaveEmailDraft } from "@/hooks/useEmailDrafts";
import { useEmailTemplates } from "@/hooks/useCampaignJobs";
import { useEnqueueCampaign, useProcessQueue } from "@/hooks/useEmailCampaignQueue";
import { CampaignQueueMonitor } from "@/components/campaigns/CampaignQueueMonitor";
import { useMission } from "@/contexts/MissionContext";
import { ActiveContextBar } from "@/components/shared/ActiveContextBar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIABLES = ["{{company_name}}", "{{contact_name}}", "{{city}}", "{{country}}"];

interface LinkItem { label: string; url: string; }

export default function EmailComposer() {
  const { goal, baseProposal, documents, referenceLinks, recipients } = useMission();

  // Email state
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [emailLinks, setEmailLinks] = useState<LinkItem[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  // Queue state
  const [sending, setSending] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeQueueStatus, setActiveQueueStatus] = useState("idle");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const enqueueCampaign = useEnqueueCampaign();
  const { processing, startProcessing } = useProcessQueue();
  const saveDraft = useSaveEmailDraft();
  const { data: templates = [] } = useEmailTemplates();

  const recipientsWithEmail = recipients.filter((r) => r.email);

  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const isValidUrl = (url: string) => {
    try { return ['http:', 'https:'].includes(new URL(url).protocol); }
    catch { return false; }
  };

  const addLink = () => {
    if (!newLinkLabel || !newLinkUrl) return;
    if (!isValidUrl(newLinkUrl)) { toast.error("URL non valido"); return; }
    setEmailLinks((prev) => [...prev, { label: newLinkLabel, url: newLinkUrl }]);
    setNewLinkLabel(""); setNewLinkUrl("");
  };

  const buildFinalHtml = (body: string, partner: any, contactName: string) => {
    let html = body
      .replace(/\{\{company_name\}\}/g, escapeHtml(partner.companyName || partner.company_name || ""))
      .replace(/\{\{contact_name\}\}/g, escapeHtml(contactName || ""))
      .replace(/\{\{city\}\}/g, escapeHtml(partner.city || ""))
      .replace(/\{\{country\}\}/g, escapeHtml(partner.countryName || partner.country_name || ""));
    const validLinks = emailLinks.filter((l) => isValidUrl(l.url));
    if (validLinks.length > 0) {
      html += `<br/><br/><p><strong>Link utili:</strong></p><ul>`;
      validLinks.forEach((l) => { html += `<li><a href="${encodeURI(l.url)}" target="_blank">${escapeHtml(l.label)}</a></li>`; });
      html += `</ul>`;
    }
    const attachedTemplates = templates.filter((t: any) => selectedAttachments.includes(t.id));
    if (attachedTemplates.length > 0) {
      html += `<br/><p><strong>Allegati:</strong></p><ul>`;
      attachedTemplates.forEach((t: any) => { html += `<li><a href="${encodeURI(t.file_url)}" target="_blank">${escapeHtml(t.file_name)}</a></li>`; });
      html += `</ul>`;
    }
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','strong','em','ul','ol','li','a','h1','h2','h3','h4','div','span','table','tr','td','th','thead','tbody','img','hr','blockquote','pre','code','b','i','u'],
      ALLOWED_ATTR: ['href','target','src','alt','style','class','width','height','colspan','rowspan'],
    });
  };

  // AI generation
  const handleAIGenerate = async () => {
    if (!goal && !baseProposal) {
      toast.error("Configura obiettivo o proposta dalla sidebar Mission (icona target a destra)");
      return;
    }
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email", {
        body: {
          goal,
          base_proposal: baseProposal,
          language: "italiano",
          document_ids: documents.map((d) => d.id),
          reference_urls: referenceLinks,
          quality: "standard",
          activity_id: "00000000-0000-0000-0000-000000000000",
          standalone: true,
          recipient_count: recipientsWithEmail.length,
          recipient_countries: [...new Set(recipients.map((r) => r.countryName))].join(", "),
        },
      });
      if (error) throw error;
      if (data?.subject) setSubject(data.subject);
      if (data?.body) setHtmlBody(data.body);
      toast.success("Email generata con AI");
    } catch (err: any) {
      toast.error("Errore generazione AI: " + (err.message || "Sconosciuto"));
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await saveDraft.mutateAsync({
        subject, html_body: htmlBody, category: "altro",
        recipient_type: "partner",
        recipient_filter: { partner_ids: recipients.map((r) => r.partnerId) },
        attachment_ids: selectedAttachments, link_urls: emailLinks,
        status: "draft", total_count: recipientsWithEmail.length,
      } as any);
      toast.success("Bozza salvata");
    } catch { toast.error("Errore nel salvataggio"); }
  };

  const handleEnqueue = async () => {
    if (!subject || !htmlBody) { toast.error("Compila oggetto e corpo email"); return; }
    if (recipientsWithEmail.length === 0) { toast.error("Nessun destinatario con email valida"); return; }
    setSending(true);
    try {
      const { data: savedDraft, error: draftError } = await supabase
        .from("email_drafts" as any)
        .insert({
          subject, html_body: htmlBody, category: "altro",
          recipient_type: "partner",
          recipient_filter: { partner_ids: recipients.map((r) => r.partnerId) },
          attachment_ids: selectedAttachments, link_urls: emailLinks,
          status: "queued", total_count: recipientsWithEmail.length,
        } as any).select().single();
      if (draftError) throw draftError;
      const draftId = (savedDraft as any).id;

      const resolvedRecipients = recipientsWithEmail.map((r) => ({
        partner_id: r.partnerId,
        email: r.email!,
        name: r.companyName,
        subject: subject
          .replace(/\{\{company_name\}\}/g, r.companyName)
          .replace(/\{\{contact_name\}\}/g, r.contactName || "")
          .replace(/\{\{city\}\}/g, r.city || "")
          .replace(/\{\{country\}\}/g, r.countryName || ""),
        html: buildFinalHtml(htmlBody, r, r.contactName || ""),
      }));

      await enqueueCampaign.mutateAsync({ draftId, recipients: resolvedRecipients, delaySeconds: 5 });
      setActiveDraftId(draftId);
      setActiveQueueStatus("idle");
      startProcessing(draftId);
      setActiveQueueStatus("processing");
    } catch (err) {
      console.error("Enqueue error:", err);
      toast.error("Errore nell'accodamento");
    }
    setSending(false);
  };

  const templatesByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    templates.forEach((t: any) => { const cat = t.category || "altro"; if (!groups[cat]) groups[cat] = []; groups[cat].push(t); });
    return groups;
  }, [templates]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Context Bar */}
      <ActiveContextBar />

      {/* Main Content — single column */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 space-y-5 max-w-3xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-foreground">Email Composer</h1>
                <p className="text-xs text-muted-foreground">Componi e invia email personalizzate</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              <Mail className="w-3 h-3 mr-1" />
              {recipientsWithEmail.length} con email
            </Badge>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Oggetto</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Oggetto della email..."
              className="h-10 text-sm font-medium"
            />
          </div>

          {/* Variables */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-muted-foreground mr-1 self-center">Variabili:</span>
            {VARIABLES.map((v) => (
              <Badge key={v} variant="outline" className="cursor-pointer text-[10px] hover:bg-primary/10"
                onClick={() => setHtmlBody((prev) => prev + v)}>{v}</Badge>
            ))}
          </div>

          {/* Body */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Corpo email</label>
            <Textarea
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              placeholder="Scrivi il contenuto della email... Puoi usare HTML e variabili come {{company_name}}"
              className="min-h-[220px] text-sm bg-muted/20 resize-y"
            />
          </div>

          {/* AI Generate */}
          <Button onClick={handleAIGenerate} disabled={aiGenerating} className="w-full gap-2 h-10" variant="outline">
            {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
            {aiGenerating ? "Generazione AI in corso..." : "✨ Genera con AI"}
          </Button>

          {/* Links — collapsible */}
          <Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors">
              <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium flex-1 text-left">Link</span>
              {emailLinks.length > 0 && <Badge variant="secondary" className="text-[10px] h-4">{emailLinks.length}</Badge>}
              <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", linksOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pb-2 pt-1 space-y-2">
              {emailLinks.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg p-2">
                  <span className="truncate flex-1">{l.label}: {l.url}</span>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setEmailLinks((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <Input placeholder="Etichetta" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} className="flex-1 h-8 text-xs" />
                <Input placeholder="https://..." value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} className="flex-1 h-8 text-xs" />
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={addLink}><Plus className="w-3 h-3" /></Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Attachments — collapsible */}
          {templates.length > 0 && (
            <Collapsible open={attachOpen} onOpenChange={setAttachOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors">
                <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium flex-1 text-left">Allegati</span>
                {selectedAttachments.length > 0 && <Badge variant="secondary" className="text-[10px] h-4">{selectedAttachments.length}</Badge>}
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", attachOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-2 pt-1 space-y-1">
                {Object.entries(templatesByCategory).map(([cat, files]) => (
                  <div key={cat} className="space-y-0.5">
                    {files.map((t: any) => (
                      <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded hover:bg-muted/30">
                        <input type="checkbox" checked={selectedAttachments.includes(t.id)}
                          onChange={() => setSelectedAttachments((prev) => prev.includes(t.id) ? prev.filter((a) => a !== t.id) : [...prev, t.id])}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <span className="truncate">{t.file_name}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Preview */}
          {(subject || htmlBody) && (
            <div className="border border-border/30 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border/30">
                <Eye className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold">Anteprima</span>
              </div>
              <div className="px-4 py-3 bg-muted/10">
                <p className="text-sm font-medium mb-1">
                  {subject.replace(/\{\{company_name\}\}/g, "Acme Logistics").replace(/\{\{contact_name\}\}/g, "John Doe").replace(/\{\{city\}\}/g, "Milano").replace(/\{\{country\}\}/g, "Italy") || "Nessun oggetto"}
                </p>
                <p className="text-[10px] text-muted-foreground mb-3">A: partner@example.com</p>
                <div className="text-xs prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: buildFinalHtml(htmlBody,
                      { companyName: "Acme Logistics", city: "Milano", countryName: "Italy" },
                      "John Doe"),
                  }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={handleSaveDraft} disabled={sending} className="gap-2 h-10">
              <Save className="w-4 h-4" /> Salva bozza
            </Button>
            <Button onClick={handleEnqueue} disabled={sending || processing || recipientsWithEmail.length === 0} className="gap-2 h-10 flex-1">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Preparazione..." : `Invia a ${recipientsWithEmail.length} destinatari`}
            </Button>
          </div>

          {/* Queue Monitor */}
          {activeDraftId && (
            <CampaignQueueMonitor draftId={activeDraftId} queueStatus={activeQueueStatus} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
