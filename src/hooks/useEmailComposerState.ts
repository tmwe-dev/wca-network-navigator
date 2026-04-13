/**
 * useEmailComposerState — All state + async logic for EmailComposer, extracted from the monolith.
 */
import { useReducer, useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { createLogger } from "@/lib/log";
import { toast } from "sonner";
import { useMission } from "@/contexts/MissionContext";
import { useSaveEmailDraft } from "@/hooks/useEmailDrafts";
import { useEmailTemplates } from "@/hooks/useCampaignJobs";
import { useEnqueueCampaign, useProcessQueue } from "@/hooks/useEmailCampaignQueue";
import { insertEmailDraft, insertEmailDraftReturning } from "@/data/emailDrafts";
import { findPartnerByEmail } from "@/data/partners";
import { findPartnerContactByEmail } from "@/data/partnerRelations";
import { findBusinessCardByEmail } from "@/data/businessCards";
import { insertEditPattern } from "@/data/aiEditPatterns";
import type { OracleConfig } from "@/components/email/OraclePanel";
import type { EditAnalysis } from "@/components/email/EmailEditLearningDialog";

const log = createLogger("EmailComposer");

export interface LinkItem { label: string; url: string }

export interface EmailTemplate {
  id: string;
  name: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  category: string | null;
}

interface EmailComposerLocationState {
  prefilledRecipient?: {
    partnerId?: string;
    company?: string;
    companyName?: string;
    companyAlias?: string;
    contactId?: string;
    name?: string;
    contactName?: string;
    contactAlias?: string;
    email?: string;
    city?: string;
    countryName?: string;
    countryCode?: string;
  };
  prefilledSubject?: string;
  prefilledBody?: string;
}

interface GenerateContentResponse {
  body?: string;
  subject?: string;
}

interface ImproveEmailResponse {
  body?: string;
  subject?: string;
}

interface PartnerPreviewData {
  companyAlias?: string;
  company_alias?: string;
  companyName?: string;
  company_name?: string;
  contactAlias?: string;
  contact_alias?: string;
  city?: string;
  countryName?: string;
  country_name?: string;
}

// ── State shape ──────────────────────────────────────────────────────

interface EmailState {
  subject: string;
  htmlBody: string;
  selectedAttachments: string[];
  emailLinks: LinkItem[];
  newLinkLabel: string;
  newLinkUrl: string;
}

interface UIState {
  manualEmail: string;
  previewOpen: boolean;
  unknownEmailDialog: boolean;
  pendingEmail: string;
  manualContactName: string;
  manualCompanyName: string;
}

interface AIState {
  aiGenerating: boolean;
  aiImproving: boolean;
  aiGeneratedBody: string;
  aiGeneratedSubject: string;
  learningDialogOpen: boolean;
  editAnalysis: EditAnalysis | null;
  pendingSend: boolean;
}

interface TemplateState {
  saveTemplateOpen: boolean;
  templateName: string;
  templateCategory: string;
  customCategory: string;
}

interface QueueState {
  sending: boolean;
  activeDraftId: string | null;
  activeQueueStatus: string;
}

export interface ComposerState {
  email: EmailState;
  ui: UIState;
  ai: AIState;
  template: TemplateState;
  queue: QueueState;
}

// ── Actions ──────────────────────────────────────────────────────────

type Action =
  | { type: "SET_SUBJECT"; payload: string }
  | { type: "SET_HTML_BODY"; payload: string }
  | { type: "SET_ATTACHMENTS"; payload: string[] }
  | { type: "SET_EMAIL_LINKS"; payload: LinkItem[] }
  | { type: "SET_NEW_LINK_LABEL"; payload: string }
  | { type: "SET_NEW_LINK_URL"; payload: string }
  | { type: "SET_MANUAL_EMAIL"; payload: string }
  | { type: "TOGGLE_PREVIEW" }
  | { type: "SET_UNKNOWN_DIALOG"; payload: boolean }
  | { type: "SET_PENDING_EMAIL"; payload: string }
  | { type: "SET_MANUAL_CONTACT_NAME"; payload: string }
  | { type: "SET_MANUAL_COMPANY_NAME"; payload: string }
  | { type: "SET_AI_GENERATING"; payload: boolean }
  | { type: "SET_AI_IMPROVING"; payload: boolean }
  | { type: "SET_AI_GENERATED"; payload: { body: string; subject: string } }
  | { type: "SET_LEARNING_DIALOG"; payload: boolean }
  | { type: "SET_EDIT_ANALYSIS"; payload: EditAnalysis | null }
  | { type: "SET_PENDING_SEND"; payload: boolean }
  | { type: "SET_SAVE_TEMPLATE_OPEN"; payload: boolean }
  | { type: "SET_TEMPLATE_NAME"; payload: string }
  | { type: "SET_TEMPLATE_CATEGORY"; payload: string }
  | { type: "SET_CUSTOM_CATEGORY"; payload: string }
  | { type: "SET_SENDING"; payload: boolean }
  | { type: "SET_ACTIVE_DRAFT"; payload: { id: string | null; status: string } }
  | { type: "SET_QUEUE_STATUS"; payload: string }
  | { type: "RESET_TEMPLATE_FORM" };

const initialState: ComposerState = {
  email: { subject: "", htmlBody: "", selectedAttachments: [], emailLinks: [], newLinkLabel: "", newLinkUrl: "" },
  ui: { manualEmail: "", previewOpen: false, unknownEmailDialog: false, pendingEmail: "", manualContactName: "", manualCompanyName: "" },
  ai: { aiGenerating: false, aiImproving: false, aiGeneratedBody: "", aiGeneratedSubject: "", learningDialogOpen: false, editAnalysis: null, pendingSend: false },
  template: { saveTemplateOpen: false, templateName: "", templateCategory: "primo_contatto", customCategory: "" },
  queue: { sending: false, activeDraftId: null, activeQueueStatus: "idle" },
};

function reducer(state: ComposerState, action: Action): ComposerState {
  switch (action.type) {
    case "SET_SUBJECT": return { ...state, email: { ...state.email, subject: action.payload } };
    case "SET_HTML_BODY": return { ...state, email: { ...state.email, htmlBody: action.payload } };
    case "SET_ATTACHMENTS": return { ...state, email: { ...state.email, selectedAttachments: action.payload } };
    case "SET_EMAIL_LINKS": return { ...state, email: { ...state.email, emailLinks: action.payload } };
    case "SET_NEW_LINK_LABEL": return { ...state, email: { ...state.email, newLinkLabel: action.payload } };
    case "SET_NEW_LINK_URL": return { ...state, email: { ...state.email, newLinkUrl: action.payload } };
    case "SET_MANUAL_EMAIL": return { ...state, ui: { ...state.ui, manualEmail: action.payload } };
    case "TOGGLE_PREVIEW": return { ...state, ui: { ...state.ui, previewOpen: !state.ui.previewOpen } };
    case "SET_UNKNOWN_DIALOG": return { ...state, ui: { ...state.ui, unknownEmailDialog: action.payload } };
    case "SET_PENDING_EMAIL": return { ...state, ui: { ...state.ui, pendingEmail: action.payload } };
    case "SET_MANUAL_CONTACT_NAME": return { ...state, ui: { ...state.ui, manualContactName: action.payload } };
    case "SET_MANUAL_COMPANY_NAME": return { ...state, ui: { ...state.ui, manualCompanyName: action.payload } };
    case "SET_AI_GENERATING": return { ...state, ai: { ...state.ai, aiGenerating: action.payload } };
    case "SET_AI_IMPROVING": return { ...state, ai: { ...state.ai, aiImproving: action.payload } };
    case "SET_AI_GENERATED": return { ...state, ai: { ...state.ai, aiGeneratedBody: action.payload.body, aiGeneratedSubject: action.payload.subject } };
    case "SET_LEARNING_DIALOG": return { ...state, ai: { ...state.ai, learningDialogOpen: action.payload } };
    case "SET_EDIT_ANALYSIS": return { ...state, ai: { ...state.ai, editAnalysis: action.payload } };
    case "SET_PENDING_SEND": return { ...state, ai: { ...state.ai, pendingSend: action.payload } };
    case "SET_SAVE_TEMPLATE_OPEN": return { ...state, template: { ...state.template, saveTemplateOpen: action.payload } };
    case "SET_TEMPLATE_NAME": return { ...state, template: { ...state.template, templateName: action.payload } };
    case "SET_TEMPLATE_CATEGORY": return { ...state, template: { ...state.template, templateCategory: action.payload } };
    case "SET_CUSTOM_CATEGORY": return { ...state, template: { ...state.template, customCategory: action.payload } };
    case "SET_SENDING": return { ...state, queue: { ...state.queue, sending: action.payload } };
    case "SET_ACTIVE_DRAFT": return { ...state, queue: { ...state.queue, activeDraftId: action.payload.id, activeQueueStatus: action.payload.status } };
    case "SET_QUEUE_STATUS": return { ...state, queue: { ...state.queue, activeQueueStatus: action.payload } };
    case "RESET_TEMPLATE_FORM": return { ...state, template: { saveTemplateOpen: false, templateName: "", templateCategory: "primo_contatto", customCategory: "" } };
    default: return state;
  }
}

// ── Helpers (pure) ───────────────────────────────────────────────────

const escapeHtml = (str: string) =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const isValidUrl = (url: string) => {
  try { return ["http:", "https:"].includes(new URL(url).protocol); }
  catch { return false; }
};

export const VARIABLES = ["{{company_name}}", "{{contact_name}}", "{{city}}", "{{country}}"];

// ── Hook ─────────────────────────────────────────────────────────────

export function useEmailComposerState() {
  const mission = useMission();
  const { goal, baseProposal, documents, referenceLinks, recipients, removeRecipient, addRecipient } = mission;
  const location = useLocation();
  const navigate = useNavigate();
  const saveDraft = useSaveEmailDraft();
  const { data: templates = [] } = useEmailTemplates();
  const enqueueCampaign = useEnqueueCampaign();
  const { processing, startProcessing } = useProcessQueue();

  const [state, dispatch] = useReducer(reducer, initialState);
  const { email, ui, ai, template, _queue } = state;

  const recipientsWithEmail = recipients.filter((r) => r.email);
  const isEditedAfterGeneration = ai.aiGeneratedBody && (email.htmlBody !== ai.aiGeneratedBody || email.subject !== ai.aiGeneratedSubject);

  const templatesByCategory = useMemo(() => {
    const groups: Record<string, EmailTemplate[]> = {};
    (templates as EmailTemplate[]).forEach((t) => { const cat = t.category || "altro"; if (!groups[cat]) groups[cat] = []; groups[cat].push(t); });
    return groups;
  }, [templates]);

  // ── Prefill from navigation state ──
  useEffect(() => {
    const s = location.state as EmailComposerLocationState | null;
    if (!s) return;
    if (s.prefilledRecipient) {
      const r = s.prefilledRecipient;
      addRecipient({
        partnerId: r.partnerId || "", companyName: r.company || r.companyName || "",
        companyAlias: r.companyAlias, contactId: r.contactId,
        contactName: r.name || r.contactName || "", contactAlias: r.contactAlias,
        email: r.email || null, city: r.city || "", countryName: r.countryName || "",
        countryCode: r.countryCode, isEnriched: false,
      });
    }
    if (s.prefilledSubject) dispatch({ type: "SET_SUBJECT", payload: s.prefilledSubject });
    if (s.prefilledBody) {
      const escaped = s.prefilledBody.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      dispatch({ type: "SET_HTML_BODY", payload: `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escaped}</pre>` });
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, []);

  // ── DB Lookup ──
  const lookupEmailInDB = useCallback(async (emailAddr: string) => {
    const partner = await findPartnerByEmail(emailAddr);
    if (partner) return { found: true, companyName: partner.company_alias || partner.company_name, contactName: "", countryCode: partner.country_code || "", city: partner.city || "", partnerId: partner.id };
    const pc = await findPartnerContactByEmail(emailAddr);
    if (pc) {
      const p = pc.partners as { company_alias?: string | null; company_name?: string | null; country_code?: string | null; city?: string | null } | null;
      return { found: true, companyName: p?.company_alias || p?.company_name || "", contactName: (pc as { contact_alias?: string }).contact_alias || pc.name || "", countryCode: p?.country_code || "", city: p?.city || "", partnerId: pc.partner_id };
    }
    const { findContactByEmail } = await import("@/data/contacts");
    const ic = await findContactByEmail(emailAddr);
    if (ic) return { found: true, companyName: ic.company_alias || ic.company_name || "", contactName: ic.contact_alias || ic.name || "", countryCode: ic.country || "", city: "", partnerId: "" };
    const bc = await findBusinessCardByEmail(emailAddr);
    if (bc) return { found: true, companyName: bc.company_name || "", contactName: bc.contact_name || "", countryCode: "", city: bc.location || "", partnerId: bc.matched_partner_id || "" };
    return { found: false, companyName: "", contactName: "", countryCode: "", city: "", partnerId: "" };
  }, []);

  // ── Named actions ──

  const setSubject = useCallback((v: string) => dispatch({ type: "SET_SUBJECT", payload: v }), []);
  const setHtmlBody = useCallback((v: string) => dispatch({ type: "SET_HTML_BODY", payload: v }), []);
  const setManualEmail = useCallback((v: string) => dispatch({ type: "SET_MANUAL_EMAIL", payload: v }), []);
  const togglePreview = useCallback(() => dispatch({ type: "TOGGLE_PREVIEW" }), []);
  const setAttachments = useCallback((v: string[]) => dispatch({ type: "SET_ATTACHMENTS", payload: v }), []);
  const setEmailLinks = useCallback((v: LinkItem[]) => dispatch({ type: "SET_EMAIL_LINKS", payload: v }), []);
  const setNewLinkLabel = useCallback((v: string) => dispatch({ type: "SET_NEW_LINK_LABEL", payload: v }), []);
  const setNewLinkUrl = useCallback((v: string) => dispatch({ type: "SET_NEW_LINK_URL", payload: v }), []);
  const insertVariable = useCallback((v: string) => dispatch({ type: "SET_HTML_BODY", payload: email.htmlBody + v }), [email.htmlBody]);

  const addLink = useCallback(() => {
    if (!email.newLinkLabel || !email.newLinkUrl) return;
    if (!isValidUrl(email.newLinkUrl)) { toast.error("URL non valido"); return; }
    dispatch({ type: "SET_EMAIL_LINKS", payload: [...email.emailLinks, { label: email.newLinkLabel, url: email.newLinkUrl }] });
    dispatch({ type: "SET_NEW_LINK_LABEL", payload: "" });
    dispatch({ type: "SET_NEW_LINK_URL", payload: "" });
  }, [email.newLinkLabel, email.newLinkUrl, email.emailLinks]);

  const removeLink = useCallback((idx: number) => {
    dispatch({ type: "SET_EMAIL_LINKS", payload: email.emailLinks.filter((_, i) => i !== idx) });
  }, [email.emailLinks]);

  const toggleAttachment = useCallback((id: string) => {
    dispatch({ type: "SET_ATTACHMENTS", payload: email.selectedAttachments.includes(id) ? email.selectedAttachments.filter(a => a !== id) : [...email.selectedAttachments, id] });
  }, [email.selectedAttachments]);

  // ── Build final HTML ──
  const buildFinalHtml = useCallback((body: string, partner: PartnerPreviewData, contactName: string) => {
    const companyDisplay = partner.companyAlias || partner.company_alias || partner.companyName || partner.company_name || "";
    const contactDisplay = partner.contactAlias || partner.contact_alias || contactName || "";
    let html = body
      .replace(/\{\{company_name\}\}/g, escapeHtml(companyDisplay))
      .replace(/\{\{contact_name\}\}/g, escapeHtml(contactDisplay))
      .replace(/\{\{city\}\}/g, escapeHtml(partner.city || ""))
      .replace(/\{\{country\}\}/g, escapeHtml(partner.countryName || partner.country_name || ""));
    const validLinks = email.emailLinks.filter((l) => isValidUrl(l.url));
    if (validLinks.length > 0) {
      html += `<br/><br/><p><strong>Link utili:</strong></p><ul>`;
      validLinks.forEach((l) => { html += `<li><a href="${encodeURI(l.url)}" target="_blank">${escapeHtml(l.label)}</a></li>`; });
      html += `</ul>`;
    }
    const attachedTemplates = (templates as EmailTemplate[]).filter((t) => email.selectedAttachments.includes(t.id));
    if (attachedTemplates.length > 0) {
      html += `<br/><p><strong>Allegati:</strong></p><ul>`;
      attachedTemplates.forEach((t) => { html += `<li><a href="${encodeURI(t.file_url)}" target="_blank">${escapeHtml(t.file_name)}</a></li>`; });
      html += `</ul>`;
    }
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','strong','em','ul','ol','li','a','h1','h2','h3','h4','div','span','table','tr','td','th','thead','tbody','img','hr','blockquote','pre','code','b','i','u'],
      ALLOWED_ATTR: ['href','target','src','alt','style','class','width','height','colspan','rowspan'],
    });
  }, [email.emailLinks, email.selectedAttachments, templates]);

  // ── Add manual email ──
  const addManualEmail = useCallback(async () => {
    const addr = ui.manualEmail.trim().toLowerCase();
    if (!addr) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { toast.error("Email non valida"); return; }
    if (recipients.some(r => r.email?.toLowerCase() === addr)) { toast.error("Destinatario già presente"); dispatch({ type: "SET_MANUAL_EMAIL", payload: "" }); return; }
    const result = await lookupEmailInDB(addr);
    if (result.found) {
      addRecipient({ partnerId: result.partnerId || crypto.randomUUID(), companyName: result.companyName, email: addr, contactName: result.contactName || addr.split("@")[0], countryCode: result.countryCode, countryName: "", city: result.city, isEnriched: true });
      toast.success(`✅ Trovato: ${result.companyName || result.contactName}`);
      dispatch({ type: "SET_MANUAL_EMAIL", payload: "" });
    } else {
      dispatch({ type: "SET_PENDING_EMAIL", payload: addr });
      dispatch({ type: "SET_MANUAL_CONTACT_NAME", payload: "" });
      dispatch({ type: "SET_MANUAL_COMPANY_NAME", payload: addr.split("@")[1]?.split(".")[0] || "" });
      dispatch({ type: "SET_UNKNOWN_DIALOG", payload: true });
    }
  }, [ui.manualEmail, recipients, addRecipient, lookupEmailInDB]);

  const confirmUnknownEmail = useCallback(() => {
    if (!ui.manualContactName.trim() || !ui.manualCompanyName.trim()) { toast.error("Nome e azienda sono obbligatori"); return; }
    addRecipient({ partnerId: crypto.randomUUID(), companyName: ui.manualCompanyName.trim(), email: ui.pendingEmail, contactName: ui.manualContactName.trim(), countryCode: "", countryName: "", city: "", isEnriched: false });
    dispatch({ type: "SET_MANUAL_EMAIL", payload: "" });
    dispatch({ type: "SET_UNKNOWN_DIALOG", payload: false });
    toast.info("Destinatario aggiunto manualmente");
  }, [ui.manualContactName, ui.manualCompanyName, ui.pendingEmail, addRecipient]);

  // ── AI Generate ──
  const handleAIGenerate = useCallback(async (config: OracleConfig) => {
    if (!goal && !baseProposal && !config.emailType && !config.customGoal) {
      toast.error("Seleziona un tipo di email dall'Oracolo oppure scrivi un obiettivo nel campo Goal");
      return;
    }
    dispatch({ type: "SET_AI_GENERATING", payload: true });
    try {
      const typePart = config.emailType?.prompt || "";
      const goalPart = config.customGoal || goal || "";
      const effectiveGoal = [typePart, goalPart].filter(Boolean).join("\n\nISTRUZIONI SPECIFICHE DELL'UTENTE:\n");
      const singleRecipient = recipientsWithEmail.length === 1 ? recipientsWithEmail[0] : null;
      const hasRealPartnerId = singleRecipient?.partnerId && singleRecipient.partnerId.length === 36 && singleRecipient.isEnriched;
      const data = await invokeEdge<GenerateContentResponse>("generate-content", { body: {
        action: "email", goal: effectiveGoal, base_proposal: baseProposal, language: "italiano",
        document_ids: documents.map((d) => d.id), reference_urls: referenceLinks, quality: "standard",
        activity_id: "00000000-0000-0000-0000-000000000000", standalone: true,
        partner_id: hasRealPartnerId ? singleRecipient!.partnerId : null,
        recipient_count: recipientsWithEmail.length,
        recipient_countries: [...new Set(recipients.map((r) => r.countryName))].join(", "),
        recipient_name: singleRecipient ? (singleRecipient.contactAlias || singleRecipient.contactName || "") : "",
        recipient_company: singleRecipient ? (singleRecipient.companyAlias || singleRecipient.companyName || "") : "",
        oracle_type: config.emailType?.id || null, oracle_tone: config.tone, use_kb: config.useKB, deep_search: config.deepSearch,
      }, context: "EmailComposer.generate_email" });
      if (data?.subject) { dispatch({ type: "SET_SUBJECT", payload: data.subject }); }
      if (data?.body) { dispatch({ type: "SET_HTML_BODY", payload: data.body }); }
      if (data?.subject || data?.body) {
        dispatch({ type: "SET_AI_GENERATED", payload: { body: data?.body || "", subject: data?.subject || "" } });
      }
      toast.success("Email generata con Oracolo 🔮");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sconosciuto";
      toast.error("Errore generazione AI: " + message);
    } finally { dispatch({ type: "SET_AI_GENERATING", payload: false }); }
  }, [goal, baseProposal, documents, referenceLinks, recipients, recipientsWithEmail]);

  // ── AI Improve ──
  const handleAIImprove = useCallback(async (config: OracleConfig) => {
    if (!email.htmlBody.trim()) { toast.error("Scrivi prima il testo dell'email da migliorare"); return; }
    dispatch({ type: "SET_AI_IMPROVING", payload: true });
    try {
      const data = await invokeEdge<ImproveEmailResponse>("improve-email", { body: {
        subject: email.subject, html_body: email.htmlBody,
        recipient_count: recipientsWithEmail.length,
        recipient_countries: [...new Set(recipients.map((r) => r.countryName))].join(", "),
        oracle_tone: config.tone, use_kb: config.useKB,
      }, context: "EmailComposer.improve_email" });
      if (data?.subject) dispatch({ type: "SET_SUBJECT", payload: data.subject });
      if (data?.body) dispatch({ type: "SET_HTML_BODY", payload: data.body });
      dispatch({ type: "SET_AI_GENERATED", payload: { body: data?.body || email.htmlBody, subject: data?.subject || email.subject } });
      toast.success("Email migliorata con AI 🪄");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sconosciuto";
      toast.error("Errore miglioramento: " + message);
    } finally { dispatch({ type: "SET_AI_IMPROVING", payload: false }); }
  }, [email.subject, email.htmlBody, recipientsWithEmail, recipients]);

  // ── Templates ──
  const handleLoadTemplate = useCallback(async (name: string, url: string) => {
    dispatch({ type: "SET_SUBJECT", payload: name });
    if (url) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const html = await res.text();
        dispatch({ type: "SET_HTML_BODY", payload: html });
        toast.success("Template caricato: " + name);
      } catch (err: unknown) {
        log.warn("template body fetch failed", { error: err instanceof Error ? err.message : String(err) });
        toast.error("Impossibile caricare il body del template");
      }
    } else {
      toast.info("Template caricato (solo oggetto): " + name);
    }
  }, []);

  const handleSaveAsTemplate = useCallback(async () => {
    const finalCategory = template.templateCategory === "__new__" ? template.customCategory.trim() : template.templateCategory;
    if (!template.templateName.trim() || !finalCategory) { toast.error("Inserisci nome e categoria"); return; }
    try {
      await insertEmailDraft({ subject: email.subject, html_body: email.htmlBody, category: finalCategory, recipient_type: "template", status: "template", total_count: 0 });
      dispatch({ type: "RESET_TEMPLATE_FORM" });
      toast.success(`Template "${template.templateName}" salvato`);
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore nel salvataggio template"); }
  }, [template, email.subject, email.htmlBody]);

  const openSaveTemplate = useCallback(() => {
    dispatch({ type: "SET_TEMPLATE_NAME", payload: email.subject });
    dispatch({ type: "SET_SAVE_TEMPLATE_OPEN", payload: true });
  }, [email.subject]);

  // ── Save Draft ──
  const handleSaveDraft = useCallback(async () => {
    try {
      await saveDraft.mutateAsync({
        subject: email.subject, html_body: email.htmlBody, category: "altro",
        recipient_type: "partner", recipient_filter: { partner_ids: recipients.map((r) => r.partnerId) },
        attachment_ids: email.selectedAttachments, link_urls: email.emailLinks,
        status: "draft", total_count: recipientsWithEmail.length,
      });
      toast.success("Bozza salvata");
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore nel salvataggio"); }
  }, [saveDraft, email, recipients, recipientsWithEmail]);

  // ── Enqueue / Send ──
  const executeEnqueue = useCallback(async () => {
    dispatch({ type: "SET_SENDING", payload: true });
    try {
      const savedDraft = await insertEmailDraftReturning({
        subject: email.subject, html_body: email.htmlBody, category: "altro",
        recipient_type: "partner", recipient_filter: { partner_ids: recipients.map((r) => r.partnerId) },
        attachment_ids: email.selectedAttachments, link_urls: email.emailLinks,
        status: "queued", total_count: recipientsWithEmail.length,
      });
      const draftId = (savedDraft as unknown as { id: string }).id;
      const resolvedRecipients = recipientsWithEmail.map((r) => ({
        partner_id: r.partnerId, email: r.email!, name: r.companyAlias || r.companyName,
        subject: email.subject.replace(/\{\{company_name\}\}/g, r.companyAlias || r.companyName).replace(/\{\{contact_name\}\}/g, r.contactAlias || r.contactName || "").replace(/\{\{city\}\}/g, r.city || "").replace(/\{\{country\}\}/g, r.countryName || ""),
        html: buildFinalHtml(email.htmlBody, r, r.contactAlias || r.contactName || ""),
      }));
      await enqueueCampaign.mutateAsync({ draftId, recipients: resolvedRecipients, delaySeconds: 5 });
      dispatch({ type: "SET_ACTIVE_DRAFT", payload: { id: draftId, status: "processing" } });
      startProcessing(draftId).then(() => {
        dispatch({ type: "SET_QUEUE_STATUS", payload: "completed" });
      }).catch(() => {
        dispatch({ type: "SET_QUEUE_STATUS", payload: "completed" });
      });
    } catch (err) {
      log.error("enqueue failed", { message: err instanceof Error ? err.message : String(err) });
      toast.error("Errore nell'accodamento");
    }
    dispatch({ type: "SET_SENDING", payload: false });
  }, [email, recipients, recipientsWithEmail, enqueueCampaign, startProcessing, buildFinalHtml]);

  const handleEnqueue = useCallback(async () => {
    if (!email.subject || !email.htmlBody) { toast.error("Compila oggetto e corpo email"); return; }
    if (recipientsWithEmail.length === 0) { toast.error("Nessun destinatario con email valida"); return; }
    if (isEditedAfterGeneration && ai.aiGeneratedBody) {
      dispatch({ type: "SET_PENDING_SEND", payload: true });
      try {
        const result = await invokeEdge<EditAnalysis>("analyze-email-edit", {
          body: { original_html: ai.aiGeneratedBody, edited_html: email.htmlBody, recipient_country: recipients[0]?.countryCode || "", email_type: "email" },
          context: "EmailComposer.analyzeEdit",
        });
        if (result.significance === "medium" || result.significance === "high") {
          dispatch({ type: "SET_EDIT_ANALYSIS", payload: result });
          dispatch({ type: "SET_LEARNING_DIALOG", payload: true });
          dispatch({ type: "SET_PENDING_SEND", payload: false });
          return;
        }
      } catch (err) {
        log.warn("Edit analysis failed, proceeding with send", { error: err instanceof Error ? err.message : String(err) });
      }
      dispatch({ type: "SET_PENDING_SEND", payload: false });
    }
    await executeEnqueue();
  }, [email, recipientsWithEmail, isEditedAfterGeneration, ai.aiGeneratedBody, recipients, executeEnqueue]);

  const handleInsertImage = useCallback((url: string) => {
    const imgTag = `<div style="margin:12px 0"><img src="${url}" alt="Image" style="max-width:100%;height:auto;border-radius:4px" /></div>`;
    dispatch({ type: "SET_HTML_BODY", payload: email.htmlBody + imgTag });
    toast.success("Immagine inserita nel corpo email");
  }, [email.htmlBody]);

  const closeLearningDialog = useCallback(() => {
    dispatch({ type: "SET_LEARNING_DIALOG", payload: false });
    dispatch({ type: "SET_EDIT_ANALYSIS", payload: null });
  }, []);

  const handleSendAndSave = useCallback(() => {
    // Fire-and-forget: persist edit pattern for learning
    if (ai.editAnalysis) {
      const lines = (email.htmlBody || "").replace(/<[^>]+>/g, "").split("\n").filter(Boolean);
      const origLines = (ai.aiGeneratedBody || "").replace(/<[^>]+>/g, "").split("\n").filter(Boolean);
      const hookFinal = lines.slice(0, 2).join(" ").slice(0, 300);
      const hookOriginal = origLines.slice(0, 2).join(" ").slice(0, 300);
      const ctaFinal = [...lines].reverse().find((l) => l.includes("?")) || lines[lines.length - 1] || "";
      const ctaOriginal = [...origLines].reverse().find((l) => l.includes("?")) || origLines[origLines.length - 1] || "";
      insertEditPattern({
        country_code: recipients[0]?.countryCode || undefined,
        channel: "email",
        hook_original: hookOriginal.slice(0, 500),
        hook_final: hookFinal.slice(0, 500),
        cta_original: ctaOriginal.slice(0, 500),
        cta_final: ctaFinal.slice(0, 500),
        tone_delta: ai.editAnalysis.tone_shift || undefined,
        length_delta_percent: ai.editAnalysis.length_change_pct ?? undefined,
        significance: ai.editAnalysis.significance || undefined,
      }).catch(() => {/* silent */});
    }
    closeLearningDialog();
    executeEnqueue();
  }, [closeLearningDialog, executeEnqueue, ai.editAnalysis, ai.aiGeneratedBody, email.htmlBody, recipients]);

  const closeQueueMonitor = useCallback(() => {
    dispatch({ type: "SET_ACTIVE_DRAFT", payload: { id: null, status: "idle" } });
  }, []);

  return {
    state,
    dispatch,
    // Derived
    recipients,
    removeRecipient,
    recipientsWithEmail,
    isEditedAfterGeneration,
    templates,
    templatesByCategory,
    processing,
    // Actions
    setSubject,
    setHtmlBody,
    setManualEmail,
    togglePreview,
    setAttachments,
    setEmailLinks,
    setNewLinkLabel,
    setNewLinkUrl,
    insertVariable,
    addLink,
    removeLink,
    toggleAttachment,
    addManualEmail,
    confirmUnknownEmail,
    handleAIGenerate,
    handleAIImprove,
    handleLoadTemplate,
    handleSaveAsTemplate,
    openSaveTemplate,
    handleSaveDraft,
    handleEnqueue,
    executeEnqueue,
    handleInsertImage,
    closeLearningDialog,
    handleSendAndSave,
    closeQueueMonitor,
    buildFinalHtml,
  };
}
