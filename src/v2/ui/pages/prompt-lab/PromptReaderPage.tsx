/**
 * PromptReaderPage — shell.
 * Refactor 2026-05-05: monolite (827 LOC) suddiviso in `promptReader/`.
 *  - constants.ts             → PANEL_ORDER_KEY, CATEGORY_*, readPanelOrder/readExpanded
 *  - utils.ts                 → copy/downloadText/slug/kbForAgent
 *  - markdown.ts              → buildAgentMarkdown / buildToolsMarkdown
 *  - Section.tsx              → wrapper sezione con copia
 *  - Sidebar.tsx              → sidebar agenti per categoria
 *  - Header.tsx               → toolbar in alto
 *  - ReaderContent.tsx        → contenuto pannello reader
 *  - usePromptReaderState.ts  → state, cache, KB load, download handlers
 */
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import PromptCopilotPanel from "./PromptCopilotPanel";
import { SwapPanels } from "./components/SwapPanels";
import { Header } from "./promptReader/Header";
import { Sidebar } from "./promptReader/Sidebar";
import { ReaderContent } from "./promptReader/ReaderContent";
import { usePromptReaderState } from "./promptReader/usePromptReaderState";
import type { PanelId } from "./promptReader/constants";

export default function PromptReaderPage() {
  const s = usePromptReaderState();

  return (
    <div className="flex h-full flex-col bg-background">
      <Header
        selectedId={s.selected?.id}
        loadingId={s.loadingId}
        downloading={s.downloading}
        onReload={() => s.selected && s.load(s.selected.id, true)}
        onDownloadAgent={s.downloadAgent}
        onDownloadAll={s.downloadAllAgents}
        onDownloadTools={s.downloadTools}
      />

      <div className="flex flex-1 min-h-0 relative">
        <Sidebar
          open={s.sidebarOpen}
          grouped={s.grouped}
          selectedId={s.selectedId}
          onSelect={s.setSelectedId}
        />

        <button
          onClick={() => s.setSidebarOpen((v) => !v)}
          className="absolute top-1/2 -translate-y-1/2 z-10 h-16 w-5 rounded-r-md bg-primary/90 text-primary-foreground hover:bg-primary flex items-center justify-center shadow-md transition-all"
          style={{ left: s.sidebarOpen ? "16rem" : "0" }}
          title={s.sidebarOpen ? "Nascondi elenco" : "Mostra elenco"}
          aria-label="Toggle sidebar"
        >
          {s.sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <SwapPanels
          order={s.panelOrder}
          onReorder={(next) => s.setPanelOrder(next as [PanelId, PanelId])}
          expandedId={s.expandedPanel}
          panels={[
            {
              id: "reader",
              title: "Prompt Reader",
              toolbar: (
                <Button
                  size="sm" variant="ghost" className="h-6 w-6 p-0"
                  onClick={() => s.setExpandedPanel(s.expandedPanel === "reader" ? null : "reader")}
                  title={s.expandedPanel === "reader" ? "Riduci" : "Espandi a tutta larghezza"}
                >
                  {s.expandedPanel === "reader" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              ),
              content: (
                <ReaderContent
                  selected={s.selected}
                  data={s.data}
                  loadingId={s.loadingId}
                  errorMsg={s.errorMsg}
                  kbAll={s.kbAll}
                  kbCurrent={s.kbCurrent}
                />
              ),
            },
            {
              id: "copilot",
              title: "Co-pilot",
              toolbar: (
                <Button
                  size="sm" variant="ghost" className="h-6 w-6 p-0"
                  onClick={() => s.setExpandedPanel(s.expandedPanel === "copilot" ? null : "copilot")}
                  title={s.expandedPanel === "copilot" ? "Riduci" : "Espandi a tutta larghezza"}
                >
                  {s.expandedPanel === "copilot" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              ),
              content: s.selected ? (
                <div ref={s.copilotWrapperRef} className="h-full">
                  <PromptCopilotPanel
                    agentSlug={s.selected.id}
                    agentKbCategories={s.selected.kbCategories}
                    blockName={s.targetBlock.name}
                    currentContent={s.targetBlock.content || s.data?.assembled?.system_prompt || ""}
                    expanded={s.expandedPanel === "copilot"}
                    compactWidth={s.copilotCompact}
                  />
                </div>
              ) : (
                <div className="p-4 text-xs text-muted-foreground">Seleziona un agente.</div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
