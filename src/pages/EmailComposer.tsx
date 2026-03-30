import { useState, useMemo, useCallback } from "react";
import DOMPurify from "dompurify";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Send, Save, Eye, Loader2, Mail, Globe, Users, Sparkles,
  Search, Filter, ListOrdered, Paperclip, Link as LinkIcon, Plus, X, Briefcase,
} from "lucide-react";
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from "@/components/ui/resizable";
import { useSaveEmailDraft } from "@/hooks/useEmailDrafts";
import { useEmailTemplates } from "@/hooks/useCampaignJobs";
import { useEnqueueCampaign, useProcessQueue } from "@/hooks/useEmailCampaignQueue";
import { CampaignQueueMonitor } from "@/components/campaigns/CampaignQueueMonitor";
import { useMission } from "@/contexts/MissionContext";

const CATEGORIES = [
  { value: "offerta_cliente", label: "Offerta nuovo cliente" },
  { value: "collaborazione_domestic", label: "Collaborazione nazionale" },
  { value: "collaborazione_international", label: "Collaborazione internazionale" },
  { value: "saluti_festivita", label: "Saluti e festività" },
  { value: "comunicazioni_operative", label: "Comunicazioni operative" },
  { value: "altro", label: "Altro" },
];

const VARIABLES = ["{{company_name}}", "{{contact_name}}", "{{city}}", "{{country}}"];

interface LinkItem { label: string; url: string; }

