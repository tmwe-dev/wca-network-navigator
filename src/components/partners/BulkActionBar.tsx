import { Button } from "@/components/ui/button";
import { X, ClipboardList, Sparkles, Send, Loader2, Square, Briefcase } from "lucide-react";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onAssignActivity: () => void;
  onDeepSearch?: () => void;
  onStopDeepSearch?: () => void;
  onEmail?: () => void;
  onSendToWorkspace?: () => void;
  sendingToWorkspace?: boolean;
  deepSearching?: boolean;
  deepSearchProgress?: { current: number; total: number } | null;
  partnerIds: string[];
}

export function BulkActionBar({
  count,
  onClear,
  onAssignActivity,
  onDeepSearch,
  onStopDeepSearch,
  onEmail,
  onSendToWorkspace,
  sendingToWorkspace,
  deepSearching,
  deepSearchProgress,
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="px-3 py-1.5 border-b border-primary/15 bg-primary/[0.06] backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-primary">{count} sel.</span>

        <Button size="sm" variant="ghost" onClick={onAssignActivity}
          className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:bg-primary/15 hover:text-foreground" disabled={deepSearching}>
          <ClipboardList className="w-3 h-3" /> Attività Diverse
        </Button>

        {onDeepSearch && !deepSearching && (
          <Button size="sm" variant="ghost" onClick={onDeepSearch}
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:bg-primary/15 hover:text-foreground">
            <Sparkles className="w-3 h-3" /> Deep Search
          </Button>
        )}

        {deepSearching && (
          <>
            <span className="text-[11px] flex items-center gap-1 text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              {deepSearchProgress ? `${deepSearchProgress.current}/${deepSearchProgress.total}` : "..."}
            </span>
            {onStopDeepSearch && (
              <Button size="sm" variant="ghost" onClick={onStopDeepSearch}
                className="h-6 px-2 text-[11px] gap-1 text-destructive hover:bg-destructive/15">
                <Square className="w-2.5 h-2.5 fill-current" /> Stop
              </Button>
            )}
          </>
        )}

        {onSendToWorkspace && (
          <Button size="sm" variant="ghost" onClick={onSendToWorkspace}
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:bg-primary/15 hover:text-foreground"
            disabled={deepSearching || sendingToWorkspace}>
            {sendingToWorkspace ? <Loader2 className="w-3 h-3 animate-spin" /> : <Briefcase className="w-3 h-3" />}
            Email Workspace
          </Button>
        )}

        {onEmail && (
          <Button size="sm" variant="ghost" onClick={onEmail}
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:bg-primary/15 hover:text-foreground" disabled={deepSearching}>
            <Send className="w-3 h-3" /> Email
          </Button>
        )}

        <button onClick={onClear} className="ml-auto hover:bg-primary/20 rounded-full p-0.5 transition-colors text-primary" disabled={deepSearching}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
