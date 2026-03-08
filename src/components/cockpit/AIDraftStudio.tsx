import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Mail, Linkedin, MessageCircle, Smartphone, Copy, Send, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftState, DraftChannel } from "@/pages/Cockpit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";

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
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-primary/70">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                      <Sparkles className="w-4 h-4" />
                    </motion.div>
                    <span className="text-xs">AI sta generando il messaggio {draft.channel}...</span>
                  </div>
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

        <TabsContent value="variables" className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">recipient_name</span><span className="text-foreground">{draft.contactName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">company</span><span className="text-foreground">{draft.companyName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">channel</span><span className="text-foreground">{draft.channel}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">language</span><span className="text-foreground">{draft.language}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">country</span><span className="text-foreground">{draft.countryCode}</span></div>
            {draft.contactEmail && (
              <div className="flex justify-between"><span className="text-muted-foreground">email</span><span className="text-foreground">{draft.contactEmail}</span></div>
            )}
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
            {draft.channel === "email" && draft.contactEmail ? (
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? "Invio..." : "Invia"}
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
    </div>
  );
}
