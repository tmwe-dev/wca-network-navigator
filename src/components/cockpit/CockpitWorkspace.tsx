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
    onRegenerate, onGenerateAfterReview,
    isDragging, draggedContactId, dragCount, onDrop,
    onReadProfile, onDeepSearch, contactAvailability,
    draftQueue, showQueuedDraft,
  } = props;

  const hasActive = !!draftState.contactId || !!draftState.body || draftState.isGenerating || isDragging;

  // STATO A: nessun contatto, nessuna bozza, nessun drag → drop zone full width
  if (!hasActive) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 min-w-0">
        <ChannelDropZones
          isDragging={false}
          draggedContactId={null}
          dragCount={0}
          onDrop={onDrop}
          hasActiveContact={false}
        />
      </div>
    );
  }

  // STATO B: workspace 2 colonne (Oracolo + Studio)
  return (
    <div className="flex-1 flex min-w-0 overflow-hidden">
      {/* Drop overlay quando trascini un contatto sopra il workspace */}
      {isDragging && (
        <div className="absolute inset-0 z-20 bg-background/85 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <ChannelDropZones
              isDragging
              draggedContactId={draggedContactId}
              dragCount={dragCount}
              onDrop={onDrop}
              hasActiveContact={!!draftState.contactId}
              contactAvailability={contactAvailability}
            />
          </div>
        </div>
      )}

      {/* Colonna Oracolo */}
      <div className="w-[38%] min-w-[300px] max-w-[440px] flex-shrink-0 border-r border-border/40 flex flex-col overflow-hidden">
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

      {/* Colonna Studio (bozza viva) */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {draftQueue.length > 0 && (
          <div className="px-3 py-2 border-b border-border/40 bg-muted/20 text-[10px] text-muted-foreground flex items-center gap-2 overflow-x-auto">
            <span className="font-semibold text-foreground shrink-0">
              Bulk (1/{draftQueue.length + 1}):
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
              ● {draftState.contactName || "—"}
            </span>
            {draftQueue.map(q => (
              <button
                key={q.contactId}
                onClick={() => showQueuedDraft(q.contactId)}
                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/40 hover:border-primary/40 hover:text-foreground transition-colors"
                title={`Mostra bozza per ${q.contactName}`}
              >
                {q.contactName}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0">
          <AIDraftStudio
            draft={draftState}
            onDraftChange={setDraftState}
            onRegenerate={onRegenerate}
            onGenerateAfterReview={onGenerateAfterReview}
          />
        </div>
      </div>
    </div>
  );
}
