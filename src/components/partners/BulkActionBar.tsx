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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 shadow-lg">
        <span className="text-sm font-medium">{count} selezionati</span>
        <Button size="sm" variant="secondary" onClick={onAssignActivity} className="h-7 gap-1.5" disabled={deepSearching}>
          <ClipboardList className="w-3.5 h-3.5" />
          Assegna Attività
        </Button>
        {onDeepSearch && !deepSearching && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onDeepSearch}
            className="h-7 gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Deep Search
          </Button>
        )}
        {deepSearching && (
          <>
            <span className="text-sm flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {deepSearchProgress
                ? `Deep Search ${deepSearchProgress.current}/${deepSearchProgress.total}...`
                : "Deep Search..."}
            </span>
            {onStopDeepSearch && (
              <Button
                size="sm"
                variant="destructive"
                onClick={onStopDeepSearch}
                className="h-7 gap-1.5"
              >
                <Square className="w-3 h-3 fill-current" />
                Stop
              </Button>
            )}
          </>
        )}
        {onSendToWorkspace && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onSendToWorkspace}
            className="h-7 gap-1.5"
            disabled={deepSearching || sendingToWorkspace}
          >
            {sendingToWorkspace ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
            Workspace
          </Button>
        )}
        {onEmail && (
          <Button size="sm" variant="secondary" onClick={onEmail} className="h-7 gap-1.5" disabled={deepSearching}>
            <Send className="w-3.5 h-3.5" />
            Email
          </Button>
        )}
        <button onClick={onClear} className="ml-1 hover:bg-primary-foreground/20 rounded-full p-1 transition-colors" disabled={deepSearching}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
