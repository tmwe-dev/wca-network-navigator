/**
 * ForgeOutputPanel — pannello destro di Email Forge.
 * 3 tab di primo livello: Risultato (default) · Prompt · AI (Cosa legge l'AI).
 * Sostituisce il vecchio split a 3 pannelli + LabBottomTabs.
 */
import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Mail, Wand2, Brain, Search, BookOpen, User, Scroll, History } from "lucide-react";
import type { ForgeResult, PromptBlock } from "@/v2/hooks/useEmailForge";
import type { ForgeRecipient } from "./ForgeRecipientPicker";
import { ResultPanel } from "./ResultPanel";
import { PromptInspector } from "./PromptInspector";
import { SherlockCanvas } from "./SherlockCanvas";
import { KnowledgeBaseTab } from "./tabs/KnowledgeBaseTab";
import { SenderProfileTab } from "./tabs/SenderProfileTab";
import { DoctrineTab } from "./tabs/DoctrineTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { PromptsTab } from "./tabs/PromptsTab";

interface Props {
  result: ForgeResult | null;
  isLoading: boolean;
  error: string | null;
  elapsedMs: number | null;
  hasRecipient: boolean;
  recipient: ForgeRecipient | null;
  emailKbCategories: string[] | null;
  systemPrompt?: string;
  userPrompt?: string;
  systemBlocks?: PromptBlock[];
  blocks?: PromptBlock[];
  onRerunPrompt: (systemPrompt: string, userPrompt: string) => void;
}

export function ForgeOutputPanel({
  result, isLoading, error, elapsedMs, hasRecipient,
  recipient, emailKbCategories,
  systemPrompt, userPrompt, systemBlocks, blocks, onRerunPrompt,
}: Props): React.ReactElement {
  const [tab, setTab] = React.useState<"result" | "prompt" | "ai">("result");
  const [aiTab, setAiTab] = React.useState<"kb" | "sender" | "doctrine" | "prompts" | "history">("kb");
  const [sherlockOpen, setSherlockOpen] = React.useState(false);

  return (
    <div className="flex flex-col h-full">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex flex-col h-full">
        <div className="px-3 pt-2 border-b border-border/60 shrink-0">
          <TabsList className="h-8">
            <TabsTrigger value="result" className="text-xs h-7 px-3 gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Risultato
            </TabsTrigger>
            <TabsTrigger value="prompt" className="text-xs h-7 px-3 gap-1.5">
              <Wand2 className="w-3.5 h-3.5" /> Prompt
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs h-7 px-3 gap-1.5">
              <Brain className="w-3.5 h-3.5" /> Cosa legge l'AI
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="result" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <ResultPanel
            result={result}
            isLoading={isLoading}
            error={error}
            elapsedMs={elapsedMs}
            hasRecipient={hasRecipient}
          />
        </TabsContent>

        <TabsContent value="prompt" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <PromptInspector
            systemPrompt={systemPrompt}
            userPrompt={userPrompt}
            systemBlocks={systemBlocks}
            blocks={blocks}
            isLoading={isLoading}
            onRerun={onRerunPrompt}
          />
        </TabsContent>

        <TabsContent value="ai" className="flex-1 overflow-auto mt-0 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-foreground/80 uppercase tracking-wide">
              Contesto disponibile
            </div>
            <Button size="sm" onClick={() => setSherlockOpen(true)} className="h-7 px-2.5 text-xs gap-1.5">
              <Search className="w-3.5 h-3.5" /> Apri Sherlock
            </Button>
          </div>

          <Tabs value={aiTab} onValueChange={(v) => setAiTab(v as typeof aiTab)}>
            <TabsList className="h-7">
              <TabsTrigger value="kb" className="text-xs h-6 px-2"><BookOpen className="w-3 h-3 mr-1" />KB email</TabsTrigger>
              <TabsTrigger value="sender" className="text-xs h-6 px-2"><User className="w-3 h-3 mr-1" />Mittente</TabsTrigger>
              <TabsTrigger value="doctrine" className="text-xs h-6 px-2"><Scroll className="w-3 h-3 mr-1" />Dottrina</TabsTrigger>
              <TabsTrigger value="prompts" className="text-xs h-6 px-2"><Wand2 className="w-3 h-3 mr-1" />Prompt</TabsTrigger>
              <TabsTrigger value="history" className="text-xs h-6 px-2"><History className="w-3 h-3 mr-1" />Storico</TabsTrigger>
            </TabsList>

            <TabsContent value="kb" className="mt-2"><KnowledgeBaseTab categories={emailKbCategories} /></TabsContent>
            <TabsContent value="sender" className="mt-2"><SenderProfileTab /></TabsContent>
            <TabsContent value="doctrine" className="mt-2"><DoctrineTab /></TabsContent>
            <TabsContent value="prompts" className="mt-2"><PromptsTab /></TabsContent>
            <TabsContent value="history" className="mt-2"><HistoryTab recipient={recipient} /></TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <SherlockCanvas open={sherlockOpen} onOpenChange={setSherlockOpen} recipient={recipient} />
    </div>
  );
}