/**
 * ToolsTab — Strumenti operativi di Outreach: Sequenze (cadenze multi-step),
 * Coda AI (proposte agenti), A/B Test (esperimenti).
 * Vivono qui per non affollare la navigation principale; restano pienamente accessibili.
 */
import { Suspense, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Bot, FlaskConical, Wrench } from "lucide-react";
import { lazyRetry } from "@/lib/lazyRetry";

const SchedulingTab = lazyRetry(() => import("./SchedulingTab").then(m => ({ default: m.SchedulingTab })));
const CodaAITab = lazyRetry(() => import("./CodaAITab").then(m => ({ default: m.CodaAITab })));
const ABTestResultsTab = lazyRetry(() => import("./ABTestResults").then(m => ({ default: m.ABTestResults })));

interface ToolsTabProps {
  readonly onNavigate?: (tab: string) => void;
}

export function ToolsTab({ onNavigate }: ToolsTabProps = {}) {
  const [section, setSection] = useState<"sequenze" | "coda-ai" | "ab-test">("sequenze");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 py-2 border-b border-border/30">
        <Tabs value={section} onValueChange={(v) => setSection(v as typeof section)}>
          <TabsList className="bg-muted/40 h-8">
            <TabsTrigger value="sequenze" className="gap-1.5 text-xs h-7">
              <Clock className="w-3 h-3" /> Sequenze
            </TabsTrigger>
            <TabsTrigger value="coda-ai" className="gap-1.5 text-xs h-7">
              <Bot className="w-3 h-3" /> Coda AI
            </TabsTrigger>
            <TabsTrigger value="ab-test" className="gap-1.5 text-xs h-7">
              <FlaskConical className="w-3 h-3" /> A/B Test
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={<div className="h-full animate-pulse bg-muted/20 rounded-lg" />}>
          {section === "sequenze" && <SchedulingTab onNavigate={onNavigate} />}
          {section === "coda-ai" && <CodaAITab onNavigate={onNavigate} />}
          {section === "ab-test" && <ABTestResultsTab />}
        </Suspense>
      </div>
    </div>
  );
}
