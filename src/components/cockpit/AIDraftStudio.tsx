import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Mail, Linkedin, MessageCircle, Smartphone, Copy, Send, RotateCcw, Target, ExternalLink, Brain, Database, Zap, Globe, User, Building2, BookOpen, Search, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import ContentPicker from "@/components/shared/ContentPicker";
import { useMission } from "@/contexts/MissionContext";
import { cn } from "@/lib/utils";
import type { DraftState, DraftChannel, ScrapingPhase } from "@/pages/Cockpit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";

const LinkedInDMDialog = lazy(() => import("@/components/workspace/LinkedInDMDialog"));

interface AIDraftStudioProps {
  draft: DraftState;
  onDraftChange: (draft: DraftState) => void;
  onRegenerate?: () => void;
}

const channelMeta: Record<string, { icon: any; label: string; color: string }> = {
  email: { icon: Mail, label: "Email", color: "text-primary" },
  linkedin: { icon: Linkedin, label: "LinkedIn", color: "text-[hsl(210,80%,55%)]" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "text-success" },
  sms: { icon: Smartphone, label: "SMS", color: "text-chart-3" },
};

function TypewriterText({ text, speed = 20, isHtml = false }: { text: string; speed?: number; isHtml?: boolean }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;
    if (!text) return;

    const interval = setInterval(() => {
      indexRef.current += 3; // faster for longer AI content
      const slice = text.slice(0, indexRef.current);
      setDisplayed(slice);
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  if (isHtml) {
    return (
      <span>
        <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayed) }} />
        {!done && text && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="inline-block w-[2px] h-4 bg-primary ml-0.5 align-text-bottom"
          />
        )}
      </span>
    );
  }

  return (
    <span className="whitespace-pre-wrap">
      {displayed}
      {!done && text && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="inline-block w-[2px] h-4 bg-primary ml-0.5 align-text-bottom"
        />
      )}
    </span>
  );
}

