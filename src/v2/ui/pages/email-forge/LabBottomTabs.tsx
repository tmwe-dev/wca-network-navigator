/**
 * LabBottomTabs — collapsible bottom panel hosting the 5 inspector tabs.
 */
import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Search, BookOpen, User, Scroll, History } from "lucide-react";
import type { ForgeRecipient } from "./ForgeRecipientPicker";
import { DeepSearchTab } from "./tabs/DeepSearchTab";
import { KnowledgeBaseTab } from "./tabs/KnowledgeBaseTab";
import { SenderProfileTab } from "./tabs/SenderProfileTab";
import { DoctrineTab } from "./tabs/DoctrineTab";
import { HistoryTab } from "./tabs/HistoryTab";

interface Props {
  recipient: ForgeRecipient | null;
  emailKbCategories: string[] | null;
  onRefreshGeneration?: () => void;
}

export function LabBottomTabs({ recipient, emailKbCategories, onRefreshGeneration }: Props) {
  const [open, setOpen] = React.useState(true);
  const [tab, setTab] = React.useState<"deep" | "kb" | "sender" | "doctrine" | "history">("deep");

  return (
    <div className="border-t border-border bg-card/40 shrink-0">
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Cosa legge l'AI
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} className="h-6 px-2 text-[10px]">
          {open ? <><ChevronDown className="w-3 h-3 mr-1" /> Comprimi</> : <><ChevronUp className="w-3 h-3 mr-1" /> Espandi</>}
        </Button>
      </div>

      {open && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="px-2 pb-2">
          <TabsList className="h-7">
            <TabsTrigger value="deep" className="text-[10px] h-6 px-2"><Search className="w-3 h-3 mr-1" />Deep Search</TabsTrigger>
            <TabsTrigger value="kb" className="text-[10px] h-6 px-2"><BookOpen className="w-3 h-3 mr-1" />KB email</TabsTrigger>
            <TabsTrigger value="sender" className="text-[10px] h-6 px-2"><User className="w-3 h-3 mr-1" />Mittente</TabsTrigger>
            <TabsTrigger value="doctrine" className="text-[10px] h-6 px-2"><Scroll className="w-3 h-3 mr-1" />Dottrina</TabsTrigger>
            <TabsTrigger value="history" className="text-[10px] h-6 px-2"><History className="w-3 h-3 mr-1" />Storico</TabsTrigger>
          </TabsList>

          <TabsContent value="deep" className="mt-2 max-h-[280px] overflow-auto">
            <DeepSearchTab recipient={recipient} onRefreshGeneration={onRefreshGeneration} />
          </TabsContent>
          <TabsContent value="kb" className="mt-2 max-h-[280px] overflow-auto">
            <KnowledgeBaseTab categories={emailKbCategories} />
          </TabsContent>
          <TabsContent value="sender" className="mt-2 max-h-[280px] overflow-auto">
            <SenderProfileTab />
          </TabsContent>
          <TabsContent value="doctrine" className="mt-2 max-h-[280px] overflow-auto">
            <DoctrineTab />
          </TabsContent>
          <TabsContent value="history" className="mt-2 max-h-[280px] overflow-auto">
            <HistoryTab recipient={recipient} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
