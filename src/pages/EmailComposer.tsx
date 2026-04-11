import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { useQuery } from "@tanstack/react-query";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { createLogger } from "@/lib/log";

const log = createLogger("EmailComposer");
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Send, Save, Eye, Loader2, Mail, Paperclip, Link as LinkIcon, Plus, X, Braces, Users, Bookmark,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCountryFlag } from "@/lib/countries";
import { useSaveEmailDraft } from "@/hooks/useEmailDrafts";
import { useEmailTemplates } from "@/hooks/useCampaignJobs";
import { useEnqueueCampaign, useProcessQueue } from "@/hooks/useEmailCampaignQueue";
import { CampaignQueueMonitor } from "@/components/campaigns/CampaignQueueMonitor";
import { useMission } from "@/contexts/MissionContext";
import OraclePanel, { type OracleConfig } from "@/components/email/OraclePanel";
import HtmlEmailEditor from "@/components/email/HtmlEmailEditor";
import EmailEditLearningDialog, { type EditAnalysis } from "@/components/email/EmailEditLearningDialog";

import { cn } from "@/lib/utils";
import { insertEmailDraft } from "@/data/emailDrafts";

const VARIABLES = ["{{company_name}}", "{{contact_name}}", "{{city}}", "{{country}}"];

interface LinkItem { label: string; url: string; }

