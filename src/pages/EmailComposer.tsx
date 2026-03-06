import { useState, useMemo } from "react";
import DOMPurify from "dompurify";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Send, Save, Eye, Plus, Trash2, Loader2, Mail, Globe, Users, Briefcase, Link as LinkIcon, Paperclip, X, ListOrdered } from "lucide-react";
import { useSaveEmailDraft } from "@/hooks/useEmailDrafts";
import { useEmailTemplates } from "@/hooks/useCampaignJobs";
import { useEnqueueCampaign, useProcessQueue } from "@/hooks/useEmailCampaignQueue";
import { CampaignQueueMonitor } from "@/components/campaigns/CampaignQueueMonitor";
import { RecipientSelector } from "@/components/campaigns/RecipientSelector";

const CATEGORIES = [
  { value: "offerta_cliente", label: "Offerta nuovo cliente" },
  { value: "collaborazione_domestic", label: "Collaborazione nazionale" },
  { value: "collaborazione_international", label: "Collaborazione internazionale" },
  { value: "saluti_festivita", label: "Saluti e festività" },
  { value: "comunicazioni_operative", label: "Comunicazioni operative" },
  { value: "altro", label: "Altro" },
];

const VARIABLES = ["{{company_name}}", "{{contact_name}}", "{{city}}", "{{country}}"];

interface LinkItem {
  label: string;
  url: string;
}

