import { Button } from "@/components/ui/button";
import { X, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onAssignActivity: () => void;
  partnerIds: string[];
}

export function BulkActionBar({ count, onClear, onAssignActivity }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 shadow-lg">
        <span className="text-sm font-medium">{count} selezionati</span>
        <Button size="sm" variant="secondary" onClick={onAssignActivity} className="h-7 gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" />
          Assegna Attività
        </Button>
        <button onClick={onClear} className="ml-1 hover:bg-primary-foreground/20 rounded-full p-1 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
