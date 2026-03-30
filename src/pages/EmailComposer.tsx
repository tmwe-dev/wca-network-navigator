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
  Search, Paperclip, Link as LinkIcon, Plus, X,
  Building2, User, Brain, ChevronRight, Target,
} from "lucide-react";
import ContentPicker from "@/components/shared/ContentPicker";
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from "@/components/ui/resizable";
import { useSaveEmailDraft } from "@/hooks/useEmailDrafts";
import { useEmailTemplates } from "@/hooks/useCampaignJobs";
import { useEnqueueCampaign, useProcessQueue } from "@/hooks/useEmailCampaignQueue";
import { CampaignQueueMonitor } from "@/components/campaigns/CampaignQueueMonitor";
import { useMission } from "@/contexts/MissionContext";
import { cn } from "@/lib/utils";

const VARIABLES = ["{{company_name}}", "{{contact_name}}", "{{city}}", "{{country}}"];

interface LinkItem { label: string; url: string; }

interface PartnerResult {
  id: string;
  company_name: string;
  country_name: string;
  city: string;
  email: string | null;
  enriched_at: string | null;
}

interface ContactResult {
  id: string;
  partner_id: string;
  name: string;
  email: string | null;
  title: string | null;
  contact_alias: string | null;
}

interface SelectedRecipient {
  partnerId: string;
  companyName: string;
  contactId?: string;
  contactName?: string;
  email: string | null;
  city: string;
  countryName: string;
  isEnriched: boolean;
}

