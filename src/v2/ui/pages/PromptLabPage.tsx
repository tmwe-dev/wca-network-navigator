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
import {
  PROMPT_LAB_TABS,
  PROMPT_LAB_GROUPS,
  type PromptLabTabId,
  type PromptLabGroupId,
  type Block,
} from "./prompt-lab/types";
import { SystemPromptTab } from "./prompt-lab/tabs/SystemPromptTab";
import { KBDoctrineTab } from "./prompt-lab/tabs/KBDoctrineTab";
import { OperativePromptsTab } from "./prompt-lab/tabs/OperativePromptsTab";
import { EmailPromptsTab } from "./prompt-lab/tabs/EmailPromptsTab";
import { VoiceElevenLabsTab } from "./prompt-lab/tabs/VoiceElevenLabsTab";
import { PlaybooksTab } from "./prompt-lab/tabs/PlaybooksTab";
import { AgentPersonasTab } from "./prompt-lab/tabs/AgentPersonasTab";
import { AIProfileTab } from "./prompt-lab/tabs/AIProfileTab";
import {
  FlaskConical,
  Brain,
  MessageSquare,
  Target,
  FileText,
  BookOpen,
  User,
  Mail,
  Mic,
  Wrench,
  Map,
  Users,
  type LucideIcon,
} from "lucide-react";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import { toast } from "sonner";

const GROUP_ICONS: Record<PromptLabGroupId, LucideIcon> = {
  core_ai: Brain,
  communication: MessageSquare,
  strategy: Target,
};

const TAB_ICONS: Record<PromptLabTabId, LucideIcon> = {
  system_prompt: FileText,
  kb_doctrine: BookOpen,
  ai_profile: User,
  email: Mail,
  voice: Mic,
  operative: Wrench,
  playbooks: Map,
  personas: Users,
};

export function PromptLabPage() {
  const [activeGroupId, setActiveGroupId] = useState<PromptLabGroupId>("core_ai");
  const [activeTabId, setActiveTabId] = useState<PromptLabTabId>("system_prompt");
  const lab = useLabAgent();

  const activeTab = useMemo(
    () => PROMPT_LAB_TABS.find((t) => t.id === activeTabId) ?? PROMPT_LAB_TABS[0],
    [activeTabId],
  );

  const activeGroup = useMemo(
    () => PROMPT_LAB_GROUPS.find((g) => g.id === activeGroupId) ?? PROMPT_LAB_GROUPS[0],
    [activeGroupId],
  );

  const verticalTabs: VerticalTab[] = useMemo(
    () =>
      activeGroup.tabs
        .map((tabId) => PROMPT_LAB_TABS.find((t) => t.id === tabId))
        .filter((t): t is (typeof PROMPT_LAB_TABS)[number] => Boolean(t))
        .map((t) => ({ value: t.id, label: t.label, icon: TAB_ICONS[t.id] })),
    [activeGroup],
  );

  const handleGroupChange = useCallback((groupId: string) => {
    const group = PROMPT_LAB_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    setActiveGroupId(group.id);
    // Auto-seleziona il primo tab della macroarea
    if (!group.tabs.includes(activeTabId as PromptLabTabId)) {
      setActiveTabId(group.tabs[0]);
    }
  }, [activeTabId]);

  const handleChatSend = useCallback(
    async (text: string) => {
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

            {/* Livello 1 — Tabs orizzontali (macroaree) */}
            <Tabs
              value={activeGroupId}
              onValueChange={handleGroupChange}
              className="flex-1 flex flex-col min-h-0"
            >
              <TabsList className="rounded-none border-b justify-start h-auto p-0 bg-background gap-0">
                {PROMPT_LAB_GROUPS.map((g) => {
                  const Icon = GROUP_ICONS[g.id];
                  return (
                    <TabsTrigger
                      key={g.id}
                      value={g.id}
                      className="text-xs px-4 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none gap-2"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {g.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* Livello 2 — Menu verticale a sinistra + contenuto */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                <VerticalTabNav
                  tabs={verticalTabs}
                  value={activeTabId}
                  onChange={(v) => setActiveTabId(v as PromptLabTabId)}
                />
                <div className="flex-1 p-4 min-w-0 min-h-0 flex flex-col overflow-hidden">
                  <div className="mb-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex-shrink-0">
                    <span className="font-medium text-foreground">Dove si attiva:</span> {activeTab.activation}
                  </div>
                  {activeTabId === "system_prompt" && <SystemPromptTab />}
                  {activeTabId === "kb_doctrine" && <KBDoctrineTab />}
                  {activeTabId === "operative" && <OperativePromptsTab />}
                  {activeTabId === "email" && <EmailPromptsTab />}
                  {activeTabId === "voice" && <VoiceElevenLabsTab />}
                  {activeTabId === "playbooks" && <PlaybooksTab />}
                  {activeTabId === "personas" && <AgentPersonasTab />}
                  {activeTabId === "ai_profile" && <AIProfileTab />}
                </div>
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