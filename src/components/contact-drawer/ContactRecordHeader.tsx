import { ChevronLeft, ChevronRight, X, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RecordSourceType } from "@/contexts/ContactDrawerContext";

const SOURCE_LABELS: Record<RecordSourceType, { label: string; color: string }> = {
  partner: { label: "WCA Partner", color: "bg-chart-1/15 text-chart-1 border-chart-1/30" },
  contact: { label: "Contatto", color: "bg-chart-3/15 text-chart-3 border-chart-3/30" },
  prospect: { label: "Prospect RA", color: "bg-chart-4/15 text-chart-4 border-chart-4/30" },
  bca: { label: "Biglietto", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  business_card: { label: "Biglietto da visita", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  voice_session: { label: "Sessione Voice", color: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  campaign: { label: "Campagna", color: "bg-pink-500/15 text-pink-500 border-pink-500/30" },
  task: { label: "Task", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
};

interface Props {
  sourceType: RecordSourceType;
  companyName: string;
  contactName: string;
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function ContactRecordHeader({ sourceType, companyName, contactName, currentIndex, totalCount, onPrev, onNext, onClose }: Props) {
  const src = SOURCE_LABELS[sourceType];
  const hasList = totalCount > 1;

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground truncate max-w-[200px]">{companyName || "—"}</h3>
            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 border", src.color)}>
              {src.label}
            </Badge>
          </div>
          {contactName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span className="truncate max-w-[180px]">{contactName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {hasList && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrev} disabled={currentIndex <= 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-[10px] text-muted-foreground tabular-nums min-w-[40px] text-center">
              {currentIndex + 1}/{totalCount}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNext} disabled={currentIndex >= totalCount - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}