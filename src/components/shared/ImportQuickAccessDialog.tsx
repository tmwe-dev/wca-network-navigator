import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CSVImport } from "@/components/partners/CSVImport";

interface Props {
  /** What type of data is being imported — shown in the dialog title */
  label?: string;
  /** Button variant */
  variant?: "ghost" | "outline" | "default";
  /** Extra className for the trigger button */
  className?: string;
  /** Compact mode — icon only */
  compact?: boolean;
}

/**
 * Quick-access import dialog — can be placed in any toolbar.
 * Wraps the existing CSVImport component in a dialog.
 */
export function ImportQuickAccessDialog({
  label = "Importa Dati",
  variant = "ghost",
  className = "",
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={variant}
            className={`gap-1.5 ${className}`}
            onClick={() => setOpen(true)}
          >
            <Upload className="w-3.5 h-3.5" />
            {!compact && <span className="text-xs">Importa</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">{label}</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              {label}
            </DialogTitle>
          </DialogHeader>
          <CSVImport />
        </DialogContent>
      </Dialog>
    </>
  );
}
