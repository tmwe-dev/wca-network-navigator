/**
 * EmailBottomBar — Send, save draft, queue actions
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Send, Save, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmailBottomBarProps {
  readonly recipientCount: number;
  readonly onSend: () => void;
  readonly onSaveDraft: () => void;
  readonly isSending: boolean;
  readonly isSaving: boolean;
  readonly canSend: boolean;
}

export function EmailBottomBar({
  recipientCount, onSend, onSaveDraft,
  isSending, isSaving, canSend,
}: EmailBottomBarProps): React.ReactElement {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t bg-card">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" /> Indietro
      </Button>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSaveDraft}
          disabled={isSaving}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? "Salvando..." : "Bozza"}
        </Button>

        <Button
          size="sm"
          onClick={onSend}
          disabled={!canSend || isSending}
          className="gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          {isSending
            ? "Invio..."
            : recipientCount > 1
              ? `Invia a ${recipientCount}`
              : "Invia"}
        </Button>
      </div>
    </div>
  );
}
