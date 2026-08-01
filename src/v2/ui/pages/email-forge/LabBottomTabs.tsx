/**
 * LabBottomTabs — barra compatta con tab inspector + bottone che apre il
 * Canvas FireScrape full-screen per il deep search operativo.
 */
import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ChevronDown, ChevronUp, BookOpen, User, Scroll, History, Wand2, Search,
} from "lucide-react";
import type { ForgeRecipient } from "./ForgeRecipientPicker";
import { KnowledgeBaseTab } from "./tabs/KnowledgeBaseTab";
import { SenderProfileTab } from "./tabs/SenderProfileTab";
import { DoctrineTab } from "./tabs/DoctrineTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { PromptsTab } from "./tabs/PromptsTab";
import { SherlockCanvas } from "./SherlockCanvas";

interface Props {
  recipient: ForgeRecipient | null;
  emailKbCategories: string[] | null;
  onRefreshGeneration?: () => void;
}

export function LabBottomTabs({ recipient, emailKbCategories }: Props) {
  const [open, setOpen] = React.useState(true);
  const [tab, setTab] = React.useState<"kb" | "sender" | "doctrine" | "prompts" | "history">("kb");
  const [canvasOpen, setCanvasOpen] = React.useState(false);

  return (
    <>
      <div className="border-t border-border bg-card/40 shrink-0">
        <div className="flex items-center justify-between px-3 py-1.5 gap-2">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Cosa legge l'AI
          </div>

          <div className="flex items-center gap-1.5">
            {/* CTA principale: apre Sherlock */}
            <Button
              size="sm"
              onClick={() => setCanvasOpen(true)}
              className="h-7 px-2.5 text-[11px] gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              Apri Sherlock
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} className="h-6 px-2 text-[10px]">
              {open
                ? <><ChevronDown className="w-3 h-3 mr-1" /> Comprimi</>
                : <><ChevronUp className="w-3 h-3 mr-1" /> Espandi</>}
            </Button>
          </div>
        </div>

        {open && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="px-2 pb-2">
            <TabsList className="h-7">
              <TabsTrigger value="kb" className="text-[10px] h-6 px-2"><BookOpen className="w-3 h-3 mr-1" />KB email</TabsTrigger>
              <TabsTrigger value="sender" className="text-[10px] h-6 px-2"><User className="w-3 h-3 mr-1" />Mittente</TabsTrigger>
              <TabsTrigger value="doctrine" className="text-[10px] h-6 px-2"><Scroll className="w-3 h-3 mr-1" />Dottrina</TabsTrigger>
              <TabsTrigger value="prompts" className="text-[10px] h-6 px-2"><Wand2 className="w-3 h-3 mr-1" />Prompt</TabsTrigger>
              <TabsTrigger value="history" className="text-[10px] h-6 px-2"><History className="w-3 h-3 mr-1" />Storico</TabsTrigger>
            </TabsList>

            <TabsContent value="kb" className="mt-2 max-h-[220px] overflow-auto">
              <KnowledgeBaseTab categories={emailKbCategories} />
            </TabsContent>
            <TabsContent value="sender" className="mt-2 max-h-[220px] overflow-auto">
              <SenderProfileTab />
            </TabsContent>
            <TabsContent value="doctrine" className="mt-2 max-h-[220px] overflow-auto">
              <DoctrineTab />
            </TabsContent>
            <TabsContent value="prompts" className="mt-2 max-h-[220px] overflow-auto">
              <PromptsTab />
            </TabsContent>
            <TabsContent value="history" className="mt-2 max-h-[220px] overflow-auto">
              <HistoryTab recipient={recipient} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <SherlockCanvas
        open={canvasOpen}
        onOpenChange={setCanvasOpen}
        recipient={recipient}
      />
    </>
  );
}
