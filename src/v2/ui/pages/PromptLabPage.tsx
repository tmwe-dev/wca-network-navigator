/**
 * PromptLabPage — Pagina centralizzata per ispezionare/migliorare prompt e KB.
 * Layout: ResizablePanelGroup verticale (tabs sopra, chat Lab Agent sotto).
 */
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { PersistentResizablePanelGroup } from "@/v2/ui/atoms/PersistentResizablePanelGroup";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Library,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import { PageTitleHint } from "@/v2/ui/atoms/PageTitleHint";

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
      <PersistentResizablePanelGroup direction="vertical" storageId="prompt-lab:main-vs-chat">
        <ResizablePanel defaultSize={82} minSize={40}>
          <div className="flex h-full flex-col">
            {/* Livello 1 — Tabs orizzontali (macroaree) */}
            <Tabs
              value={activeGroupId}
              onValueChange={handleGroupChange}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="flex items-center justify-between border-b bg-background flex-shrink-0 pr-2">
                <TabsList className="rounded-none justify-start h-auto p-0 bg-transparent gap-0">
                  <div className="flex items-center gap-1.5 px-3 border-r border-border/40 mr-1">
                    <FlaskConical className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-semibold leading-none">Prompt Lab</span>
                    <MetricsSummaryBadge />
                  </div>
                  {PROMPT_LAB_GROUPS.map((g) => {
                    const Icon = GROUP_ICONS[g.id];
                    return (
                      <TabsTrigger
                        key={g.id}
                        value={g.id}
                        className="text-xs px-3 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none gap-1.5"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {g.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                <div className="flex items-center gap-1.5 flex-shrink-0">
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Altre azioni">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Azioni AI globali
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setGlobalImproverOpen(true)}>
                        <Sparkles className="h-3.5 w-3.5 mr-2" /> Migliora tutto
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setHarmonizeOpen(true)}>
                        <Layers className="h-3.5 w-3.5 mr-2" /> Armonizza tutto
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Gestione
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setCreateBlockOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-2" /> Nuovo blocco
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setHistoryPanelOpen(true)}>
                        <Clock className="h-3.5 w-3.5 mr-2" /> Storico run
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Esplora
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link to="/v2/prompt-lab/atlas">
                          <Network className="h-3.5 w-3.5 mr-2" /> Atlas
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/v2/prompt-lab/catalog">
                          <Library className="h-3.5 w-3.5 mr-2" /> Catalog
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1">
                        <ExportButton getSnapshot={handleExport} />
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Livello 2 — Menu verticale a sinistra + contenuto */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                <VerticalTabNav
                  tabs={verticalTabs}
                  value={activeTabId}
                  onChange={(v) => setActiveTabId(v as PromptLabTabId)}
                />
                <div className="flex-1 px-3 pt-2 pb-3 min-w-0 min-h-0 flex flex-col overflow-hidden">
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
      </PersistentResizablePanelGroup>
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