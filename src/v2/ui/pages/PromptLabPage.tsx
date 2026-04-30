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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Info,
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
            {/* Toolbar unificata: titolo + macroaree + azioni in una sola riga responsive */}
            <TooltipProvider delayDuration={200}>
              <header className="border-b bg-background flex-shrink-0">
                <div className="flex items-center gap-3 px-3 py-1.5 flex-wrap md:flex-nowrap">
                  {/* Brand + macroaree (Tabs) inline */}
                  <div className="flex items-center gap-2 min-w-0 shrink-0">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <h1 className="text-sm font-semibold leading-none whitespace-nowrap">Prompt Lab</h1>
                    <MetricsSummaryBadge />
                  </div>

                  <Tabs
                    value={activeGroupId}
                    onValueChange={handleGroupChange}
                    className="min-w-0"
                  >
                    <TabsList className="h-8 p-0.5 bg-muted/60 gap-0.5">
                      {PROMPT_LAB_GROUPS.map((g) => {
                        const Icon = GROUP_ICONS[g.id];
                        return (
                          <TabsTrigger
                            key={g.id}
                            value={g.id}
                            className="text-xs px-2.5 h-7 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">{g.label}</span>
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </Tabs>

                  {/* Spacer */}
                  <div className="flex-1 min-w-0" />

                  {/* Azioni primarie sempre visibili */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 gap-1.5"
                          onClick={() => setGlobalImproverOpen(true)}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Migliora tutto</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Migliora tutti i blocchi del tab attivo</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 gap-1.5 bg-primary/90 hover:bg-primary"
                          onClick={() => setHarmonizeOpen(true)}
                        >
                          <Layers className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Armonizza</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Refactor profondo: DB reale vs libreria desiderata</TooltipContent>
                    </Tooltip>

                    {/* Azioni secondarie raggruppate in dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 px-2 gap-1 relative">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                          <span className="hidden md:inline text-xs">Azioni</span>
                          {counts.pending > 0 && (
                            <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[9px] leading-none">
                              {counts.pending}
                            </Badge>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 z-50 bg-popover">
                        <DropdownMenuLabel className="text-xs">Gestione</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setCreateBlockOpen(true)}>
                          <Plus className="h-3.5 w-3.5 mr-2" /> Nuovo blocco
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/v2/prompt-lab/suggestions" className="flex items-center justify-between">
                            <span className="flex items-center"><BookmarkPlus className="h-3.5 w-3.5 mr-2" /> Review suggerimenti</span>
                            {counts.pending > 0 && (
                              <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[9px]">{counts.pending}</Badge>
                            )}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs">Esplora</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link to="/v2/prompt-lab/atlas">
                            <Network className="h-3.5 w-3.5 mr-2" /> Atlas (mappa)
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/v2/prompt-lab/catalog">
                            <Library className="h-3.5 w-3.5 mr-2" /> Catalog
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHistoryPanelOpen(true)}>
                          <Clock className="h-3.5 w-3.5 mr-2" /> Storico run
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1">
                          <ExportButton getSnapshot={handleExport} />
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </header>
            </TooltipProvider>

            {/* Contenuto: menu verticale a sinistra + pannello principale */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <VerticalTabNav
                tabs={verticalTabs}
                value={activeTabId}
                onChange={(v) => setActiveTabId(v as PromptLabTabId)}
              />
              <div className="flex-1 px-3 pt-2 pb-3 min-w-0 min-h-0 flex flex-col overflow-hidden">
                <TooltipProvider delayDuration={200}>
                  <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground flex-shrink-0">
                    <span className="font-semibold text-foreground">{activeTab.label}</span>
                    <span className="text-muted-foreground/60">·</span>
                    <span className="truncate">{activeTab.description}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/80 hover:text-foreground">
                          <Info className="h-3 w-3" /> Dove si attiva
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="end" className="max-w-sm">
                        {activeTab.activation}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
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