export default function EmailComposer() {
  const { goal, baseProposal, documents, referenceLinks } = useMission();

  // Search & selection
  const [searchQuery, setSearchQuery] = useState("");
  const [recipients, setRecipients] = useState<SelectedRecipient[]>([]);
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);

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
  const [deepSearching, setDeepSearching] = useState<string | null>(null);

  const enqueueCampaign = useEnqueueCampaign();
  const { processing, startProcessing } = useProcessQueue();
  const saveDraft = useSaveEmailDraft();
  const { data: templates = [] } = useEmailTemplates();

  // Search partners
  const { data: searchResults = [] } = useQuery({
    queryKey: ["email-search-partners", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const q = `%${searchQuery}%`;
      const { data, error } = await supabase
        .from("partners")
        .select("id, company_name, country_name, city, email, enriched_at")
        .or(`company_name.ilike.${q},city.ilike.${q},country_name.ilike.${q}`)
        .order("company_name")
        .limit(30);
      if (error) throw error;
      return (data || []) as PartnerResult[];
    },
    enabled: searchQuery.length >= 2,
  });

  // Fetch contacts for expanded partner
  const { data: partnerContacts = [] } = useQuery({
    queryKey: ["email-partner-contacts", expandedPartnerId],
    queryFn: async () => {
      if (!expandedPartnerId) return [];
      const { data, error } = await supabase
        .from("partner_contacts")
        .select("id, partner_id, name, email, title, contact_alias")
        .eq("partner_id", expandedPartnerId)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return (data || []) as ContactResult[];
    },
    enabled: !!expandedPartnerId,
  });

  const recipientsWithEmail = recipients.filter((r) => r.email);

  const addRecipient = useCallback((partner: PartnerResult, contact?: ContactResult) => {
    const key = contact ? `${partner.id}-${contact.id}` : partner.id;
    if (recipients.some((r) => (contact ? `${r.partnerId}-${r.contactId}` : r.partnerId) === key)) return;
    setRecipients((prev) => [...prev, {
      partnerId: partner.id,
      companyName: partner.company_name,
      contactId: contact?.id,
      contactName: contact?.contact_alias || contact?.name,
      email: contact?.email || partner.email,
      city: partner.city,
      countryName: partner.country_name,
      isEnriched: !!partner.enriched_at,
    }]);
  }, [recipients]);

  const removeRecipient = (idx: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== idx));
  };

  // Deep Search
  const handleDeepSearch = async (partnerId: string) => {
    setDeepSearching(partnerId);
    try {
      const { error } = await supabase.functions.invoke("deep-search-partner", {
        body: { partner_id: partnerId },
      });
      if (error) throw error;
      toast.success("Deep Search completata");
    } catch (err: any) {
      toast.error("Errore Deep Search: " + (err.message || "Sconosciuto"));
    } finally {
      setDeepSearching(null);
    }
  };

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
      toast.error("Configura obiettivo o proposta dal pannello Mission (icona target nell'header)");
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
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/50 glass-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-4.5 h-4.5 text-primary" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">Email Composer</h1>
              <p className="text-[11px] text-muted-foreground">Componi e invia email personalizzate</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            <Mail className="w-3 h-3 mr-1" />
            {recipientsWithEmail.length} destinatari con email
          </Badge>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">

          {/* Left: Search + Recipients */}
          <ResizablePanel defaultSize={30} minSize={22} maxSize={40}>
            <div className="h-full flex flex-col border-r border-border/30">
              {/* Search */}
              <div className="shrink-0 p-3 border-b border-border/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold">Cerca Destinatario</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca azienda o contatto..."
                    className="h-8 text-xs pl-8 border-border bg-muted/30"
                  />
                </div>
              </div>

              {/* Search Results */}
              {searchQuery.length >= 2 && searchResults.length > 0 && (
                <div className="shrink-0 border-b border-border/30 max-h-[240px] overflow-y-auto">
                  <div className="p-1.5 space-y-0.5">
                    {searchResults.map((p) => (
                      <div key={p.id}>
                        <div
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors group"
                          onClick={() => setExpandedPartnerId(expandedPartnerId === p.id ? null : p.id)}
                        >
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate">{p.company_name}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{p.city}, {p.country_name}</p>
                          </div>
                          {!p.enriched_at && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-5 px-1.5 text-[9px] gap-1 opacity-0 group-hover:opacity-100 shrink-0"
                              onClick={(e) => { e.stopPropagation(); handleDeepSearch(p.id); }}
                              disabled={deepSearching === p.id}
                            >
                              {deepSearching === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                              Deep Search
                            </Button>
                          )}
                          {p.enriched_at && <Brain className="w-3 h-3 text-amber-500 shrink-0" />}
                          {p.email && <Mail className="w-3 h-3 text-emerald-500 shrink-0" />}
                          <ChevronRight className={cn(
                            "w-3 h-3 text-muted-foreground transition-transform shrink-0",
                            expandedPartnerId === p.id && "rotate-90"
                          )} />
                        </div>

                        {/* Contacts dropdown */}
                        {expandedPartnerId === p.id && (
                          <div className="ml-6 pl-2 border-l border-border/30 space-y-0.5 py-1">
                            {/* Add company directly */}
                            <button
                              onClick={() => addRecipient(p)}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] hover:bg-primary/10 text-primary transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Aggiungi azienda ({p.email || "no email"})
                            </button>
                            {/* Individual contacts */}
                            {partnerContacts.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => addRecipient(p, c)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-left transition-colors"
                              >
                                <User className="w-3 h-3 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-medium truncate">{c.contact_alias || c.name}</p>
                                  {c.title && <p className="text-[9px] text-muted-foreground truncate">{c.title}</p>}
                                </div>
                                {c.email ? (
                                  <Mail className="w-3 h-3 text-emerald-500 shrink-0" />
                                ) : (
                                  <span className="text-[9px] text-muted-foreground">no email</span>
                                )}
                              </button>
                            ))}
                            {partnerContacts.length === 0 && (
                              <p className="text-[9px] text-muted-foreground px-2 py-1">Nessun contatto trovato</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Recipients */}
              <div className="shrink-0 px-3 py-1.5 border-b border-border/30 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Destinatari selezionati
                </span>
                <Badge variant="outline" className="text-[9px] h-4">{recipients.length}</Badge>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-1.5 space-y-0.5">
                  {recipients.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-6 h-6 mx-auto mb-2 opacity-30" />
                      <p className="text-[11px]">Cerca e seleziona i destinatari</p>
                    </div>
                  )}
                  {recipients.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/30 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate">{r.companyName}</p>
                        {r.contactName && <p className="text-[9px] text-muted-foreground truncate">{r.contactName}</p>}
                        <p className="text-[9px] text-muted-foreground truncate">{r.city}, {r.countryName}</p>
                      </div>
                      {r.email ? (
                        <Mail className="w-3 h-3 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="text-[8px] text-destructive shrink-0">no email</span>
                      )}
                      <button
                        onClick={() => removeRecipient(idx)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Editor + Preview */}
          <ResizablePanel defaultSize={70} minSize={50}>
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4 max-w-3xl mx-auto">
                {/* Subject */}
                <div className="space-y-2">
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Oggetto della email..."
                    className="h-9 text-sm font-medium"
                  />
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-muted-foreground mr-1">Variabili:</span>
                    {VARIABLES.map((v) => (
                      <Badge key={v} variant="outline" className="cursor-pointer text-[10px] hover:bg-primary/10"
                        onClick={() => setHtmlBody((prev) => prev + v)}>{v}</Badge>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <Textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  placeholder="Scrivi il contenuto della email... Puoi usare HTML e variabili come {{company_name}}"
                  className="min-h-[200px] font-mono text-xs bg-muted/20"
                />

                {/* AI Generate */}
                <Button onClick={handleAIGenerate} disabled={aiGenerating} className="w-full gap-2 h-10" variant="outline">
                  {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                  {aiGenerating ? "Generazione AI in corso..." : "Genera con AI"}
                </Button>

                {/* Links */}
                <div className="float-panel-subtle p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">Link</span>
                  </div>
                  {emailLinks.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="truncate flex-1">{l.label}: {l.url}</span>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setEmailLinks((prev) => prev.filter((_, idx) => idx !== i))}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-1">
                    <Input placeholder="Etichetta" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} className="flex-1 h-6 text-xs" />
                    <Input placeholder="https://..." value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} className="flex-1 h-6 text-xs" />
                    <Button size="sm" variant="outline" className="h-6 px-2" onClick={addLink}><Plus className="w-3 h-3" /></Button>
                  </div>
                </div>

                {/* Attachments */}
                {templates.length > 0 && (
                  <div className="float-panel-subtle p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">Allegati</span>
                    </div>
                    {Object.entries(templatesByCategory).map(([cat, files]) => (
                      <div key={cat} className="space-y-0.5">
                        {files.map((t: any) => (
                          <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={selectedAttachments.includes(t.id)}
                              onChange={() => setSelectedAttachments((prev) => prev.includes(t.id) ? prev.filter((a) => a !== t.id) : [...prev, t.id])}
                              className="h-3 w-3"
                            />
                            <span className="truncate">{t.file_name}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview */}
                {(subject || htmlBody) && (
                  <div className="float-panel p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold">Anteprima</span>
                    </div>
                    <div className="border border-border/30 rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-muted/30 border-b border-border/30">
                        <p className="text-xs font-medium truncate">
                          {subject.replace(/\{\{company_name\}\}/g, "Acme Logistics").replace(/\{\{contact_name\}\}/g, "John Doe").replace(/\{\{city\}\}/g, "Milano").replace(/\{\{country\}\}/g, "Italy") || "Nessun oggetto"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">A: partner@example.com</p>
                      </div>
                      <div className="p-3 text-xs prose prose-sm max-w-none"
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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={sending} className="gap-1">
                    <Save className="w-3.5 h-3.5" /> Salva bozza
                  </Button>
                  <Button size="sm" onClick={handleEnqueue} disabled={sending || processing || recipientsWithEmail.length === 0} className="gap-1 flex-1">
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {sending ? "Preparazione..." : `Invia a ${recipientsWithEmail.length} destinatari`}
                  </Button>
                </div>

                {/* Queue Monitor */}
                {activeDraftId && (
                  <CampaignQueueMonitor draftId={activeDraftId} queueStatus={activeQueueStatus} />
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>
    </div>
  );
}
