import { Button } from "@/components/ui/button";
import { Mail, Phone, ListPlus, ClipboardList, X } from "lucide-react";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onAssignActivity: () => void;
}

export function BulkActionBar({ count, onClear, onAssignActivity }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
      <span className="text-sm font-semibold whitespace-nowrap">
        {count} agente{count !== 1 ? "i" : ""} selezionat{count !== 1 ? "i" : "o"}
      </span>
      <div className="h-5 w-px bg-primary-foreground/30" />
      <Button
        variant="secondary"
        size="sm"
        className="h-8 text-xs"
        onClick={onAssignActivity}
      >
        <ClipboardList className="w-3.5 h-3.5 mr-1" />
        Assegna Attività
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10" onClick={onClear}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
