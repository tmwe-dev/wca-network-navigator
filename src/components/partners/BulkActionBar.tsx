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
    <div className="px-3 py-1.5 border-b border-violet-500/15 bg-violet-500/[0.06] backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-violet-300">{count} sel.</span>

        <Button size="sm" variant="ghost" onClick={onAssignActivity}
          className="h-6 px-2 text-[11px] gap-1 text-violet-200 hover:bg-violet-500/15 hover:text-violet-100" disabled={deepSearching}>
          <ClipboardList className="w-3 h-3" /> Attività Diverse
        </Button>

        {onDeepSearch && !deepSearching && (
          <Button size="sm" variant="ghost" onClick={onDeepSearch}
            className="h-6 px-2 text-[11px] gap-1 text-violet-200 hover:bg-violet-500/15 hover:text-violet-100">
            <Sparkles className="w-3 h-3" /> Deep Search
          </Button>
        )}

        {deepSearching && (
          <>
            <span className="text-[11px] flex items-center gap-1 text-violet-300">
              <Loader2 className="w-3 h-3 animate-spin" />
              {deepSearchProgress ? `${deepSearchProgress.current}/${deepSearchProgress.total}` : "..."}
            </span>
            {onStopDeepSearch && (
              <Button size="sm" variant="ghost" onClick={onStopDeepSearch}
                className="h-6 px-2 text-[11px] gap-1 text-red-300 hover:bg-red-500/15">
                <Square className="w-2.5 h-2.5 fill-current" /> Stop
              </Button>
            )}
          </>
        )}

        {onSendToWorkspace && (
          <Button size="sm" variant="ghost" onClick={onSendToWorkspace}
            className="h-6 px-2 text-[11px] gap-1 text-violet-200 hover:bg-violet-500/15 hover:text-violet-100"
            disabled={deepSearching || sendingToWorkspace}>
            {sendingToWorkspace ? <Loader2 className="w-3 h-3 animate-spin" /> : <Briefcase className="w-3 h-3" />}
            Email Workspace
          </Button>
        )}

        {onEmail && (
          <Button size="sm" variant="ghost" onClick={onEmail}
            className="h-6 px-2 text-[11px] gap-1 text-violet-200 hover:bg-violet-500/15 hover:text-violet-100" disabled={deepSearching}>
            <Send className="w-3 h-3" /> Email
          </Button>
        )}

        <button onClick={onClear} className="ml-auto hover:bg-violet-500/20 rounded-full p-0.5 transition-colors text-violet-400" disabled={deepSearching}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
