import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, Square, Trash2, X, Loader2 } from "lucide-react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";

interface ForgeRecipient {
  partnerId?: string | null;
  contactId?: string | null;
  companyName?: string | null;
  countryName?: string | null;
  countryCode?: string | null;
  contactName?: string | null;
}

interface DeepSearchHeaderProps {
  recipient: ForgeRecipient | null;
  running: boolean;
  pagesCount: number;
  onStop: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

export function DeepSearchHeader({
  recipient,
  running,
  pagesCount,
  onStop,
  onClearAll,
  onClose,
}: DeepSearchHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 shrink-0">
      <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
        <Flame className="w-4 h-4 text-orange-500" />
        FireScrape Canvas
        {recipient && (
          <Badge variant="outline" className="ml-2 text-[10px] font-normal">
            {recipient.companyName ?? recipient.contactName}
          </Badge>
        )}
      </DialogTitle>
      <div className="flex items-center gap-1.5">
        {running && (
          <Button
            size="sm"
            variant="destructive"
            onClick={onStop}
            className="h-7 text-[11px] gap-1"
          >
            <Square className="w-3 h-3 fill-current" /> Stop
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearAll}
          disabled={pagesCount === 0 || !!running}
          className="h-7 text-[11px]"
        >
          <Trash2 className="w-3 h-3 mr-1" /> Pulisci
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