export default function EmailComposer() {
  const { goal, baseProposal, documents, referenceLinks, recipients, removeRecipient, addRecipient } = useMission();
  const location = useLocation();
  const navigate = useNavigate();
  const [manualEmail, setManualEmail] = useState("");

  useEffect(() => {
    const state = location.state as any;
    if (!state) return;

    if (state.prefilledRecipient) {
      const r = state.prefilledRecipient;
      addRecipient({
        partnerId: r.partnerId || "",
        companyName: r.company || r.companyName || "",
        companyAlias: r.companyAlias,
        contactId: r.contactId,
        contactName: r.name || r.contactName || "",
        contactAlias: r.contactAlias,
        email: r.email || null,
        city: r.city || "",
        countryName: r.countryName || "",
        countryCode: r.countryCode,
        isEnriched: false,
      });
    }

    if (state.prefilledSubject) {
      setSubject(state.prefilledSubject);
    }

    if (state.prefilledBody) {
      const escaped = state.prefilledBody
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      setHtmlBody(`<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escaped}</pre>`);
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, []);

  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [emailLinks, setEmailLinks] = useState<LinkItem[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const [sending, setSending] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeQueueStatus, setActiveQueueStatus] = useState("idle");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImproving, setAiImproving] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Track AI-generated content to detect user edits
  const [aiGeneratedBody, setAiGeneratedBody] = useState("");
  const [aiGeneratedSubject, setAiGeneratedSubject] = useState("");
  const isEditedAfterGeneration = aiGeneratedBody && (htmlBody !== aiGeneratedBody || subject !== aiGeneratedSubject);

  // Save as template dialog
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("primo_contatto");
  const [customCategory, setCustomCategory] = useState("");

  // Mini-dialog for unknown email
  const [unknownEmailDialog, setUnknownEmailDialog] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [manualContactName, setManualContactName] = useState("");
  const [manualCompanyName, setManualCompanyName] = useState("");

  // AI style learning dialog
  const [learningDialogOpen, setLearningDialogOpen] = useState(false);
  const [editAnalysis, setEditAnalysis] = useState<EditAnalysis | null>(null);
  const [pendingSend, setPendingSend] = useState(false);

  const enqueueCampaign = useEnqueueCampaign();
  const { processing, startProcessing } = useProcessQueue();
  const saveDraft = useSaveEmailDraft();
  const { data: templates = [] } = useEmailTemplates();

  const recipientsWithEmail = recipients.filter((r) => r.email);

  const lookupEmailInDB = async (email: string) => {
    // Check partners
    const { data: partner } = await supabase
      .from("partners")
      .select("id, company_name, company_alias, country_code, city, email")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (partner) return { found: true, companyName: partner.company_alias || partner.company_name, contactName: "", countryCode: partner.country_code || "", city: partner.city || "", partnerId: partner.id };

    // Check partner_contacts
    const { data: pc } = await supabase
      .from("partner_contacts")
      .select("partner_id, name, contact_alias, email, partners(company_name, company_alias, country_code, city)")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (pc) {
      const p = pc.partners as any;
      return { found: true, companyName: p?.company_alias || p?.company_name || "", contactName: pc.contact_alias || pc.name || "", countryCode: p?.country_code || "", city: p?.city || "", partnerId: pc.partner_id };
    }

    // Check imported_contacts
    const { findContactByEmail } = await import("@/data/contacts");
    const ic = await findContactByEmail(email);
    if (ic) return { found: true, companyName: ic.company_alias || ic.company_name || "", contactName: ic.contact_alias || ic.name || "", countryCode: ic.country || "", city: "", partnerId: "" };

    // Check business_cards
    const { data: bc } = await supabase
      .from("business_cards")
      .select("company_name, contact_name, location, matched_partner_id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (bc) return { found: true, companyName: bc.company_name || "", contactName: bc.contact_name || "", countryCode: "", city: bc.location || "", partnerId: bc.matched_partner_id || "" };

    return { found: false, companyName: "", contactName: "", countryCode: "", city: "", partnerId: "" };
  };

  const addManualEmail = async () => {
    const email = manualEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Email non valida"); return; }
    if (recipients.some(r => r.email?.toLowerCase() === email)) { toast.error("Destinatario già presente"); setManualEmail(""); return; }

    const result = await lookupEmailInDB(email);
    if (result.found) {
      addRecipient({
        partnerId: result.partnerId || crypto.randomUUID(),
        companyName: result.companyName,
        email,
        contactName: result.contactName || email.split("@")[0],
        countryCode: result.countryCode,
        countryName: "",
        city: result.city,
        isEnriched: true,
      });
      toast.success(`✅ Trovato: ${result.companyName || result.contactName}`);
      setManualEmail("");
    } else {
      // Not found — show dialog
      setPendingEmail(email);
      setManualContactName("");
      setManualCompanyName(email.split("@")[1]?.split(".")[0] || "");
      setUnknownEmailDialog(true);
    }
  };

  const confirmUnknownEmail = () => {
    if (!manualContactName.trim() || !manualCompanyName.trim()) {
      toast.error("Nome e azienda sono obbligatori");
      return;
    }
    addRecipient({
      partnerId: crypto.randomUUID(),
      companyName: manualCompanyName.trim(),
      email: pendingEmail,
      contactName: manualContactName.trim(),
      countryCode: "",
      countryName: "",
      city: "",
      isEnriched: false,
    });
    setManualEmail("");
    setUnknownEmailDialog(false);
    toast.info("Destinatario aggiunto manualmente");
  };

  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const isValidUrl = (url: string) => {
    try { return ['http:', 'https:'].includes(new URL(url).protocol); }
    catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return false; }
  };

  const addLink = () => {
    if (!newLinkLabel || !newLinkUrl) return;
    if (!isValidUrl(newLinkUrl)) { toast.error("URL non valido"); return; }
    setEmailLinks((prev) => [...prev, { label: newLinkLabel, url: newLinkUrl }]);
    setNewLinkLabel(""); setNewLinkUrl("");
  };

  const buildFinalHtml = (body: string, partner: any, contactName: string) => {
    const companyDisplay = partner.companyAlias || partner.company_alias || partner.companyName || partner.company_name || "";
    const contactDisplay = partner.contactAlias || partner.contact_alias || contactName || "";
    let html = body
      .replace(/\{\{company_name\}\}/g, escapeHtml(companyDisplay))
      .replace(/\{\{contact_name\}\}/g, escapeHtml(contactDisplay))
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

  const handleAIGenerate = async (config: OracleConfig) => {
    if (!goal && !baseProposal && !config.emailType && !config.customGoal) {
      toast.error("Seleziona un tipo di email dall'Oracolo oppure scrivi un obiettivo nel campo Goal");
      return;
    }
    setAiGenerating(true);
    try {
      // Combine email type prompt + custom goal
      const typePart = config.emailType?.prompt || "";
      const goalPart = config.customGoal || goal || "";
      const effectiveGoal = [typePart, goalPart].filter(Boolean).join("\n\nISTRUZIONI SPECIFICHE DELL'UTENTE:\n");

      // Check if we have a single recipient with a real partnerId (not a random UUID)
      const singleRecipient = recipientsWithEmail.length === 1 ? recipientsWithEmail[0] : null;
      const hasRealPartnerId = singleRecipient?.partnerId && singleRecipient.partnerId.length === 36 && singleRecipient.isEnriched;

      const data = await invokeEdge<any>("generate-content", { body: {
          action: "email",
          goal: effectiveGoal,
          base_proposal: baseProposal,
          language: "italiano",
          document_ids: documents.map((d) => d.id),
          reference_urls: referenceLinks,
          quality: "standard",
          activity_id: "00000000-0000-0000-0000-000000000000",
          standalone: true,
          partner_id: hasRealPartnerId ? singleRecipient!.partnerId : null,
          recipient_count: recipientsWithEmail.length,
          recipient_countries: [...new Set(recipients.map((r) => r.countryName))].join(", "),
          recipient_name: singleRecipient ? (singleRecipient.contactAlias || singleRecipient.contactName || "") : "",
          recipient_company: singleRecipient ? (singleRecipient.companyAlias || singleRecipient.companyName || "") : "",
          oracle_type: config.emailType?.id || null,
          oracle_tone: config.tone,
          use_kb: config.useKB,
          deep_search: config.deepSearch,
        }, context: "EmailComposer.generate_email" });
      if (data?.subject) { setSubject(data.subject); setAiGeneratedSubject(data.subject); }
      if (data?.body) { setHtmlBody(data.body); setAiGeneratedBody(data.body); }
      toast.success("Email generata con Oracolo 🔮");
    } catch (err: any) {
      toast.error("Errore generazione AI: " + (err.message || "Sconosciuto"));
    } finally { setAiGenerating(false); }
  };

  const handleAIImprove = async (config: OracleConfig) => {
    if (!htmlBody.trim()) {
      toast.error("Scrivi prima il testo dell'email da migliorare");
      return;
    }
    setAiImproving(true);
    try {
      const data = await invokeEdge<any>("improve-email", { body: {
          subject, html_body: htmlBody,
          recipient_count: recipientsWithEmail.length,
          recipient_countries: [...new Set(recipients.map((r) => r.countryName))].join(", "),
          oracle_tone: config.tone,
          use_kb: config.useKB,
        }, context: "EmailComposer.improve_email" });
      if (data?.subject) setSubject(data.subject);
      if (data?.body) setHtmlBody(data.body);
      toast.success("Email migliorata con AI 🪄");
    } catch (err: any) {
      toast.error("Errore miglioramento: " + (err.message || "Sconosciuto"));
    } finally { setAiImproving(false); }
  };

  const handleLoadTemplate = (name: string, _url: string) => {
    setSubject(name);
    toast.info("Template caricato: " + name);
  };

  const handleSaveAsTemplate = async () => {
    const finalCategory = templateCategory === "__new__" ? customCategory.trim() : templateCategory;
    if (!templateName.trim() || !finalCategory) {
      toast.error("Inserisci nome e categoria");
      return;
    }
    try {
      // Save as email_templates entry (reuse existing table)
      await insertEmailDraft({
        subject,
        html_body: htmlBody,
        category: finalCategory,
        recipient_type: "template",
        status: "template",
        total_count: 0,
      } as any);
      if (error) throw error;
      setSaveTemplateOpen(false);
      setTemplateName("");
      setTemplateCategory("primo_contatto");
      setCustomCategory("");
      toast.success(`Template "${templateName}" salvato`);
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore nel salvataggio template"); }
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
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore nel salvataggio"); }
  };

  const executeEnqueue = async () => {
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
        partner_id: r.partnerId, email: r.email!, name: r.companyAlias || r.companyName,
        subject: subject.replace(/\{\{company_name\}\}/g, r.companyAlias || r.companyName).replace(/\{\{contact_name\}\}/g, r.contactAlias || r.contactName || "").replace(/\{\{city\}\}/g, r.city || "").replace(/\{\{country\}\}/g, r.countryName || ""),
        html: buildFinalHtml(htmlBody, r, r.contactAlias || r.contactName || ""),
      }));
      await enqueueCampaign.mutateAsync({ draftId, recipients: resolvedRecipients, delaySeconds: 5 });
      setActiveDraftId(draftId);
      setActiveQueueStatus("processing");
      startProcessing(draftId).then(() => {
        setActiveQueueStatus("completed");
      }).catch(() => {
        setActiveQueueStatus("completed");
      });
    } catch (err) {
      log.error("enqueue failed", { message: err instanceof Error ? err.message : String(err) });
      toast.error("Errore nell'accodamento");
    }
    setSending(false);
  };

  const handleEnqueue = async () => {
    if (!subject || !htmlBody) { toast.error("Compila oggetto e corpo email"); return; }
    if (recipientsWithEmail.length === 0) { toast.error("Nessun destinatario con email valida"); return; }

    // If AI-generated content was edited, analyze the diff
    if (isEditedAfterGeneration && aiGeneratedBody) {
      setPendingSend(true);
      try {
        const result = await invokeEdge<EditAnalysis>("analyze-email-edit", {
          body: {
            original_html: aiGeneratedBody,
            edited_html: htmlBody,
            recipient_country: recipients[0]?.countryCode || "",
            email_type: "email",
          },
          context: "EmailComposer.analyzeEdit",
        });
        if (result.significance === "medium" || result.significance === "high") {
          setEditAnalysis(result);
          setLearningDialogOpen(true);
          setPendingSend(false);
          return; // Dialog will handle send
        }
      } catch (err) {
        log.warn("Edit analysis failed, proceeding with send", { error: err instanceof Error ? err.message : String(err) });
      }
      setPendingSend(false);
    }

    await executeEnqueue();
  };

  const templatesByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    templates.forEach((t: any) => { const cat = t.category || "altro"; if (!groups[cat]) groups[cat] = []; groups[cat].push(t); });
    return groups;
  }, [templates]);

  const insertVariable = (v: string) => setHtmlBody(prev => prev + v);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 flex justify-center">
        <div className="flex max-w-[1060px] w-full min-h-0">
        {/* LEFT: email editor */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 p-4 pb-0 w-full overflow-y-auto">
            {/* Recipients bar with manual email input */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              {recipients.map((r, i) => (
                <Badge key={i} variant="secondary" className="gap-1 pl-1.5 pr-1 py-0.5 text-[11px] font-normal">
                  <span className="text-sm leading-none">{getCountryFlag(r.countryCode || "")}</span>
                  <span className="truncate max-w-[180px]">
                    {r.contactAlias || r.contactName
                      ? `${r.contactAlias || r.contactName} · ${r.companyAlias || r.companyName}`
                      : r.companyAlias || r.companyName}
                  </span>
                  <button onClick={() => removeRecipient(i)} className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/10">
                    <X className="w-2.5 h-2.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </Badge>
              ))}
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addManualEmail(); } }}
                onBlur={() => { if (manualEmail.trim()) addManualEmail(); }}
                placeholder={recipients.length === 0 ? "Digita email o usa il picker a sinistra..." : "Aggiungi email..."}
                className="flex-1 min-w-[160px] text-xs bg-transparent outline-none placeholder:text-muted-foreground/50 h-6"
              />
            </div>

            {/* Subject row */}
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-primary shrink-0" />
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Oggetto della email..."
                className="h-9 text-sm font-medium flex-1"
              />
            </div>

            {/* Toolbar — right aligned above textarea (no AI buttons, moved to Oracle) */}
            <div className="flex items-center justify-end gap-1 mb-1.5">
              {/* Variables popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Variabili">
                    <Braces className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="end">
                  <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Inserisci variabile</p>
                  <div className="flex flex-col gap-1">
                    {VARIABLES.map(v => (
                      <button key={v} onClick={() => insertVariable(v)}
                        className="text-xs text-left px-2 py-1.5 rounded hover:bg-muted/50 font-mono text-primary transition-colors">
                        {v}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Links */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative" title="Link">
                    <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    {emailLinks.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary text-primary-foreground text-[8px] rounded-full flex items-center justify-center">{emailLinks.length}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="end">
                  <p className="text-xs font-medium mb-2">Link da includere</p>
                  {emailLinks.map((l, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs bg-muted/30 rounded p-1.5 mb-1">
                      <span className="truncate flex-1">{l.label}</span>
                      <button onClick={() => setEmailLinks(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 hover:bg-destructive/10 rounded">
                        <X className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1 mt-1.5">
                    <Input placeholder="Etichetta" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} className="flex-1 h-7 text-xs" />
                    <Input placeholder="https://..." value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="flex-1 h-7 text-xs" />
                    <Button size="sm" variant="outline" className="h-7 px-1.5" onClick={addLink}><Plus className="w-3 h-3" /></Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Attachments */}
              {templates.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative" title="Allegati">
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                      {selectedAttachments.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary text-primary-foreground text-[8px] rounded-full flex items-center justify-center">{selectedAttachments.length}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="end">
                    <p className="text-xs font-medium mb-2">Allegati</p>
                    {Object.entries(templatesByCategory).map(([cat, files]) => (
                      <div key={cat} className="space-y-0.5">
                        {files.map((t: any) => (
                          <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded hover:bg-muted/30">
                            <input type="checkbox" checked={selectedAttachments.includes(t.id)}
                              onChange={() => setSelectedAttachments(prev => prev.includes(t.id) ? prev.filter(a => a !== t.id) : [...prev, t.id])}
                              className="h-3.5 w-3.5 rounded" />
                            <span className="truncate">{t.file_name}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>
              )}

              {/* Preview toggle */}
              <Button variant={previewOpen ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" title="Anteprima"
                onClick={() => setPreviewOpen(p => !p)}>
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>

            {/* Body editor — visual HTML + source toggle */}
            <HtmlEmailEditor
              value={htmlBody}
              onChange={setHtmlBody}
              placeholder="Scrivi il contenuto della email... Usa variabili come {{company_name}} tramite l'icona { } sopra"
              className="flex-1"
            />

            {/* Preview inline */}
            {previewOpen && (subject || htmlBody) && (
              <div className="mt-3 border border-border/30 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/30">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold">Anteprima</span>
                </div>
                <div className="px-4 py-3 bg-muted/10">
                  <p className="text-sm font-medium mb-1">
                    {subject.replace(/\{\{company_name\}\}/g, "Acme Logistics").replace(/\{\{contact_name\}\}/g, "John Doe").replace(/\{\{city\}\}/g, "Milano").replace(/\{\{country\}\}/g, "Italy") || "Nessun oggetto"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mb-2">A: partner@example.com</p>
                  <div className="text-xs prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(buildFinalHtml(htmlBody, { companyName: "Acme Logistics", city: "Milano", countryName: "Italy" }, "John Doe")),
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="shrink-0 border-t border-border/30 bg-muted/10 px-4 py-2.5 max-w-3xl w-full">
            {activeDraftId ? (
              <CampaignQueueMonitor
                draftId={activeDraftId}
                queueStatus={activeQueueStatus}
                onClose={() => { setActiveDraftId(null); setActiveQueueStatus("idle"); }}
                onStatusChange={(s) => setActiveQueueStatus(s)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={sending} className="gap-1.5 h-9 text-xs">
                  <Save className="w-3.5 h-3.5" /> Bozza
                </Button>
                {isEditedAfterGeneration && (
                  <Button variant="outline" size="sm" onClick={() => { setTemplateName(subject); setSaveTemplateOpen(true); }} className="gap-1.5 h-9 text-xs border-primary/30 text-primary hover:bg-primary/10">
                    <Bookmark className="w-3.5 h-3.5" /> Salva template
                  </Button>
                )}
                <Button size="sm" onClick={handleEnqueue} disabled={sending || processing || recipientsWithEmail.length === 0} className="gap-1.5 h-9 text-xs flex-1">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sending ? "Preparazione..." : `Invia a ${recipientsWithEmail.length} destinatari`}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Oracle Panel */}
        <div className="w-[260px] shrink-0 h-full">
          <OraclePanel
            onGenerate={handleAIGenerate}
            onImprove={handleAIImprove}
            onLoadTemplate={handleLoadTemplate}
            onInsertImage={(url) => {
              const imgTag = `<div style="margin:12px 0"><img src="${url}" alt="Image" style="max-width:100%;height:auto;border-radius:4px" /></div>`;
              setHtmlBody(prev => prev + imgTag);
              toast.success("Immagine inserita nel corpo email");
            }}
            generating={aiGenerating}
            improving={aiImproving}
            hasBody={!!htmlBody.trim()}
          />
        </div>
      </div>
      </div>

      {/* Unknown email mini-dialog */}
      <Dialog open={unknownEmailDialog} onOpenChange={setUnknownEmailDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Destinatario non trovato</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            L'indirizzo <strong>{pendingEmail}</strong> non è presente nel database. Inserisci le informazioni per procedere.
          </p>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">Nome contatto *</Label>
              <Input value={manualContactName} onChange={e => setManualContactName(e.target.value)} placeholder="Mario Rossi" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Nome azienda *</Label>
              <Input value={manualCompanyName} onChange={e => setManualCompanyName(e.target.value)} placeholder="Acme Srl" className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setUnknownEmailDialog(false)}>Annulla</Button>
            <Button size="sm" className="h-8 text-xs" onClick={confirmUnknownEmail}>Aggiungi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as template dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Salva come template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">Nome template *</Label>
              <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Es. Follow-up trasporti aerei" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Tipologia *</Label>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primo_contatto">🤝 Primo contatto</SelectItem>
                  <SelectItem value="follow_up">🔄 Follow-up</SelectItem>
                  <SelectItem value="richiesta_info">📋 Richiesta info</SelectItem>
                  <SelectItem value="proposta_servizi">📦 Proposta servizi</SelectItem>
                  <SelectItem value="partnership">🤝 Partnership</SelectItem>
                  <SelectItem value="network_espresso">✈️ Network espresso</SelectItem>
                  <SelectItem value="__new__">➕ Nuova categoria...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {templateCategory === "__new__" && (
              <div>
                <Label className="text-xs">Nome nuova categoria *</Label>
                <Input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Es. Post-fiera" className="h-8 text-sm" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSaveTemplateOpen(false)}>Annulla</Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSaveAsTemplate}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Style Learning Dialog */}
      {editAnalysis && (
        <EmailEditLearningDialog
          open={learningDialogOpen}
          onClose={() => { setLearningDialogOpen(false); setEditAnalysis(null); }}
          analysis={editAnalysis}
          onSendAndSave={() => { setLearningDialogOpen(false); setEditAnalysis(null); executeEnqueue(); }}
          onSendWithoutSaving={() => { setLearningDialogOpen(false); setEditAnalysis(null); executeEnqueue(); }}
        />
      )}
    </div>
  );
}
