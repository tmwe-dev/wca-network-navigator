/**
 * PromptLabPage — Pagina centralizzata per ispezionare/migliorare prompt e KB.
 * Layout: ResizablePanelGroup verticale (tabs sopra, chat Lab Agent sotto).
 */
import { useCallback, useMemo, useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LabAgentChat } from "./prompt-lab/LabAgentChat";
import { UploadButton } from "./prompt-lab/UploadButton";
import { ExportButton } from "./prompt-lab/ExportButton";
import { useLabAgent } from "./prompt-lab/hooks/useLabAgent";
import { PROMPT_LAB_TABS, type PromptLabTabId, type Block } from "./prompt-lab/types";
import { SystemPromptTab } from "./prompt-lab/tabs/SystemPromptTab";
import { KBDoctrineTab } from "./prompt-lab/tabs/KBDoctrineTab";
import { OperativePromptsTab } from "./prompt-lab/tabs/OperativePromptsTab";
import { EmailPromptsTab } from "./prompt-lab/tabs/EmailPromptsTab";
import { VoiceElevenLabsTab } from "./prompt-lab/tabs/VoiceElevenLabsTab";
import { PlaybooksTab } from "./prompt-lab/tabs/PlaybooksTab";
import { AgentPersonasTab } from "./prompt-lab/tabs/AgentPersonasTab";
import { AIProfileTab } from "./prompt-lab/tabs/AIProfileTab";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";

export function PromptLabPage() {
  const [activeTabId, setActiveTabId] = useState<PromptLabTabId>("system_prompt");
  const lab = useLabAgent();

  const activeTab = useMemo(
    () => PROMPT_LAB_TABS.find((t) => t.id === activeTabId) ?? PROMPT_LAB_TABS[0],
    [activeTabId],
  );

  const handleChatSend = useCallback(
    async (text: string) => {
      // Il chat opera in modalità libera; la persistenza dei blocchi è interna a ciascun tab.
      await lab.sendChatMessage(text, { tabLabel: activeTab.label, blocks: [] });
    },
    [lab, activeTab.label],
  );

  const handleUpload = useCallback((blocks: Block[]) => {
    toast.info(`${blocks.length} blocchi importati. Funzione di assegnazione al tab attivo in arrivo.`);
  }, []);

  const handleExport = useCallback((): Record<string, ReadonlyArray<Block>> => {
    return { _info: [] as ReadonlyArray<Block> };
  }, []);

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full">
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel defaultSize={75} minSize={40}>
          <div className="flex h-full flex-col">
            <header className="border-b px-4 py-2 flex items-center justify-between bg-background">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                <div>
                  <h1 className="text-sm font-semibold leading-tight">Prompt Lab</h1>
                  <p className="text-[10px] text-muted-foreground">{activeTab.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <UploadButton onBlocksUploaded={handleUpload} />
                <ExportButton getSnapshot={handleExport} />
              </div>
            </header>

            <Tabs
              value={activeTabId}
              onValueChange={(v) => setActiveTabId(v as PromptLabTabId)}
              className="flex-1 flex flex-col min-h-0"
            >
              <TabsList className="rounded-none border-b justify-start h-auto p-0 bg-background overflow-x-auto">
                {PROMPT_LAB_TABS.map((t) => (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className="text-xs px-3 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 overflow-auto p-4">
                {activeTabId === "system_prompt" && <SystemPromptTab />}
                {activeTabId === "kb_doctrine" && <KBDoctrineTab />}
                {activeTabId === "operative" && <OperativePromptsTab />}
                {activeTabId === "email" && <EmailPromptsTab />}
                {activeTabId === "voice" && <VoiceElevenLabsTab />}
                {activeTabId === "playbooks" && <PlaybooksTab />}
                {activeTabId === "personas" && <AgentPersonasTab />}
                {activeTabId === "ai_profile" && <AIProfileTab />}
              </div>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={25} minSize={10} maxSize={50}>
          <LabAgentChat
            messages={lab.messages}
            loading={lab.loading}
            onSend={handleChatSend}
            onClear={lab.clearMessages}
            placeholder={`Migliora un blocco di "${activeTab.label}"...`}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}