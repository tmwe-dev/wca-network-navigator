import { AnimatePresence, motion } from "framer-motion";
import type { ToolResult } from "../tools/types";
import type { CanvasType } from "../hooks/useCommandPageState";
import {
  TableCanvas,
  CampaignCanvas,
  ReportCanvas,
  ResultCanvas,
} from "@/components/workspace/CanvasViews";
import CardGridCanvas from "../canvas/CardGridCanvas";
import TimelineCanvas from "../canvas/TimelineCanvas";
import FlowCanvas from "../canvas/FlowCanvas";
import ComposerCanvas from "../canvas/ComposerCanvas";
import LiveTableCanvas from "../canvas/LiveTableCanvas";

interface CommandOutputProps {
  canvas: CanvasType;
  liveResult: ToolResult | null;
  activeScenarioKey: string | null;
  tableData: Array<Record<string, string | number>>;
  onClose: () => void;
}

const ease = [0.2, 0.8, 0.2, 1] as const;

export function CommandOutput({
  canvas,
  liveResult,
  activeScenarioKey,
  tableData,
  onClose,
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
          {canvas === "table" && (
            <TableCanvas data={tableData as unknown as Parameters<typeof TableCanvas>[0]["data"]} onClose={onClose} />
          )}
          {canvas === "campaign" && (
            <CampaignCanvas onClose={onClose} />
          )}
          {canvas === "report" && (
            <ReportCanvas onClose={onClose} />
          )}
          {canvas === "result" && (
            <ResultCanvas onClose={onClose} scenarioKey={activeScenarioKey || undefined} />
          )}
          {canvas === "live-table" && liveResult && (
            liveResult.kind === "table" ? (
              <LiveTableCanvas
                title={liveResult.title}
                columns={[...liveResult.columns]}
                rows={[...liveResult.rows]}
                sourceLabel={liveResult.meta?.sourceLabel}
                count={liveResult.meta?.count}
                onClose={onClose}
              />
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
                onClose={onClose}
              />
            )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
