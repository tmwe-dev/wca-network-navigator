import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Mail, Linkedin, MessageCircle, Smartphone, Copy, Send, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftState, DraftChannel } from "@/pages/Cockpit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AIDraftStudioProps {
  draft: DraftState;
  onDraftChange: (draft: DraftState) => void;
}

const channelMeta: Record<string, { icon: any; label: string; color: string }> = {
  email: { icon: Mail, label: "Email", color: "text-primary" },
  linkedin: { icon: Linkedin, label: "LinkedIn", color: "text-[hsl(210,80%,55%)]" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "text-success" },
  sms: { icon: Smartphone, label: "SMS", color: "text-chart-3" },
};

function TypewriterText({ text, speed = 20 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;
    if (!text) return;

    const interval = setInterval(() => {
      indexRef.current++;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        setDone(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

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

export function AIDraftStudio({ draft, onDraftChange }: AIDraftStudioProps) {
  const meta = draft.channel ? channelMeta[draft.channel] : null;
  const Icon = meta?.icon || Sparkles;

  if (!draft.channel) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-chart-3/10 flex items-center justify-center mb-4"
        >
          <Sparkles className="w-7 h-7 text-primary/70" />
        </motion.div>
        <h3 className="text-sm font-medium text-foreground mb-1">AI Draft Studio</h3>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          Trascina un contatto su un canale per generare il messaggio
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn("w-4 h-4", meta?.color)} />
          <span className="text-sm font-semibold text-foreground">{meta?.label}</span>
          <span className="text-xs text-muted-foreground">→</span>
          <span className="text-sm text-foreground/80">{draft.contactName}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80">
          <span>Lingua: {draft.language}</span>
          <span>·</span>
          <span>Tono: professionale</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 bg-muted/30 p-0.5 h-8">
          <TabsTrigger value="preview" className="text-xs h-7">Preview</TabsTrigger>
          <TabsTrigger value="prompt" className="text-xs h-7">Prompt</TabsTrigger>
          <TabsTrigger value="variables" className="text-xs h-7">Variables</TabsTrigger>
          <TabsTrigger value="history" className="text-xs h-7">History</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Subject */}
          {draft.channel === "email" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Oggetto</label>
              <div className="mt-1 text-sm font-medium text-foreground">
                {draft.isGenerating ? (
                  <TypewriterText text={draft.subject} speed={30} />
                ) : (
                  draft.subject || <span className="text-muted-foreground/60">In generazione...</span>
                )}
              </div>
            </div>
          )}

          {/* Body */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Messaggio</label>
            <div className="mt-2 text-sm text-foreground/90 leading-relaxed">
              {draft.isGenerating ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-primary/60">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                      <Sparkles className="w-4 h-4" />
                    </motion.div>
                    <span className="text-xs">AI sta generando...</span>
                  </div>
                  {[1, 2, 3].map(i => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.2, 0.4, 0.2] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
                      className="h-3 rounded bg-muted/50"
                      style={{ width: `${70 + i * 10}%` }}
                    />
                  ))}
                </div>
              ) : draft.body ? (
                <TypewriterText text={draft.body} speed={15} />
              ) : (
                <span className="text-muted-foreground/60">In attesa...</span>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prompt" className="flex-1 overflow-y-auto p-4">
          <div className="text-xs text-muted-foreground space-y-2">
            <p>System: Sei un esperto copywriter B2B nel settore freight forwarding...</p>
            <p>Goal: Proposta di collaborazione</p>
            <p>Lingua: {draft.language}</p>
            <p>Tono: professionale</p>
          </div>
        </TabsContent>

        <TabsContent value="variables" className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">recipient_name</span><span className="text-foreground">{draft.contactName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">channel</span><span className="text-foreground">{draft.channel}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">language</span><span className="text-foreground">{draft.language}</span></div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-y-auto p-4">
          <p className="text-xs text-muted-foreground/70 text-center py-8">Nessuna generazione precedente</p>
        </TabsContent>
      </Tabs>

      {/* Actions footer */}
      <AnimatePresence>
        {draft.body && !draft.isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 py-3 border-t border-border/50 flex items-center gap-2"
          >
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
              <Send className="w-3.5 h-3.5" />
              Invia
            </button>
            <button className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors" title="Copia">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors" title="Rigenera">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
