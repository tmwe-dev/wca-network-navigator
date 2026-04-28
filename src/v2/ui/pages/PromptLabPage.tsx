/**
 * PromptLabPage — Pagina centralizzata per ispezionare/migliorare prompt e KB.
 * Layout: ResizablePanelGroup verticale (tabs sopra, chat Lab Agent sotto).
 */
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LabAgentChat } from "./prompt-lab/LabAgentChat";
import { ExportButton } from "./prompt-lab/ExportButton";
import { GlobalImproverDialog } from "./prompt-lab/GlobalImproverDialog";
import { HarmonizeSystemDialog } from "./prompt-lab/HarmonizeSystemDialog";
import { CreateBlockDialog } from "./prompt-lab/CreateBlockDialog";
import { RunHistoryPanel } from "./prompt-lab/RunHistoryPanel";
import { MetricsSummaryBadge } from "./prompt-lab/MetricsSummaryBadge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLabAgent } from "./prompt-lab/hooks/useLabAgent";
import { useSuggestedImprovements } from "./prompt-lab/hooks/useSuggestedImprovements";
import { useAuth } from "@/providers/AuthProvider";
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
import { AgentCapabilitiesTab } from "./prompt-lab/tabs/AgentCapabilitiesTab";
import { SimulatorTab } from "./prompt-lab/tabs/SimulatorTab";
import { AuditTab } from "./prompt-lab/tabs/AuditTab";
import { AgentRoutingTab } from "./prompt-lab/tabs/AgentRoutingTab";
import { AIProfileTab } from "./prompt-lab/tabs/AIProfileTab";
import { JournalistsTab } from "./prompt-lab/tabs/JournalistsTab";
import { PromptTestsTab } from "./prompt-lab/tabs/PromptTestsTab";
import { PromptHistoryTab } from "./prompt-lab/tabs/PromptHistoryTab";
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
  Sparkles,
  Newspaper,
  Network,
  Plus,
  BookmarkPlus,
  Clock,
  Layers,
  ShieldCheck,
  ScanSearch,
  Route,
  TestTube2,
  History,
  type LucideIcon,
} from "lucide-react";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";

const GROUP_ICONS: Record<PromptLabGroupId, LucideIcon> = {
  core_ai: Brain,
  communication: MessageSquare,
  strategy: Target,
  operations: Wrench,
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
  capabilities: ShieldCheck,
  simulator: FlaskConical,
  audit: ScanSearch,
  routing: Route,
  journalists: Newspaper,
  tests: TestTube2,
  history: History,
  operative_kb: BookOpen,
  administrative_kb: BookOpen,
  support_kb: BookOpen,
  domain_routing: Sparkles,
};

export function PromptLabPage() {
  const { user } = useAuth();
  const [activeGroupId, setActiveGroupId] = useState<PromptLabGroupId>("core_ai");
  const [activeTabId, setActiveTabId] = useState<PromptLabTabId>("system_prompt");
  const [globalImproverOpen, setGlobalImproverOpen] = useState(false);
  const [harmonizeOpen, setHarmonizeOpen] = useState(false);
  const [createBlockOpen, setCreateBlockOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const lab = useLabAgent();
  const { counts } = useSuggestedImprovements(user?.id ?? "", true);

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
      await lab.sendChatMessage(text, {
        tabLabel: activeTab.label,
        tabActivation: activeTab.activation,
        blocks: [],
      });
    },
    [lab, activeTab.label, activeTab.activation],
  );

  const handleExport = useCallback((): Record<string, ReadonlyArray<Block>> => {
    return { _info: [] as ReadonlyArray<Block> };
  }, []);

  return (
    <div className="h-full w-full">
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel defaultSize={82} minSize={40}>
          <div className="flex h-full flex-col">
            <header className="border-b px-3 py-1.5 flex items-center justify-between bg-background flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FlaskConical className="h-4 w-4 text-primary flex-shrink-0" />
                <h1 className="text-sm font-semibold leading-none">Prompt Lab</h1>
                <MetricsSummaryBadge />
                <span className="text-[11px] text-muted-foreground truncate hidden md:inline">— {activeTab.description}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5"
                  onClick={() => setCreateBlockOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuovo
                </Button>
                <Button asChild size="sm" variant="outline" className="h-7 gap-1.5 relative">
                  <Link to="/v2/prompt-lab/suggestions" title="Suggerimenti da approvare">
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    Review
                    {counts.pending > 0 && (
                      <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[9px] leading-none">
                        {counts.pending}
                      </Badge>
                    )}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-7 gap-1.5">
                  <Link to="/v2/prompt-lab/atlas" title="Mappa visuale agenti × prompt × KB">
                    <Network className="h-3.5 w-3.5" />
                    Atlas
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5"
                  onClick={() => setHistoryPanelOpen(true)}
                  title="Storico dei run Migliora tutto"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Storico
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 gap-1.5 px-4 font-semibold"
                  onClick={() => setGlobalImproverOpen(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  Migliora tutto
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 gap-1.5 px-4 font-semibold bg-primary/90 hover:bg-primary"
                  onClick={() => setHarmonizeOpen(true)}
                  title="Refactor profondo del sistema: confronta DB reale vs libreria desiderata"
                >
                  <Layers className="h-4 w-4" />
                  Armonizza tutto
                </Button>
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
                <div className="flex-1 px-3 pt-2 pb-3 min-w-0 min-h-0 flex flex-col overflow-hidden">
                  <div className="mb-2 rounded border bg-muted/30 px-2.5 py-1 text-[11px] leading-tight text-muted-foreground flex-shrink-0">
                    <span className="font-medium text-foreground">Dove si attiva:</span> {activeTab.activation}
                  </div>
                  {activeTabId === "system_prompt" && <SystemPromptTab />}
                  {activeTabId === "kb_doctrine" && <KBDoctrineTab />}
                  {activeTabId === "operative" && <OperativePromptsTab />}
                  {activeTabId === "email" && <EmailPromptsTab />}
                  {activeTabId === "voice" && <VoiceElevenLabsTab />}
                  {activeTabId === "playbooks" && <PlaybooksTab />}
                  {activeTabId === "personas" && <AgentPersonasTab />}
                  {activeTabId === "capabilities" && <AgentCapabilitiesTab />}
                  {activeTabId === "simulator" && <SimulatorTab />}
                  {activeTabId === "audit" && <AuditTab />}
                  {activeTabId === "routing" && <AgentRoutingTab />}
                  {activeTabId === "ai_profile" && <AIProfileTab />}
                  {activeTabId === "journalists" && <JournalistsTab />}
                  {activeTabId === "tests" && <PromptTestsTab />}
                  {activeTabId === "history" && <PromptHistoryTab />}
                </div>
              </div>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={18} minSize={8} maxSize={50}>
          <LabAgentChat
            messages={lab.messages}
            loading={lab.loading}
            onSend={handleChatSend}
            onClear={lab.clearMessages}
            placeholder={`Migliora un blocco di "${activeTab.label}"...`}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <GlobalImproverDialog open={globalImproverOpen} onOpenChange={setGlobalImproverOpen} defaultGrouping="tab" />
      <HarmonizeSystemDialog open={harmonizeOpen} onOpenChange={setHarmonizeOpen} />
      <CreateBlockDialog open={createBlockOpen} onOpenChange={setCreateBlockOpen} />

      {/* Drawer per il storico dei run */}
      <Sheet open={historyPanelOpen} onOpenChange={setHistoryPanelOpen}>
        <SheetContent side="right" className="w-[500px] max-w-[90vw] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Storico "Migliora tutto"
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 mt-4">
            <RunHistoryPanel />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}