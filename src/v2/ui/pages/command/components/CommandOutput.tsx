import { AnimatePresence, motion } from "framer-motion";
import type { ToolResult, BulkAction } from "../tools/types";
import type { CanvasType } from "../constants";
import CardGridCanvas from "../canvas/CardGridCanvas";
import TimelineCanvas from "../canvas/TimelineCanvas";
import FlowCanvas from "../canvas/FlowCanvas";
import ComposerCanvas from "../canvas/ComposerCanvas";
import TableCanvas from "../canvas/TableCanvas";
import { X } from "lucide-react";

interface CommandOutputProps {
  canvas: CanvasType;
  liveResult: ToolResult | null;
  activeScenarioKey: string | null;
  onClose: () => void;
  /** Selection */
  selectedIds: Set<string>;
  onToggleId: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onBulkAction: (action: BulkAction, ids: string[]) => void;
}

const ease = [0.2, 0.8, 0.2, 1] as const;

export function CommandOutput({
  canvas,
  liveResult,
  activeScenarioKey,
  onClose,
  selectedIds,
  onToggleId,
  onSelectAll,
  onClearSelection,
  onBulkAction,
}: CommandOutputProps) {
  return (
    <AnimatePresence>
      {canvas && (
        <motion.div
          initial={{ opacity: 0, x: 60, scale: 0.95, filter: "blur(10px)" }}
          animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: 60, scale: 0.95, filter: "blur(10px)" }}
          transition={{ duration: 0.7, ease }}
          className="w-[50%] p-4 overflow-y-auto"
        >
          {/* Mock canvas (table/campaign/report/result) RIMOSSI:
              non esistono più dati mock nella piattaforma operativa.
              Solo i canvas LIVE alimentati da tool reali sono renderizzati. */}
          {canvas === "live-table" && liveResult && (
            liveResult.kind === "table" ? (
              <div
                className="h-full flex flex-col rounded-2xl p-6"
                style={{
                  background: "hsl(var(--card) / 0.75)",
                  backdropFilter: "blur(40px) saturate(1.1)",
                  border: "1px solid hsl(var(--foreground) / 0.12)",
                  boxShadow:
                    "0 0 80px hsl(var(--primary) / 0.03), 0 30px 60px -20px hsl(0 0% 0% / 0.65)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-light text-foreground">
                    {liveResult.title}
                  </h3>
                  <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground p-1.5"
                    aria-label="Chiudi canvas"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <TableCanvas
                    columns={[...liveResult.columns]}
                    rows={[...liveResult.rows]}
                    isLive
                    meta={liveResult.meta}
                    selectable={liveResult.selectable}
                    idField={liveResult.idField}
                    selectedIds={selectedIds}
                    onToggleId={onToggleId}
                    onSelectAll={onSelectAll}
                    onClearSelection={onClearSelection}
                    bulkActions={liveResult.bulkActions}
                    onBulkAction={onBulkAction}
                  />
                </div>
              </div>
            ) : null
          )}
          {canvas === "live-card-grid" &&
            liveResult &&
            liveResult.kind === "card-grid" && (
              <div className="float-panel p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-light text-foreground">
                    {liveResult.title}
                  </h3>
                  <button
                    onClick={onClose}
                    className="text-muted-foreground/60 hover:text-foreground text-[10px]"
                  >
                    ✕
                  </button>
                </div>
                <CardGridCanvas
                  items={liveResult.cards.map((c) => ({
                    id: c.id,
                    name: c.title,
                    company: c.subtitle,
                    lastContact: c.lastContact
                      ? `${Math.round(
                          (Date.now() -
                            new Date(c.lastContact).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )} giorni fa`
                      : "Mai contattato",
                    action: c.suggestedAction,
                    meta: [...c.meta],
                  }))}
                  title={`${liveResult.cards.length} contatti inattivi`}
                  badge="LIVE"
                  sourceLabel={liveResult.meta?.sourceLabel}
                  selectable={liveResult.selectable}
                  selectedIds={selectedIds}
                  onToggleId={onToggleId}
                  onSelectAll={onSelectAll}
                  onClearSelection={onClearSelection}
                  bulkActions={liveResult.bulkActions}
                  onBulkAction={onBulkAction}
                />
              </div>
            )}
          {canvas === "live-timeline" &&
            liveResult &&
            liveResult.kind === "timeline" && (
              <div className="float-panel p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider bg-success/20 text-success">
                      LIVE
                    </span>
                    <h3 className="text-[13px] font-light text-foreground">
                      {liveResult.title}
                    </h3>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-muted-foreground/60 hover:text-foreground text-[10px]"
                  >
                    ✕
                  </button>
                </div>
                {liveResult.meta?.sourceLabel && (
                  <div className="text-[9px] text-muted-foreground/60 font-mono mb-3">
                    {liveResult.meta.sourceLabel} · {liveResult.meta.count}{" "}
                    record
                  </div>
                )}
                {liveResult.events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-[12px] text-muted-foreground/60 font-light">
                      Nessuna attività registrata negli ultimi 7gg
                    </p>
                  </div>
                ) : (
                  <TimelineCanvas
                    events={[...liveResult.events]}
                    kpis={[...liveResult.kpis]}
                  />
                )}
              </div>
            )}
          {canvas === "live-flow" &&
            liveResult &&
            liveResult.kind === "flow" && (
              <div className="float-panel p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-light text-foreground">
                    {liveResult.title}
                  </h3>
                  <button
                    onClick={onClose}
                    className="text-muted-foreground/60 hover:text-foreground text-[10px]"
                  >
                    ✕
                  </button>
                </div>
                {liveResult.nodes.length <= 1 &&
                liveResult.nodes[0]?.type === "end" ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-[12px] text-muted-foreground/60 font-light">
                      Nessuna campagna in corso
                    </p>
                  </div>
                ) : (
                  <FlowCanvas
                    nodes={[...liveResult.nodes]}
                    title={`${liveResult.meta?.count ?? 0} job totali`}
                    badge="LIVE"
                    sourceLabel={liveResult.meta?.sourceLabel}
                  />
                )}
              </div>
            )}
          {canvas === "live-composer" &&
            liveResult &&
            liveResult.kind === "composer" && (
              <ComposerCanvas
                initialTo={liveResult.initialTo}
                initialSubject={liveResult.initialSubject}
                initialBody={liveResult.initialBody}
                promptHint={liveResult.promptHint}
                partnerId={liveResult.partnerId ?? null}
                recipientName={liveResult.recipientName ?? null}
                emailType={liveResult.emailType}
                drafts={liveResult.drafts}
                detectedTone={liveResult.detectedTone}
                onClose={onClose}
              />
            )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