export default function EmailComposer() {
  const [category, setCategory] = useState("altro");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  // Recipient state
  const [recipientTab, setRecipientTab] = useState("country");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [partnerSearch, setPartnerSearch] = useState("");

  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0, failed: 0 });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [queueDelay, setQueueDelay] = useState(5);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeQueueStatus, setActiveQueueStatus] = useState("idle");

  const enqueueCampaign = useEnqueueCampaign();
  const { processing, startProcessing } = useProcessQueue();

  const saveDraft = useSaveEmailDraft();
  const { data: templates = [] } = useEmailTemplates();

  // Country list from partners
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

  // Partners for manual selection
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

  // Campaign batches
  const { data: batches = [] } = useQuery({
    queryKey: ["email-composer-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_jobs")
        .select("batch_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const unique = new Map<string, string>();
      (data || []).forEach((j) => {
        if (!unique.has(j.batch_id)) unique.set(j.batch_id, j.created_at);
      });
      return Array.from(unique.entries()).map(([id, date]) => ({ id, date }));
    },
  });

  // Compute recipients based on selection mode
  const recipients = useMemo(() => {
    if (recipientTab === "country") {
      return allPartners.filter((p) => selectedCountries.includes(p.country_name));
    }
    if (recipientTab === "partner") {
      return allPartners.filter((p) => selectedPartnerIds.includes(p.id));
    }
    return [];
  }, [recipientTab, selectedCountries, selectedPartnerIds, allPartners]);

  const recipientsWithEmail = recipients.filter((r) => r.email);

  const filteredPartners = useMemo(() => {
    if (!partnerSearch) return allPartners.slice(0, 100);
    const q = partnerSearch.toLowerCase();
    return allPartners.filter(
      (p) =>
        p.company_name.toLowerCase().includes(q) ||
        p.country_name?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q)
    ).slice(0, 100);
  }, [allPartners, partnerSearch]);

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
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch { return false; }
  };

  const addLink = () => {
    if (!newLinkLabel || !newLinkUrl) return;
    if (!isValidUrl(newLinkUrl)) {
      toast.error("URL non valido. Usa http:// o https://");
      return;
    }
    setLinks((prev) => [...prev, { label: newLinkLabel, url: newLinkUrl }]);
    setNewLinkLabel("");
    setNewLinkUrl("");
  };

  const removeLink = (idx: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const insertVariable = (v: string) => {
    setHtmlBody((prev) => prev + v);
  };

  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const buildFinalHtml = (body: string, partner: any, contactName: string) => {
    const safeCompanyName = escapeHtml(partner.company_name || "");
    const safeContactName = escapeHtml(contactName || "");
    const safeCity = escapeHtml(partner.city || "");
    const safeCountry = escapeHtml(partner.country_name || "");

    let html = body
      .replace(/\{\{company_name\}\}/g, safeCompanyName)
      .replace(/\{\{contact_name\}\}/g, safeContactName)
      .replace(/\{\{city\}\}/g, safeCity)
      .replace(/\{\{country\}\}/g, safeCountry);

    // Add links (only valid URLs)
    const validLinks = links.filter((l) => isValidUrl(l.url));
    if (validLinks.length > 0) {
      html += `<br/><br/><p><strong>Link utili:</strong></p><ul>`;
      validLinks.forEach((l) => {
        html += `<li><a href="${encodeURI(l.url)}" target="_blank">${escapeHtml(l.label)}</a></li>`;
      });
      html += `</ul>`;
    }

    // Add attachment links
    const attachedTemplates = templates.filter((t: any) => selectedAttachments.includes(t.id));
    if (attachedTemplates.length > 0) {
      html += `<br/><p><strong>Allegati:</strong></p><ul>`;
      attachedTemplates.forEach((t: any) => {
        html += `<li><a href="${encodeURI(t.file_url)}" target="_blank">${escapeHtml(t.file_name)}</a></li>`;
      });
      html += `</ul>`;
    }

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'div', 'span', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img', 'hr', 'blockquote', 'pre', 'code', 'b', 'i', 'u'],
      ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'style', 'class', 'width', 'height', 'colspan', 'rowspan'],
    });
  };

  const handleSaveDraft = async () => {
    try {
      await saveDraft.mutateAsync({
        subject,
        html_body: htmlBody,
        category,
        recipient_type: recipientTab,
        recipient_filter:
          recipientTab === "country"
            ? { country_names: selectedCountries }
            : recipientTab === "partner"
            ? { partner_ids: selectedPartnerIds }
            : { batch_id: selectedBatchId },
        attachment_ids: selectedAttachments,
        link_urls: links,
        status: "draft",
        total_count: recipientsWithEmail.length,
      } as any);
      toast.success("Bozza salvata");
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  const handleEnqueue = async () => {
    if (!subject || !htmlBody) {
      toast.error("Compila oggetto e corpo email");
      return;
    }
    if (recipientsWithEmail.length === 0) {
      toast.error("Nessun destinatario con email valida");
      return;
    }

    setSending(true);

    try {
      // Save draft first
      const { data: savedDraft, error: draftError } = await supabase
        .from("email_drafts" as any)
        .insert({
          subject,
          html_body: htmlBody,
          category,
          recipient_type: recipientTab,
          recipient_filter:
            recipientTab === "country"
              ? { country_names: selectedCountries }
              : recipientTab === "partner"
              ? { partner_ids: selectedPartnerIds }
              : { batch_id: selectedBatchId },
          attachment_ids: selectedAttachments,
          link_urls: links,
          status: "queued",
          total_count: recipientsWithEmail.length,
        } as any)
        .select()
        .single();
      if (draftError) throw draftError;

      const draftId = (savedDraft as any).id;

      // Fetch contacts for variable substitution
      const partnerIds = recipientsWithEmail.map((r) => r.id);
      const contactBatches: any[] = [];
      for (let i = 0; i < partnerIds.length; i += 50) {
        const { data: contacts } = await supabase
          .from("partner_contacts")
          .select("partner_id, name, is_primary")
          .in("partner_id", partnerIds.slice(i, i + 50));
        if (contacts) contactBatches.push(...contacts);
      }

      const contactMap: Record<string, string> = {};
      contactBatches.forEach((c: any) => {
        if (!contactMap[c.partner_id] || c.is_primary) {
          contactMap[c.partner_id] = c.name;
        }
      });

      // Build recipients with resolved HTML
      const resolvedRecipients = recipientsWithEmail.map((partner) => {
        const contactName = contactMap[partner.id] || "";
        const finalSubject = subject
          .replace(/\{\{company_name\}\}/g, partner.company_name || "")
          .replace(/\{\{contact_name\}\}/g, contactName)
          .replace(/\{\{city\}\}/g, partner.city || "")
          .replace(/\{\{country\}\}/g, partner.country_name || "");
        const finalHtml = buildFinalHtml(htmlBody, partner, contactName);
        return {
          partner_id: partner.id,
          email: partner.email!,
          name: partner.company_name,
          subject: finalSubject,
          html: finalHtml,
        };
      });

      await enqueueCampaign.mutateAsync({
        draftId,
        recipients: resolvedRecipients,
        delaySeconds: queueDelay,
      });

      setActiveDraftId(draftId);
      setActiveQueueStatus("idle");

      // Auto-start processing
      startProcessing(draftId);
      setActiveQueueStatus("processing");
    } catch (err) {
      console.error("Enqueue error:", err);
      toast.error("Errore nell'accodamento della campagna");
    }

    setSending(false);
  };

  // Template groups for attachments
  const templatesByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    templates.forEach((t: any) => {
      const cat = t.category || "altro";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return groups;
  }, [templates]);


  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 max-w-[1600px] mx-auto">
      {/* Left: Editor */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Email Composer</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Componi Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Oggetto</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Oggetto della email..."
              />
            </div>

            {/* Variables */}
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground mr-1">Variabili:</span>
              {VARIABLES.map((v) => (
                <Badge
                  key={v}
                  variant="outline"
                  className="cursor-pointer text-xs hover:bg-primary/10"
                  onClick={() => insertVariable(v)}
                >
                  {v}
                </Badge>
              ))}
            </div>

            {/* Body */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Corpo email (HTML)</label>
              <Textarea
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                placeholder="Scrivi il contenuto della email... Puoi usare HTML e variabili come {{company_name}}"
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            {/* Links */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-muted-foreground" />
                <label className="text-sm font-medium">Link</label>
              </div>
              {links.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="truncate flex-1">{l.label}: {l.url}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeLink(i)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Etichetta"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="https://..."
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={addLink}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <label className="text-sm font-medium">Allegati (da Template)</label>
              </div>
              {Object.entries(templatesByCategory).map(([cat, files]) => (
                <div key={cat} className="space-y-1">
                  <p className="text-xs text-muted-foreground capitalize">{CATEGORIES.find(c => c.value === cat)?.label || cat}</p>
                  {files.map((t: any) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedAttachments.includes(t.id)}
                        onCheckedChange={() => toggleAttachment(t.id)}
                      />
                      <span className="truncate">{t.file_name}</span>
                    </label>
                  ))}
                </div>
              ))}
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">Nessun template caricato. Vai in Impostazioni → Template.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Queue delay control */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-muted-foreground" />
                Ritardo tra invii
              </label>
              <span className="text-sm font-mono text-muted-foreground">{queueDelay}s</span>
            </div>
            <Slider
              value={[queueDelay]}
              onValueChange={([v]) => setQueueDelay(v)}
              min={2}
              max={30}
              step={1}
            />
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSaveDraft} disabled={sending}>
            <Save className="w-4 h-4 mr-2" /> Salva Bozza
          </Button>
          <Button
            variant="outline"
            onClick={() => setPreviewOpen(!previewOpen)}
          >
            <Eye className="w-4 h-4 mr-2" /> Anteprima
          </Button>
          <Button onClick={handleEnqueue} disabled={sending || processing || recipientsWithEmail.length === 0}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {sending
              ? "Preparazione coda..."
              : `Accoda ${recipientsWithEmail.length} email`}
          </Button>
        </div>

        {/* Campaign Queue Monitor */}
        {activeDraftId && (
          <CampaignQueueMonitor draftId={activeDraftId} queueStatus={activeQueueStatus} />
        )}

        {/* Preview */}
        {previewOpen && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Anteprima</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm mb-2">
                <strong>Oggetto:</strong> {subject.replace(/\{\{company_name\}\}/g, "Acme Logistics").replace(/\{\{contact_name\}\}/g, "John Doe").replace(/\{\{city\}\}/g, "Milano").replace(/\{\{country\}\}/g, "Italy")}
              </div>
              <div
                className="border rounded p-4 text-sm prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: buildFinalHtml(
                    htmlBody,
                    { company_name: "Acme Logistics", city: "Milano", country_name: "Italy" },
                    "John Doe"
                  ),
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: Recipients */}
      <div className="w-full lg:w-[400px] space-y-4">
        <RecipientSelector
          recipientTab={recipientTab}
          onRecipientTabChange={setRecipientTab}
          countries={countries}
          selectedCountries={selectedCountries}
          onToggleCountry={toggleCountry}
          filteredPartners={filteredPartners}
          selectedPartnerIds={selectedPartnerIds}
          onTogglePartner={togglePartner}
          partnerSearch={partnerSearch}
          onPartnerSearchChange={setPartnerSearch}
          batches={batches}
          selectedBatchId={selectedBatchId}
          onSelectBatch={setSelectedBatchId}
          recipientCount={recipients.length}
          recipientWithEmailCount={recipientsWithEmail.length}
        />
      </div>
    </div>
  );
}