export function AIDraftStudio({ draft, onDraftChange, onRegenerate }: AIDraftStudioProps) {
  const [sending, setSending] = useState(false);
  const [liDmOpen, setLiDmOpen] = useState(false);
  const { goal, baseProposal, setGoal, setBaseProposal } = useMission();
  const waBridge = useWhatsAppExtensionBridge();
  const liBridge = useLinkedInExtensionBridge();
  const meta = draft.channel ? channelMeta[draft.channel] : null;
  const Icon = meta?.icon || Sparkles;

  const isHtmlContent = draft.channel === "email" && /<(p|br|div|ul|ol)\b/i.test(draft.body);

  const handleCopy = () => {
    const text = draft.channel === "email"
      ? `Subject: ${draft.subject}\n\n${draft.body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[^>]+(>|$)/g, "")}`
      : draft.body;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato negli appunti" });
  };

  const handleSendWhatsApp = async () => {
    const phone = draft.contactPhone?.replace(/[^0-9+]/g, "").replace(/^\+/, "");
    if (!phone) {
      toast({ title: "Numero di telefono mancante", variant: "destructive" });
      return;
    }
    const plainText = draft.body.replace(/<[^>]+>/g, "").trim();

    if (waBridge.isAvailable) {
      setSending(true);
      try {
        const res = await waBridge.sendWhatsApp(phone, plainText);
        if (res.success) {
          toast({ title: "✅ WhatsApp inviato!", description: `A: ${phone}` });
        } else {
          toast({ title: "Errore WhatsApp", description: res.error, variant: "destructive" });
        }
      } catch {
        toast({ title: "Errore invio WhatsApp", variant: "destructive" });
      } finally {
        setSending(false);
      }
    } else {
      // Fallback: copy + link
      navigator.clipboard.writeText(plainText);
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(plainText)}`;
      toast({
        title: "📋 Messaggio copiato!",
        description: "Estensione WA non rilevata. Clicca per aprire WhatsApp.",
        action: (
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold text-primary underline whitespace-nowrap">
            Apri WhatsApp ↗
          </a>
        ),
      });
    }
  };

  const handleSendLinkedIn = async () => {
    const plainText = draft.body.replace(/<[^>]+>/g, "").trim();
    const profileUrl = draft.contactLinkedinUrl || "";
    if (liBridge.isAvailable && profileUrl) {
      setSending(true);
      try {
        const res = await liBridge.sendDirectMessage(profileUrl, plainText);
        if (res.success) {
          toast({ title: "✅ LinkedIn inviato!", description: `A: ${draft.contactName}` });
        } else {
          toast({ title: "Errore LinkedIn", description: res.error, variant: "destructive" });
        }
      } catch {
        toast({ title: "Errore invio LinkedIn", variant: "destructive" });
      } finally {
        setSending(false);
      }
    } else if (!profileUrl) {
      toast({ title: "URL profilo LinkedIn mancante", description: "Aggiungi il link LinkedIn al contatto prima di inviare.", variant: "destructive" });
    } else {
      // Fallback: open dialog
      setLiDmOpen(true);
    }
  };

  const handleSend = async () => {
    if (draft.channel !== "email" || !draft.contactEmail) {
      toast({ title: "Invio disponibile solo per email con indirizzo", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const sanitizedHtml = DOMPurify.sanitize(draft.body, {
        ALLOWED_TAGS: ['br', 'p', 'b', 'i', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
      });
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: draft.contactEmail, subject: draft.subject, html: sanitizedHtml },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Email inviata!", description: `A: ${draft.contactEmail}` });
    } catch (err: any) {
      toast({ title: "Errore invio", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!draft.channel) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-chart-3/10 flex items-center justify-center mb-4"
        >
          <Sparkles className="w-7 h-7 text-primary/80" />
        </motion.div>
        <h3 className="text-sm font-medium text-foreground mb-1">AI Draft Studio</h3>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          Trascina un contatto su un canale per generare il messaggio con AI
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn("w-4 h-4", meta?.color)} />
          <span className="text-sm font-semibold text-foreground">{meta?.label}</span>
          <span className="text-xs text-muted-foreground">→</span>
          <span className="text-sm text-foreground/90">{draft.contactName}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/90">
          <span>Lingua: {draft.language}</span>
          <span>·</span>
          <span>{draft.companyName}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 bg-muted/30 p-0.5 h-8">
          <TabsTrigger value="preview" className="text-xs h-7">Preview</TabsTrigger>
          <TabsTrigger value="sources" className="text-xs h-7">Sources</TabsTrigger>
          <TabsTrigger value="variables" className="text-xs h-7">Variables</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Subject (email only) */}
          {draft.channel === "email" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground/90 font-semibold">Oggetto</label>
              <div className="mt-1 text-sm font-medium text-foreground">
                {draft.isGenerating && !draft.subject ? (
                  <span className="text-muted-foreground/70">Generazione in corso...</span>
                ) : draft.subject ? (
                  <TypewriterText text={draft.subject} speed={25} />
                ) : (
                  <span className="text-muted-foreground/70">In attesa...</span>
                )}
              </div>
            </div>
          )}

          {/* Body */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/90 font-semibold">Messaggio</label>
            <div className="mt-2 text-sm text-foreground/90 leading-relaxed">
              {draft.isGenerating && !draft.body ? (
                <div className="space-y-3">
                  <ScrapingPhaseIndicator phase={draft.scrapingPhase} linkedinProfile={draft.linkedinProfile} />
                  {[1, 2, 3].map(i => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.3, 0.5, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
                      className="h-3 rounded bg-muted/50"
                      style={{ width: `${70 + i * 10}%` }}
                    />
                  ))}
                </div>
              ) : draft.body ? (
                isHtmlContent ? (
                  <TypewriterText text={draft.body} speed={8} isHtml />
                ) : (
                  <TypewriterText text={draft.body} speed={12} />
                )
              ) : (
                <span className="text-muted-foreground/70">In attesa...</span>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sources" className="flex-1 overflow-y-auto p-4">
          {draft._debug ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Brain className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Modello AI</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Modello</span><span className="text-foreground font-mono text-[10px]">{draft._debug.model}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Qualità</span><span className="text-foreground">{draft._debug.quality}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Canale</span><span className="text-foreground">{draft._debug.channel_instructions}</span></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-chart-3" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lingua</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Rilevata</span><span className="text-foreground">{draft._debug.language_detected}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Usata</span><span className="text-foreground">{draft._debug.language_used}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paese</span><span className="text-foreground">{draft._debug.country_code}</span></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-success" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contesto Mittente</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Alias</span><span className="text-foreground">{draft._debug.sender_alias}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Azienda</span><span className="text-foreground">{draft._debug.sender_company}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Ruolo</span><span className="text-foreground">{draft._debug.sender_role}</span></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-chart-2" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Destinatario</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Nome risolto</span><span className="text-foreground">{draft._debug.recipient_name_resolved}</span></div>
                </div>
              </div>

              {/* Recipient Intelligence */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Search className="w-3 h-3 text-chart-4" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Intelligence Destinatario</span>
                </div>
                {draft._debug.recipient_intelligence ? (
                  <div className="bg-muted/30 rounded-lg p-2.5 space-y-2 text-xs">
                    {draft._debug.recipient_intelligence.warning && (
                      <div className="flex items-center gap-1.5 text-warning bg-warning/10 rounded px-2 py-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span className="text-[10px]">{draft._debug.recipient_intelligence.warning}</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground font-medium">Fonti consultate:</span>
                      <div className="flex flex-wrap gap-1">
                        {draft._debug.recipient_intelligence.sources_checked.map(src => {
                          const found = draft._debug!.recipient_intelligence!.data_found[src === "partner_contacts" ? "contacts" : src === "partner_networks" ? "networks" : src === "partner_services" ? "services" : src];
                          return (
                            <span key={src} className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-mono ${found ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"}`}>
                              {found ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                              {src.replace("partner_", "").replace("imported_", "")}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    {draft._debug.recipient_intelligence.enrichment_snippet && (
                      <details className="group">
                        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Mostra contesto iniettato nel prompt ▸</summary>
                        <pre className="mt-1 text-[9px] text-muted-foreground/90 whitespace-pre-wrap bg-background/50 rounded p-2 max-h-[150px] overflow-y-auto">
                          {draft._debug.recipient_intelligence.enrichment_snippet}
                        </pre>
                      </details>
                    )}
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-lg p-2.5 text-xs text-muted-foreground">Non disponibile</div>
                )}
              </div>

              {/* History & Enrichment Sources */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-chart-2" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fonti Arricchimento</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interazioni trovate</span>
                    <span className="text-foreground">{draft._debug.interaction_history_count ?? "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sito aziendale</span>
                    <span className={`font-mono text-[10px] ${draft._debug.website_source === "live_scraped" ? "text-success" : draft._debug.website_source === "cached" ? "text-chart-3" : "text-muted-foreground"}`}>
                      {draft._debug.website_source === "live_scraped" ? "🔴 Live" : draft._debug.website_source === "cached" ? "📦 Cache" : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">LinkedIn</span>
                    <span className={`font-mono text-[10px] ${draft._debug.linkedin_source === "live_scraped" ? "text-success" : draft._debug.linkedin_source === "cached" ? "text-chart-3" : "text-muted-foreground"}`}>
                      {draft._debug.linkedin_source === "live_scraped" ? "🔴 Live" : draft._debug.linkedin_source === "cached" ? "📦 Cache" : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3 text-warning" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Knowledge Base</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">KB caricata</span><span className={draft._debug.kb_loaded ? "text-success" : "text-destructive"}>{draft._debug.kb_loaded ? "✓ Sì" : "✗ No"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Sales KB</span><span className={draft._debug.sales_kb_loaded ? "text-success" : "text-destructive"}>{draft._debug.sales_kb_loaded ? "✓ Sì" : "✗ No"}</span></div>
                  {draft._debug.sales_kb_loaded && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Sezioni</span><span className="text-foreground">{draft._debug.sales_kb_sections}</span></div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Obiettivo & Proposta</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1 text-xs">
                  <div><span className="text-muted-foreground">Goal:</span> <span className="text-foreground">{draft._debug.goal_used}</span></div>
                  <div><span className="text-muted-foreground">Proposta:</span> <span className="text-foreground">{draft._debug.proposal_used}</span></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-warning" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Consumo</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Token input</span><span className="text-foreground font-mono">{draft._debug.tokens_input.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Token output</span><span className="text-foreground font-mono">{draft._debug.tokens_output.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Crediti usati</span><span className="text-foreground font-semibold">{draft._debug.credits_consumed}</span></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Impostazioni caricate</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {draft._debug.settings_keys_found.map(key => (
                    <span key={key} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono">{key.replace("ai_", "")}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Brain className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Genera un messaggio per vedere le fonti e i log AI</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="variables" className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {/* Content pickers */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contesto AI</span>
              </div>
              <ContentPicker type="goals" onSelect={setGoal} selectedText={goal} triggerLabel="Goal" className="w-full" />
              <ContentPicker type="proposals" onSelect={setBaseProposal} selectedText={baseProposal} triggerLabel="Proposta" className="w-full" />
            </div>
            <div className="border-t border-border/30 pt-2 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">recipient_name</span><span className="text-foreground">{draft.contactName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">company</span><span className="text-foreground">{draft.companyName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">channel</span><span className="text-foreground">{draft.channel}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">language</span><span className="text-foreground">{draft.language}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">country</span><span className="text-foreground">{draft.countryCode}</span></div>
              {draft.contactEmail && (
                <div className="flex justify-between"><span className="text-muted-foreground">email</span><span className="text-foreground">{draft.contactEmail}</span></div>
              )}
              {draft.contactPhone && (
                <div className="flex justify-between"><span className="text-muted-foreground">phone</span><span className="text-foreground">{draft.contactPhone}</span></div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions footer */}
      <AnimatePresence>
        {draft.body && !draft.isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 py-3 border-t border-border/60 flex items-center gap-2"
          >
            {/* Channel-specific primary action */}
            {draft.channel === "email" && draft.contactEmail ? (
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? "Invio..." : "Invia Email"}
              </button>
            ) : draft.channel === "whatsapp" && draft.contactPhone ? (
              <button
                onClick={handleSendWhatsApp}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(142,70%,40%)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {waBridge.isAvailable ? <Send className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                {sending ? "Invio..." : waBridge.isAvailable ? "Invia WhatsApp" : "Apri WhatsApp"}
              </button>
            ) : draft.channel === "linkedin" ? (
              <button
                onClick={handleSendLinkedIn}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(210,80%,45%)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {liBridge.isAvailable ? <Send className="w-3.5 h-3.5" /> : <Linkedin className="w-3.5 h-3.5" />}
                {sending ? "Invio..." : "Invia su LinkedIn"}
              </button>
            ) : (
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              >
                <Copy className="w-3.5 h-3.5" />
                Copia messaggio
              </button>
            )}
            <button onClick={handleCopy} className="p-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors" title="Copia">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button onClick={onRegenerate} className="p-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors" title="Rigenera">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LinkedIn DM Dialog */}
      {liDmOpen && (
        <Suspense fallback={null}>
          <LinkedInDMDialog
            open={liDmOpen}
            onOpenChange={setLiDmOpen}
            profileUrl=""
            contactName={draft.contactName}
            companyName={draft.companyName || ""}
            initialMessage={draft.body ? draft.body.replace(/<[^>]*>/g, "").trim() : ""}
          />
        </Suspense>
      )}
    </div>
  );
}