export default function EmailComposer() {
  const { goal, baseProposal, documents, referenceLinks } = useMission();

  // Email state
  const [category, setCategory] = useState("altro");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [emailLinks, setEmailLinks] = useState<LinkItem[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  // Recipient state
  const [recipientTab, setRecipientTab] = useState<"country" | "partner">("country");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [filterWithEmail, setFilterWithEmail] = useState(false);

  // Queue state
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [queueDelay, setQueueDelay] = useState(5);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeQueueStatus, setActiveQueueStatus] = useState("idle");
  const [aiGenerating, setAiGenerating] = useState(false);

  const enqueueCampaign = useEnqueueCampaign();
  const { processing, startProcessing } = useProcessQueue();
  const saveDraft = useSaveEmailDraft();
  const { data: templates = [] } = useEmailTemplates();

  // Data queries
  const { data: countries = [] } = useQuery({
    queryKey: ["email-composer-countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("country_code, country_name")
        .order("country_name");
      if (error) throw error;
      const map = new Map<string, { code: string; name: string; count: number }>();
      (data || []).forEach((p) => {
        const existing = map.get(p.country_code);
        if (existing) existing.count++;
        else map.set(p.country_code, { code: p.country_code, name: p.country_name, count: 1 });
      });
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const { data: allPartners = [] } = useQuery({
    queryKey: ["email-composer-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, company_name, country_name, city, email")
        .order("company_name")
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  // Computed
  const recipients = useMemo(() => {
    if (recipientTab === "country") {
      return allPartners.filter((p) => selectedCountries.includes(p.country_name));
    }
    return allPartners.filter((p) => selectedPartnerIds.includes(p.id));
  }, [recipientTab, selectedCountries, selectedPartnerIds, allPartners]);

  const recipientsWithEmail = recipients.filter((r) => r.email);

  const filteredPartners = useMemo(() => {
    let list = allPartners;
    if (filterWithEmail) list = list.filter((p) => p.email);
    if (partnerSearch) {
      const q = partnerSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.company_name.toLowerCase().includes(q) ||
          p.country_name?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 100);
  }, [allPartners, partnerSearch, filterWithEmail]);

  const toggleCountry = (name: string) => {
    setSelectedCountries((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };
  const togglePartner = (id: string) => {
    setSelectedPartnerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };
  const toggleAttachment = (id: string) => {
    setSelectedAttachments((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

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

  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const buildFinalHtml = (body: string, partner: any, contactName: string) => {
    let html = body
      .replace(/\{\{company_name\}\}/g, escapeHtml(partner.company_name || ""))
      .replace(/\{\{contact_name\}\}/g, escapeHtml(contactName || ""))
      .replace(/\{\{city\}\}/g, escapeHtml(partner.city || ""))
      .replace(/\{\{country\}\}/g, escapeHtml(partner.country_name || ""));
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
      toast.error("Inserisci un goal o una proposta per generare con AI");
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
          // We pass a dummy activity_id since we're composing from scratch
          activity_id: "00000000-0000-0000-0000-000000000000",
          standalone: true,
          recipient_count: recipientsWithEmail.length,
          recipient_countries: [...new Set(recipients.map((r) => r.country_name))].join(", "),
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
        subject, html_body: htmlBody, category,
        recipient_type: recipientTab,
        recipient_filter: recipientTab === "country" ? { country_names: selectedCountries } : { partner_ids: selectedPartnerIds },
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
          subject, html_body: htmlBody, category,
          recipient_type: recipientTab,
          recipient_filter: recipientTab === "country" ? { country_names: selectedCountries } : { partner_ids: selectedPartnerIds },
          attachment_ids: selectedAttachments, link_urls: emailLinks,
          status: "queued", total_count: recipientsWithEmail.length,
        } as any).select().single();
      if (draftError) throw draftError;
      const draftId = (savedDraft as any).id;

      const partnerIds = recipientsWithEmail.map((r) => r.id);
      const contactBatches: any[] = [];
      for (let i = 0; i < partnerIds.length; i += 50) {
        const { data: contacts } = await supabase
          .from("partner_contacts").select("partner_id, name, is_primary")
          .in("partner_id", partnerIds.slice(i, i + 50));
        if (contacts) contactBatches.push(...contacts);
      }
      const contactMap: Record<string, string> = {};
      contactBatches.forEach((c: any) => { if (!contactMap[c.partner_id] || c.is_primary) contactMap[c.partner_id] = c.name; });

      const resolvedRecipients = recipientsWithEmail.map((partner) => {
        const contactName = contactMap[partner.id] || "";
        return {
          partner_id: partner.id, email: partner.email!,
          name: partner.company_name,
          subject: subject.replace(/\{\{company_name\}\}/g, partner.company_name || "").replace(/\{\{contact_name\}\}/g, contactName).replace(/\{\{city\}\}/g, partner.city || "").replace(/\{\{country\}\}/g, partner.country_name || ""),
          html: buildFinalHtml(htmlBody, partner, contactName),
        };
      });

      await enqueueCampaign.mutateAsync({ draftId, recipients: resolvedRecipients, delaySeconds: queueDelay });
      setActiveDraftId(draftId);
      setActiveQueueStatus("idle");
      startProcessing(draftId);
      setActiveQueueStatus("processing");
    } catch (err) {
      console.error("Enqueue error:", err);
      toast.error("Errore nell'accodamento della campagna");
    }
    setSending(false);
  };

  // (Preset handlers now in MissionContext)

  const templatesByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    templates.forEach((t: any) => { const cat = t.category || "altro"; if (!groups[cat]) groups[cat] = []; groups[cat].push(t); });
    return groups;
  }, [templates]);

  return (
    <div className="flex flex-col h-full">
      {/* Glass top bar */}
      <div className="shrink-0 px-4 py-3 border-b border-border/50 glass-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-4.5 h-4.5 text-primary" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">Email Composer</h1>
              <p className="text-[11px] text-muted-foreground">Composizione AI-powered e invio campagne</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <Users className="w-3 h-3 mr-1" />
              {recipientsWithEmail.length} destinatari
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <Globe className="w-3 h-3 mr-1" />
              {new Set(recipients.map((r) => r.country_name)).size} paesi
            </Badge>
          </div>
        </div>
      </div>

      {/* Mission Context è nel pannello globale (Target icon nell'header) */}

      {/* 3-column layout */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Column 1: Rubrica Destinatari */}
          <ResizablePanel defaultSize={25} minSize={18} maxSize={35}>
            <div className="h-full flex flex-col border-r border-border/30">
              <div className="shrink-0 p-3 border-b border-border/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold">Rubrica Destinatari</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={partnerSearch} onChange={(e) => setPartnerSearch(e.target.value)}
                    placeholder="Cerca partner..."
                    className="h-7 text-xs pl-8 border-border bg-muted/30"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm" variant={recipientTab === "country" ? "default" : "outline"}
                    className="h-6 text-[10px] flex-1 gap-1"
                    onClick={() => setRecipientTab("country")}
                  >
                    <Globe className="w-3 h-3" /> Paese
                  </Button>
                  <Button
                    size="sm" variant={recipientTab === "partner" ? "default" : "outline"}
                    className="h-6 text-[10px] flex-1 gap-1"
                    onClick={() => setRecipientTab("partner")}
                  >
                    <Users className="w-3 h-3" /> Partner
                  </Button>
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                  <Checkbox checked={filterWithEmail} onCheckedChange={(v) => setFilterWithEmail(!!v)} className="h-3 w-3" />
                  Solo con email
                </label>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-0.5">
                  {recipientTab === "country" ? (
                    countries.map((c) => (
                      <label key={c.code} className="flex items-center gap-2 text-xs py-1.5 px-2 cursor-pointer hover:bg-muted/50 rounded">
                        <Checkbox checked={selectedCountries.includes(c.name)} onCheckedChange={() => toggleCountry(c.name)} className="h-3.5 w-3.5" />
                        <span className="flex-1 truncate">{c.name}</span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">{c.count}</Badge>
                      </label>
                    ))
                  ) : (
                    filteredPartners.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs py-1.5 px-2 cursor-pointer hover:bg-muted/50 rounded">
                        <Checkbox checked={selectedPartnerIds.includes(p.id)} onCheckedChange={() => togglePartner(p.id)} className="h-3.5 w-3.5" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-[11px]">{p.company_name}</p>
                          <p className="text-[9px] text-muted-foreground truncate">{p.city}, {p.country_name}</p>
                        </div>
                        {p.email && <Mail className="w-3 h-3 text-emerald-500 shrink-0" />}
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="shrink-0 p-2 border-t border-border/30 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Selezionati</span>
                  <Badge variant="outline" className="text-[9px] h-4">{recipients.length}</Badge>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Con email</span>
                  <Badge variant={recipientsWithEmail.length > 0 ? "default" : "destructive"} className="text-[9px] h-4">
                    {recipientsWithEmail.length}
                  </Badge>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Column 2: Editor */}
          <ResizablePanel defaultSize={45} minSize={30}>
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* Category + Subject */}
                <div className="float-panel-subtle p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold">Componi Email</span>
                  </div>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Oggetto della email..." className="h-8 text-sm" />
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-muted-foreground mr-1">Variabili:</span>
                    {VARIABLES.map((v) => (
                      <Badge key={v} variant="outline" className="cursor-pointer text-[10px] hover:bg-primary/10"
                        onClick={() => setHtmlBody((prev) => prev + v)}>{v}</Badge>
                    ))}
                  </div>
                  <Textarea value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)}
                    placeholder="Scrivi il contenuto della email... Puoi usare HTML e variabili come {{company_name}}"
                    className="min-h-[180px] font-mono text-xs bg-muted/20" />
                </div>

                {/* AI Generate button */}
                <Button onClick={handleAIGenerate} disabled={aiGenerating} className="w-full gap-2" variant="outline">
                  {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {aiGenerating ? "Generazione AI in corso..." : "Genera con AI"}
                </Button>

                {/* Links */}
                <div className="float-panel-subtle p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">Link nell'email</span>
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
                <div className="float-panel-subtle p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">Allegati (da Template)</span>
                  </div>
                  {Object.entries(templatesByCategory).map(([cat, files]) => (
                    <div key={cat} className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground capitalize">{CATEGORIES.find((c) => c.value === cat)?.label || cat}</p>
                      {files.map((t: any) => (
                        <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox checked={selectedAttachments.includes(t.id)} onCheckedChange={() => toggleAttachment(t.id)} className="h-3 w-3" />
                          <span className="truncate">{t.file_name}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                  {templates.length === 0 && <p className="text-[10px] text-muted-foreground">Nessun template caricato.</p>}
                </div>

                {/* Queue delay */}
                <div className="float-panel-subtle p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium flex items-center gap-1.5">
                      <ListOrdered className="w-3.5 h-3.5 text-muted-foreground" /> Ritardo tra invii
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">{queueDelay}s</span>
                  </div>
                  <Slider value={[queueDelay]} onValueChange={([v]) => setQueueDelay(v)} min={2} max={30} step={1} />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={sending} className="gap-1">
                    <Save className="w-3.5 h-3.5" /> Salva
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPreviewOpen(!previewOpen)} className="gap-1">
                    <Eye className="w-3.5 h-3.5" /> Anteprima
                  </Button>
                  <Button size="sm" onClick={handleEnqueue} disabled={sending || processing || recipientsWithEmail.length === 0} className="gap-1 flex-1">
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {sending ? "Preparazione..." : `Accoda ${recipientsWithEmail.length} email`}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Column 3: Preview + Queue Monitor */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* Inbox-style preview */}
                <div className="float-panel p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold">Anteprima Inbox</span>
                  </div>
                  {subject || htmlBody ? (
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
                            { company_name: "Acme Logistics", city: "Milano", country_name: "Italy" },
                            "John Doe"),
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Compila l'email per vedere l'anteprima</p>
                    </div>
                  )}
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
