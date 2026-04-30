/**
 * ComposerCanvas — Glass-style email composer for Command page.
 * Uses useEmailComposerV2 for real AI generation + send via edge functions.
 *
 * Supporta DUE modalità:
 *  - SINGLE: una bozza singola (partner risolto), rigenerazione via generate-email.
 *  - BATCH: array `drafts` con N bozze pre-personalizzate, frecce di navigazione,
 *           "Rigenera tutte" e "Invia tutte". Stato del composer sincronizzato
 *           con la bozza correntemente selezionata.
 */
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, X, Loader2, Mail, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useEmailComposerV2 } from "@/v2/hooks/useEmailComposerV2";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { createCampaignDraftQueue } from "@/data/emailCampaigns";
import ApprovalPanel from "@/components/workspace/ApprovalPanel";
import { useGovernance } from "../hooks/useGovernance";
import HtmlEmailEditor from "@/components/email/HtmlEmailEditor";
import type { ComposerDraft } from "../tools/types";
import { detectTone, toneLabel, type DetectedTone } from "../lib/toneDetector";
import { useAuth } from "@/providers/AuthProvider";

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
  /** Bozze multiple pre-personalizzate (modalità BATCH country-wide). */
  readonly drafts?: ReadonlyArray<ComposerDraft>;
  /** Tono iniziale detectato dal prompt (default: "professionale"). */
  readonly detectedTone?: DetectedTone;
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
  drafts,
  detectedTone,
}: ComposerCanvasProps) {
  const composer = useEmailComposerV2();
  const governance = useGovernance("compose-email");
  const { user } = useAuth();

  const [toField, setToField] = useState(initialTo);
  const [showApproval, setShowApproval] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [batchSending, setBatchSending] = useState(false);
  const [batchDrafts, setBatchDrafts] = useState<ReadonlyArray<ComposerDraft>>(drafts ?? []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tone, setTone] = useState<DetectedTone>(detectedTone ?? "professionale");

  const isBatch = batchDrafts.length > 1;

  // ── Sync iniziale + ad ogni cambio di initialSubject/initialBody/initialTo ──
  // FIX: il vecchio `useState(initializer)` non rigirava mai, quindi i nuovi
  // valori dopo "rigenera con tono X" restavano invisibili nel Canvas.
  useEffect(() => {
    if (isBatch) return; // batch usa l'effetto sotto
    if (initialSubject !== undefined) composer.setSubject(initialSubject);
    if (initialBody !== undefined) composer.setBody(initialBody);
    if (initialTo) {
      // Reset destinatari al singolo iniziale
      for (const r of composer.recipients) composer.removeRecipient(r.email);
      composer.addRecipient({
        email: initialTo,
        name: recipientName ?? (initialTo.split("@")[0] ?? initialTo),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSubject, initialBody, initialTo, isBatch]);

  // ── Sync nuova lista di drafts (es. dopo "rigenera tutte") ──
  useEffect(() => {
    if (drafts && drafts.length > 0) {
      setBatchDrafts(drafts);
      setCurrentIndex(0);
    }
  }, [drafts]);

  useEffect(() => {
    if (detectedTone) setTone(detectedTone);
  }, [detectedTone]);

  // ── Sync composer con la bozza batch correntemente selezionata ──
  useEffect(() => {
    if (!isBatch) return;
    const d = batchDrafts[currentIndex];
    if (!d) return;
    composer.setSubject(d.subject ?? "");
    composer.setBody(d.body ?? "");
    // Reset destinatari → metti solo quello della bozza corrente
    for (const r of composer.recipients) composer.removeRecipient(r.email);
    if (d.contactEmail) {
      composer.addRecipient({
        email: d.contactEmail,
        name: d.contactName ?? d.partnerName,
        companyName: d.partnerName,
        partnerId: d.partnerId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, batchDrafts, isBatch]);

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
    // BATCH → rigenera tutte le N bozze in parallelo col tono corrente
    if (isBatch) {
      setRegenerating(true);
      const newTone = detectTone(promptHint) ?? tone;
      try {
        const settled = await Promise.allSettled(
          batchDrafts.map(async (d) => {
            if (!d.contactEmail || !d.partnerId) return d;
            try {
              const gen = await invokeEdge<{ subject?: string; body?: string }>("generate-email", {
                body: {
                  standalone: true,
                  partner_id: d.partnerId,
                  recipient_name: d.contactName,
                  recipient_company: d.partnerName,
                  oracle_type: emailType ?? "primo_contatto",
                  oracle_tone: newTone,
                  goal: promptHint,
                  quality: "standard",
                  use_kb: true,
                  language: "it",
                },
                context: "composer:regenerate-batch",
              });
              return {
                ...d,
                subject: gen?.subject ?? d.subject,
                body: gen?.body ?? d.body,
                status: gen?.body ? ("ok" as const) : ("ai_error" as const),
              };
            } catch {
              return { ...d, status: "ai_error" as const };
            }
          }),
        );
        const next: ComposerDraft[] = settled.map((r, i) =>
          r.status === "fulfilled" ? r.value : batchDrafts[i],
        );
        setBatchDrafts(next);
        setTone(newTone);
        toast.success(`${next.filter((d) => d.status === "ok").length}/${next.length} bozze rigenerate (${toneLabel(newTone)})`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Errore rigenerazione batch");
      } finally {
        setRegenerating(false);
      }
      return;
    }

    // Se abbiamo un partner risolto → usa la pipeline ufficiale generate-email
    if (partnerId) {
      setRegenerating(true);
      try {
        const newTone = detectTone(promptHint) ?? tone;
        const gen = await invokeEdge<{ subject?: string; body?: string }>("generate-email", {
          body: {
            standalone: true,
            partner_id: partnerId,
            recipient_name: recipientName ?? null,
            oracle_type: emailType ?? "primo_contatto",
            oracle_tone: newTone,
            goal: promptHint,
            quality: "standard",
            use_kb: true,
            language: "it",
          },
          context: "composer:regenerate",
        });
        if (gen?.subject) composer.setSubject(gen.subject);
        if (gen?.body) composer.setBody(gen.body);
        setTone(newTone);
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
  }, [composer, promptHint, partnerId, recipientName, emailType, isBatch, batchDrafts, tone]);

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

  /** Bulk: mette le bozze in uscita, ma NON invia. L'invio parte solo da conferma umana nella coda. */
  const handleSendAllBatch = useCallback(async () => {
    if (!isBatch) return;
    const sendable = batchDrafts.filter((d) => d.status === "ok" && d.contactEmail && d.body && d.subject);
    if (sendable.length === 0) {
      toast.error("Nessuna bozza pronta da mettere in uscita");
      return;
    }
    if (!user?.id) {
      toast.error("Sessione non valida");
      return;
    }
    setBatchSending(true);
    try {
      const queued = await createCampaignDraftQueue({
        userId: user.id,
        subject: sendable[0]?.subject ?? "Bozze email batch",
        htmlBody: sendable[0]?.body ?? "",
        partnerIds: sendable.map((d) => d.partnerId),
        recipients: sendable.map((d) => ({
          partner_id: d.partnerId,
          email: d.contactEmail,
          name: d.contactName ?? d.partnerName,
          subject: d.subject,
          html: d.body,
        })),
      });
      toast.success(`${queued.queued} email messe in uscita. Invio fermo finché non lo autorizzi dalla coda.`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore accodamento");
    } finally {
      setBatchSending(false);
    }
  }, [isBatch, batchDrafts, onClose, user?.id]);

  const isGenerating = composer.generate.isPending || regenerating;
  const isSending = composer.send.isPending || batchSending;
  const currentDraft = isBatch ? batchDrafts[currentIndex] : null;

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
          <span className="text-[13px] font-light text-foreground">
            {isBatch ? `Componi email · batch ${batchDrafts.length}` : "Componi email"}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-muted/40 text-muted-foreground">
            tono: {toneLabel(tone)}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground/60 hover:text-foreground text-[10px] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Batch navigation header */}
      {isBatch && currentDraft && (
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{ background: "hsl(240 5% 10% / 0.5)", border: "1px solid hsl(0 0% 100% / 0.06)" }}
        >
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => (i - 1 + batchDrafts.length) % batchDrafts.length)}
            disabled={isGenerating || isSending}
            className="p-1 rounded hover:bg-foreground/5 disabled:opacity-40 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Bozza precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex flex-col items-center text-center min-w-0 flex-1 px-2">
            <span className="text-[10px] font-mono text-muted-foreground/70 tracking-wider">
              {currentIndex + 1} / {batchDrafts.length}
            </span>
            <span className="text-[12px] text-foreground truncate max-w-full font-light">
              {currentDraft.partnerName}
              {currentDraft.contactName ? ` · ${currentDraft.contactName}` : ""}
            </span>
            {currentDraft.status !== "ok" && (
              <span className="text-[9px] font-mono text-warning mt-0.5">
                {currentDraft.status === "no_email" ? "⚠ no email" : "⚠ generazione fallita"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => (i + 1) % batchDrafts.length)}
            disabled={isGenerating || isSending}
            className="p-1 rounded hover:bg-foreground/5 disabled:opacity-40 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Bozza successiva"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

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
          <HtmlEmailEditor
            value={composer.body}
            onChange={composer.setBody}
            placeholder="Scrivi il contenuto dell'email..."
            className="min-h-[300px] [&_[contenteditable]]:rounded-xl [&_[contenteditable]]:border-border [&_[contenteditable]]:bg-background/50 [&_[contenteditable]]:text-xs [&_[contenteditable]]:leading-relaxed"
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
          disabled={isGenerating || isSending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-light transition-all duration-300 disabled:opacity-50"
          style={{
            background: "hsl(270 60% 60% / 0.1)",
            border: "1px solid hsl(270 60% 60% / 0.15)",
            color: "hsl(270 60% 70%)",
          }}
        >
          {isBatch ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {isBatch ? `Rigenera tutte (${batchDrafts.length})` : "Genera con AI"}
        </motion.button>

        <div className="flex items-center gap-2">
          {isBatch && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSendAllBatch}
              disabled={isGenerating || isSending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-light transition-all duration-300 disabled:opacity-50"
              style={{
                background: "hsl(152 60% 45% / 0.1)",
                border: "1px solid hsl(152 60% 45% / 0.2)",
                color: "hsl(152 60% 60%)",
              }}
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Metti in uscita ({batchDrafts.filter((d) => d.status === "ok").length})
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSendClick}
            disabled={isSending || isGenerating}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[11px] font-light bg-success/10 text-success/80 hover:bg-success/15 transition-all duration-300 disabled:opacity-50"
            style={{ border: "1px solid hsl(152 60% 45% / 0.15)" }}
          >
            {isSending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {isBatch ? "Rivedi questa" : "Invia"}
          </motion.button>
        </div>
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
