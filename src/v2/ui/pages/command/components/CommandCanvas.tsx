/**
 * CommandCanvas — right-side canvas panel.
 * Live-only: renders the most recent tool result + LiveActivityRail.
 * Supports selectable canvases with bulk-action dispatch back to the AI loop.
 */
import { motion, AnimatePresence } from "framer-motion";
import TableCanvas from "../canvas/TableCanvas";
import CardGridCanvas from "../canvas/CardGridCanvas";
import TimelineCanvas from "../canvas/TimelineCanvas";
import FlowCanvas from "../canvas/FlowCanvas";
import ComposerCanvas from "../canvas/ComposerCanvas";
import LiveActivityRail from "../canvas/LiveActivityRail";
import { useCommandRealtime } from "../hooks/useCommandRealtime";
import type { ToolResult, BulkAction } from "../tools/types";
import type { CanvasType } from "../constants";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface Props {
  canvas: CanvasType;
  liveResult: ToolResult | null;
  onClose: () => void;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  onBulkAction: (action: BulkAction, ids: string[]) => void;
}

export default function CommandCanvas({
  canvas, liveResult, onClose,
  selectedIds, toggleSelected, selectAll, clearSelection, onBulkAction,
}: Props) {
  const handleClose = () => onClose();
  const { activities } = useCommandRealtime();

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
          {canvas === "live-table" && liveResult && liveResult.kind === "table" && (
            <div className="float-panel p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-light text-foreground">{liveResult.title}</h3>
                <button onClick={handleClose} className="text-muted-foreground/60 hover:text-foreground text-[10px]">✕</button>
              </div>
              <TableCanvas
                columns={liveResult.columns}
                rows={liveResult.rows}
                isLive
                meta={liveResult.meta}
                selectable={liveResult.selectable}
                idField={liveResult.idField}
                selectedIds={selectedIds}
                onToggleId={toggleSelected}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
                bulkActions={liveResult.bulkActions}
                onBulkAction={onBulkAction}
              />
              <LiveActivityRail activities={activities} />
            </div>
          )}
          {canvas === "live-card-grid" && liveResult && liveResult.kind === "card-grid" && (
            <div className="float-panel p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-light text-foreground">{liveResult.title}</h3>
                <button onClick={handleClose} className="text-muted-foreground/60 hover:text-foreground text-[10px]">✕</button>
              </div>
              <CardGridCanvas
                items={liveResult.cards.map(c => ({
                  id: c.id,
                  name: c.title,
                  company: c.subtitle,
                  lastContact: c.lastContact
                    ? `${Math.round((Date.now() - new Date(c.lastContact).getTime()) / (1000 * 60 * 60 * 24))} giorni fa`
                    : "Mai contattato",
                  action: c.suggestedAction,
                  meta: [...c.meta],
                }))}
                title={`${liveResult.cards.length} contatti`}
                badge="LIVE"
                sourceLabel={liveResult.meta?.sourceLabel}
                selectable={liveResult.selectable}
                selectedIds={selectedIds}
                onToggleId={toggleSelected}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
                bulkActions={liveResult.bulkActions}
                onBulkAction={onBulkAction}
              />
              <LiveActivityRail activities={activities} />
            </div>
          )}
          {canvas === "live-timeline" && liveResult && liveResult.kind === "timeline" && (
            <div className="float-panel p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider bg-success/20 text-success">LIVE</span>
                  <h3 className="text-[13px] font-light text-foreground">{liveResult.title}</h3>
                </div>
                <button onClick={handleClose} className="text-muted-foreground/60 hover:text-foreground text-[10px]">✕</button>
              </div>
              {liveResult.meta?.sourceLabel && (
                <div className="text-[9px] text-muted-foreground/60 font-mono mb-3">{liveResult.meta.sourceLabel} · {liveResult.meta.count} record</div>
              )}
              {liveResult.events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-[12px] text-muted-foreground/60 font-light">Nessuna attività registrata</p>
                </div>
              ) : (
                <TimelineCanvas events={[...liveResult.events]} kpis={[...liveResult.kpis]} />
              )}
              <LiveActivityRail activities={activities} />
            </div>
          )}
          {canvas === "live-flow" && liveResult && liveResult.kind === "flow" && (
            <div className="float-panel p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-light text-foreground">{liveResult.title}</h3>
                <button onClick={handleClose} className="text-muted-foreground/60 hover:text-foreground text-[10px]">✕</button>
              </div>
              {liveResult.nodes.length <= 1 && liveResult.nodes[0]?.type === "end" ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-[12px] text-muted-foreground/60 font-light">Nessun flusso in corso</p>
                </div>
              ) : (
                <FlowCanvas nodes={[...liveResult.nodes]} title={`${liveResult.meta?.count ?? 0} job totali`} badge="LIVE" sourceLabel={liveResult.meta?.sourceLabel} />
              )}
              <LiveActivityRail activities={activities} />
            </div>
          )}
          {canvas === "live-composer" && liveResult && liveResult.kind === "composer" && (
            <ComposerCanvas
              initialTo={liveResult.initialTo}
              initialSubject={liveResult.initialSubject}
              initialBody={liveResult.initialBody}
              promptHint={liveResult.promptHint}
              partnerId={liveResult.partnerId ?? null}
              recipientName={liveResult.recipientName ?? null}
              emailType={liveResult.emailType}
              onClose={handleClose}
            />
          )}
          {canvas === "live-report" && liveResult && liveResult.kind === "report" && (
            <div className="float-panel p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-light text-foreground">{liveResult.title}</h3>
                <button onClick={handleClose} className="text-muted-foreground/60 hover:text-foreground text-[10px]">✕</button>
              </div>
              <div className="space-y-4">
                {liveResult.sections.map((sec, i) => (
                  <div key={i} className="border border-border/30 rounded-lg p-4">
                    <h4 className="text-[12px] font-medium text-foreground mb-2">{sec.heading}</h4>
                    <p className="text-[11px] text-muted-foreground whitespace-pre-line leading-relaxed">{sec.body}</p>
                  </div>
                ))}
              </div>
              <LiveActivityRail activities={activities} />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
