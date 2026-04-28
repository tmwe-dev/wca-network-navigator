/**
 * ComposerCanvas — Glass-style email composer for Command page.
 * Uses useEmailComposerV2 for real AI generation + send via edge functions.
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, X, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useEmailComposerV2 } from "@/v2/hooks/useEmailComposerV2";
import { invokeEdge } from "@/lib/api/invokeEdge";
import ApprovalPanel from "@/components/workspace/ApprovalPanel";
import { useGovernance } from "../hooks/useGovernance";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface ComposerCanvasProps {
  readonly initialTo: string;
  readonly initialSubject: string;
  readonly initialBody: string;
  readonly promptHint: string;
  readonly onClose: () => void;
  /** Partner risolto dall'Oracolo: abilita rigenerazione via generate-email. */
  readonly partnerId?: string | null;
  readonly recipientName?: string | null;
  readonly emailType?: string;
}

export default function ComposerCanvas({
  initialTo,
  initialSubject,
  initialBody,
  promptHint,
  onClose,
  partnerId,
  recipientName,
  emailType,
}: ComposerCanvasProps) {
  const composer = useEmailComposerV2();
  const governance = useGovernance("compose-email");

  const [toField, setToField] = useState(initialTo);
  const [showApproval, setShowApproval] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Sync initial values on mount
  useState(() => {
    if (initialSubject) composer.setSubject(initialSubject);
    if (initialBody) composer.setBody(initialBody);
    if (initialTo) {
      composer.addRecipient({
        email: initialTo,
        name: initialTo.split("@")[0] ?? initialTo,
      });
    }
  });

  const handleAddRecipient = useCallback(() => {
    const email = toField.trim();
    if (!email || !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
      toast.error("Indirizzo email non valido");
      return;
    }
    composer.addRecipient({ email, name: email.split("@")[0] ?? email });
    setToField("");
  }, [toField, composer]);

  const handleGenerate = useCallback(async () => {
    // Se abbiamo un partner risolto → usa la pipeline ufficiale generate-email
    if (partnerId) {
      setRegenerating(true);
      try {
        const gen = await invokeEdge<{ subject?: string; body?: string }>("generate-email", {
          body: {
            standalone: true,
            partner_id: partnerId,
            recipient_name: recipientName ?? null,
            oracle_type: emailType ?? "primo_contatto",
            oracle_tone: "professionale",
            goal: promptHint,
            quality: "standard",
            use_kb: true,
            language: "it",
          },
          context: "composer:regenerate",
        });
        if (gen?.subject) composer.setSubject(gen.subject);
        if (gen?.body) composer.setBody(gen.body);
        toast.success("Bozza rigenerata");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Errore rigenerazione");
      } finally {
        setRegenerating(false);
      }
      return;
    }
    // Fallback (nessun partner risolto): usa il generator legacy
    composer.generate.mutate(promptHint || undefined);
  }, [composer, promptHint, partnerId, recipientName, emailType]);

  const handleSendClick = useCallback(() => {
    if (composer.recipients.length === 0) {
      toast.error("Aggiungi almeno un destinatario");
      return;
    }
    if (!composer.subject) {
      toast.error("Inserisci un oggetto");
      return;
    }
    if (!composer.body) {
      toast.error("Inserisci il corpo dell'email");
      return;
    }
    setShowApproval(true);
  }, [composer]);

  const handleConfirmSend = useCallback(() => {
    setShowApproval(false);
    composer.send.mutate(undefined, {
      onSuccess: () => {
        toast.success("Email inviata con successo");
        onClose();
      },
      onError: (err: Error) => {
        toast.error(`Errore invio: ${err.message}`);
      },
    });
  }, [composer, onClose]);

  const isGenerating = composer.generate.isPending || regenerating;
  const isSending = composer.send.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.6, ease }}
      className="float-panel rounded-2xl p-6 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider bg-primary/20 text-primary">
            COMPOSER
          </span>
          <Mail className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="text-[13px] font-light text-foreground">Componi email</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground/60 hover:text-foreground text-[10px] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Recipients */}
      <div className="space-y-1">
        <label className="text-[9px] font-mono text-muted-foreground/70 tracking-wider uppercase">
          Destinatari
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1.5 flex-wrap rounded-xl px-3 py-2 min-h-[40px]"
            style={{ background: "hsl(240 5% 10% / 0.5)", border: "1px solid hsl(0 0% 100% / 0.06)" }}
          >
            {composer.recipients.map((r) => (
              <motion.span
                key={r.email}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono bg-primary/10 text-primary/80"
              >
                {r.email}
                <button
                  onClick={() => composer.removeRecipient(r.email)}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </motion.span>
            ))}
            <input
              value={toField}
              onChange={(e) => setToField(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddRecipient();
                }
              }}
              placeholder={composer.recipients.length === 0 ? "email@esempio.com" : "Aggiungi..."}
              className="flex-1 min-w-[120px] bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-1">
        <label className="text-[9px] font-mono text-muted-foreground/70 tracking-wider uppercase">
          Oggetto
        </label>
        <input
          value={composer.subject}
          onChange={(e) => composer.setSubject(e.target.value)}
          placeholder="Oggetto dell'email"
          className="w-full rounded-xl px-3 py-2.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/40"
          style={{ background: "hsl(240 5% 10% / 0.5)", border: "1px solid hsl(0 0% 100% / 0.06)" }}
        />
      </div>

      {/* Body */}
      <div className="space-y-1 flex-1">
        <label className="text-[9px] font-mono text-muted-foreground/70 tracking-wider uppercase">
          Corpo
        </label>
        <div className="relative">
          <textarea
            value={composer.body}
            onChange={(e) => composer.setBody(e.target.value)}
            placeholder="Scrivi il contenuto dell'email..."
            rows={12}
            className="w-full rounded-xl px-3 py-2.5 text-[12px] text-foreground outline-none resize-none placeholder:text-muted-foreground/40 leading-relaxed"
            style={{ background: "hsl(240 5% 10% / 0.5)", border: "1px solid hsl(0 0% 100% / 0.06)" }}
          />
          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center rounded-xl"
                style={{ background: "hsl(240 5% 6% / 0.8)", backdropFilter: "blur(8px)" }}
              >
                <div className="flex items-center gap-2 text-primary/80">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-[11px] font-light">Generazione AI in corso...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between pt-2"
        style={{ borderTop: "1px solid hsl(0 0% 100% / 0.04)" }}
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-light transition-all duration-300 disabled:opacity-50"
          style={{
            background: "hsl(270 60% 60% / 0.1)",
            border: "1px solid hsl(270 60% 60% / 0.15)",
            color: "hsl(270 60% 70%)",
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Genera con AI
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSendClick}
          disabled={isSending}
          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[11px] font-light bg-success/10 text-success/80 hover:bg-success/15 transition-all duration-300 disabled:opacity-50"
          style={{ border: "1px solid hsl(152 60% 45% / 0.15)" }}
        >
          {isSending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Invia
        </motion.button>
      </div>

      {/* Approval Panel */}
      <ApprovalPanel
        visible={showApproval}
        title="Conferma invio email"
        description={`Stai per inviare un'email a ${composer.recipients.map(r => r.email).join(", ")}. Questa azione non è reversibile.`}
        details={[
          { label: "Destinatari", value: String(composer.recipients.length) },
          { label: "Oggetto", value: composer.subject || "—" },
          { label: "Lunghezza corpo", value: `${composer.body.length} caratteri` },
        ]}
        governance={governance}
        onApprove={handleConfirmSend}
        onModify={() => setShowApproval(false)}
        onCancel={() => setShowApproval(false)}
      />
    </motion.div>
  );
}
