import { Users, FileText, BarChart3 } from "lucide-react";
import { AiResultsPanel, type StructuredPartner } from "@/components/operations/AiResultsPanel";
import { LiveOperationCards } from "@/components/ai/LiveOperationCards";
import type { AiOperation } from "@/components/ai/AiOperationCard";

interface OverlayEntityResultsProps {
  partners: StructuredPartner[];
  operations: Array<Record<string, unknown>>;
}

export function OverlayEntityResults({ partners, operations }: OverlayEntityResultsProps) {
  return (
    <div className="h-full flex flex-col border-l border-border/50 bg-card/30">
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Pannello Operativo</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {partners.length > 0 && `${partners.length} risultati`}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {operations.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Operazioni
            </h4>
            <LiveOperationCards operations={operations} />
          </div>
        )}
        {partners.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Users className="w-3 h-3" /> Partner trovati
            </h4>
            <AiResultsPanel partners={partners} />
          </div>
        )}
      </div>
    </div>
  );
}
