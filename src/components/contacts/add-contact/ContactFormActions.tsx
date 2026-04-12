/**
 * ContactFormActions — Footer with save/close/new buttons + status badges
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2 } from "lucide-react";

interface ContactFormActionsProps {
  readonly companyName: string;
  readonly contactName: string;
  readonly logoUrl: string;
  readonly savedId: string | null;
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: () => void;
  readonly onReset: () => void;
}

export function ContactFormActions({
  companyName, contactName, logoUrl, savedId, saving,
  onClose, onSave, onReset,
}: ContactFormActionsProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {logoUrl && <img src={logoUrl} alt="" className="w-4 h-4 rounded" />}
        {companyName && <Badge variant="secondary" className="text-[10px]">{companyName}</Badge>}
        {contactName && <Badge variant="outline" className="text-[10px]">{contactName}</Badge>}
        {savedId && <Badge className="text-[10px] bg-emerald-600/20 text-emerald-400 border-emerald-600/30">Salvato ✓</Badge>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          {savedId ? "Chiudi" : "Annulla"}
        </Button>
        {!savedId ? (
          <Button size="sm" onClick={onSave} disabled={saving || !companyName.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Salva
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onReset} className="text-xs">
            + Nuovo
          </Button>
        )}
      </div>
    </div>
  );
}
