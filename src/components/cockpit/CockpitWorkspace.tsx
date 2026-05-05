/**
 * CockpitWorkspace — area unica che fonde Oracolo + Bozza+Studio quando
 * esiste un contatto attivo o una bozza in generazione. Quando il contatto
 * non esiste, mostra solo le drop zone a tutta larghezza.
 *
 * Niente logica nuova: orchestratore di componenti già esistenti.
 */
import { OraclePanelSlim } from "@/components/email/OraclePanelSlim";
import { AIDraftStudio } from "@/components/cockpit/AIDraftStudio";
import { ChannelDropZones, type ContactAvailability } from "@/components/cockpit/ChannelDropZones";
import type { OracleConfig } from "@/components/email/OraclePanel";
import type { DraftState, DraftChannel } from "@/types/cockpit";
import { ArrowLeft, Mail, Linkedin, MessageCircle, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

const CHANNEL_META: Record<Exclude<DraftChannel, null>, { label: string; icon: React.ElementType; color: string }> = {
  email:    { label: "Email",       icon: Mail,           color: "text-primary" },
  linkedin: { label: "LinkedIn",    icon: Linkedin,       color: "text-[hsl(210,80%,55%)]" },
  whatsapp: { label: "WhatsApp",    icon: MessageCircle,  color: "text-[hsl(142,71%,45%)]" },
  sms:      { label: "SMS / Chat",  icon: Smartphone,     color: "text-accent-foreground" },
};

interface QueueItem { contactId: string; contactName: string }

interface Props {
  draftState: DraftState;
  setDraftState: (d: DraftState) => void;
  recipientPartnerId: string | null;
  // Oracolo
  onOracleGenerate: (cfg: OracleConfig) => void;
  onOracleImprove: (cfg: OracleConfig) => void;
  onLoadTemplate: (subject: string, body: string) => void;
  onInsertImage: (url: string) => void;
  // Studio
  onRegenerate: () => void;
  onGenerateAfterReview: () => void;
  onStartGeneration: () => void;
  pendingBulkCount: number;
  // Drop zones (stato A: niente contatto)
  isDragging: boolean;
  draggedContactId: string | null;
  dragCount: number;
  onDrop: (channel: DraftChannel, contactId: string, contactName: string) => void;
  onReadProfile: () => void;
  onDeepSearch: () => void;
  contactAvailability?: ContactAvailability;
  // Queue bulk
  draftQueue: QueueItem[];
  showQueuedDraft: (id: string) => void;
}

export function CockpitWorkspace(props: Props) {
  const {
    draftState, setDraftState, recipientPartnerId,
    onOracleGenerate, onOracleImprove, onLoadTemplate, onInsertImage,
    onRegenerate, onGenerateAfterReview, onStartGeneration, pendingBulkCount,
    isDragging, draggedContactId, dragCount, onDrop,
    onReadProfile, onDeepSearch, contactAvailability,
    draftQueue, showQueuedDraft,
  } = props;

  // Carosello (flip): Faccia A = 4 casellone canali; Faccia B = Oracolo + bozza.
  // Showcase B quando c'è una bozza/contatto attivo o sta generando; A altrimenti.
  // Durante il drag forziamo Faccia A (overlay grigio sull'intera colonna).
  const hasDraft = !!draftState.contactId || !!draftState.body || draftState.isGenerating;
  const showOracle = hasDraft && !isDragging;
  const channelMeta = draftState.channel ? CHANNEL_META[draftState.channel] : null;

  // Reset alla Faccia A: torna alle casellone svuotando la bozza corrente.
  const goBackToChannels = () => {
    setDraftState({
      ...draftState,
      contactId: null,
      contactName: null,
      channel: null,
      subject: "",
      body: "",
      isGenerating: false,
    });
  };

  // ── Pointer-based hit test (port da Email Intelligence / Funny Mail) ──
  // Traccia il cursore durante tutto il drag e risolve la drop zone via
  // document.elementFromPoint. Più preciso del nativo HTML5 drop e immune
  // al bug macOS in cui dragend riporta (0,0).
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!isDragging || !draggedContactId) return;

    const resolveChannel = (x: number, y: number): DraftChannel | null => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const zone = el?.closest('[data-drop-zone="true"]') as HTMLElement | null;
      const ch = zone?.getAttribute("data-channel-id") as DraftChannel | null;
      return ch ?? null;
    };

    const onDragOver = (e: DragEvent) => {
      if (e.clientX === 0 && e.clientY === 0) return;
      e.preventDefault();
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const onDragEnd = () => {
      const p = lastPointerRef.current;
      lastPointerRef.current = null;
      if (!p) return;
      const ch = resolveChannel(p.x, p.y);
      if (ch && draggedContactId) {
        onDrop(ch, draggedContactId, "Contact");
      }
    };

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragend", onDragEnd);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragend", onDragEnd);
    };
  }, [isDragging, draggedContactId, onDrop]);

  return (
    <div className="flex-1 min-w-0 overflow-hidden relative">
      <AnimatePresence mode="wait" initial={false}>
        {showOracle ? (
          // FACCIA B — Oracolo + Bozza a tutta larghezza, con header di scelta canale
          <motion.div
            key="oracle-face"
            initial={{ opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: -90 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col overflow-hidden"
            style={{ transformStyle: "preserve-3d", perspective: 1200 }}
          >
            {/* Header: freccia ← + canale scelto + nome destinatario */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 bg-card/40 shrink-0">
              <button
                onClick={goBackToChannels}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Torna alla scelta del canale"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Canali
              </button>
              {channelMeta && (
                <div className="flex items-center gap-2">
                  <channelMeta.icon className={cn("w-4 h-4", channelMeta.color)} />
                  <span className="text-sm font-semibold text-foreground">{channelMeta.label}</span>
                </div>
              )}
              {draftState.contactName && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-sm text-muted-foreground truncate">
                    {draftState.contactName
                      .replace(/^risposta(?:\s+(?:a\s+)?email[^:]*)?:\s*/i, "")
                      .replace(/^re:\s*/i, "")
                      .trim()}
                  </span>
                </>
              )}
              {draftQueue.length > 0 && (
                <div className="ml-auto flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    Bulk 1/{draftQueue.length + 1}
                  </span>
                  {draftQueue.map(q => (
                    <button
                      key={q.contactId}
                      onClick={() => showQueuedDraft(q.contactId)}
                      className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/40 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                      title={`Mostra bozza per ${q.contactName}`}
                    >
                      {q.contactName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Body: Oracolo (sx) + Studio bozza (dx) */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="w-[42%] min-w-[320px] max-w-[480px] flex-shrink-0 border-r border-border/40 flex flex-col overflow-hidden">
                <OraclePanelSlim
                  onGenerate={onOracleGenerate}
                  onImprove={onOracleImprove}
                  onLoadTemplate={onLoadTemplate}
                  onInsertImage={onInsertImage}
                  generating={!!draftState.isGenerating}
                  improving={false}
                  hasBody={!!draftState.body}
                  recipientPartnerId={recipientPartnerId}
                  recipientCount={draftState.contactId ? 1 : 0}
                  contextSummary={draftState.context_summary ?? null}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0">
                  <AIDraftStudio
                    draft={draftState}
                    onDraftChange={setDraftState}
                    onRegenerate={onRegenerate}
                    onGenerateAfterReview={onGenerateAfterReview}
                    onStartGeneration={onStartGeneration}
                    pendingBulkCount={pendingBulkCount}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          // FACCIA A — 4 casellone canali (sempre visibili, accettano drop)
          <motion.div
            key="channels-face"
            initial={{ opacity: 0, rotateY: -90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: 90 }}
            transition={{ duration: isDragging ? 0 : 0.35, ease: "easeOut" }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
            onDrop={(e) => {
              // Fallback: se il drop avviene nello spazio vuoto tra le casellone,
              // intercettiamo qui per evitare che il browser annulli l'operazione.
              // Le singole casellone restano la via primaria via stopPropagation interno.
              e.preventDefault();
            }}
            className={cn(
              "absolute inset-0 flex items-center justify-center p-8 overflow-auto",
              isDragging && "bg-background/95 backdrop-blur-sm",
            )}
            style={{ transformStyle: "preserve-3d", perspective: 1200, transformOrigin: "center" }}
          >
            <ChannelDropZones
              isDragging={isDragging}
              draggedContactId={draggedContactId}
              dragCount={dragCount}
              onDrop={onDrop}
              hasActiveContact={!!draftState.contactId}
              contactAvailability={contactAvailability}
              onReadProfile={onReadProfile}
              onDeepSearch={onDeepSearch}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
