/**
 * EmailRecipientFields — Recipients bar + manual input + unknown email dialog
 */
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, X } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import type { SelectedRecipient } from "@/contexts/MissionContext";

interface EmailRecipientFieldsProps {
  readonly recipients: SelectedRecipient[];
  readonly manualEmail: string;
  readonly unknownEmailDialog: boolean;
  readonly pendingEmail: string;
  readonly manualContactName: string;
  readonly manualCompanyName: string;
  readonly onRemoveRecipient: (idx: number) => void;
  readonly onManualEmailChange: (v: string) => void;
  readonly onAddManualEmail: () => void;
  readonly onSetUnknownDialog: (open: boolean) => void;
  readonly onManualContactNameChange: (v: string) => void;
  readonly onManualCompanyNameChange: (v: string) => void;
  readonly onConfirmUnknownEmail: () => void;
}

export function EmailRecipientFields({
  recipients, manualEmail, unknownEmailDialog, pendingEmail,
  manualContactName, manualCompanyName, onRemoveRecipient,
  onManualEmailChange, onAddManualEmail, onSetUnknownDialog,
  onManualContactNameChange, onManualCompanyNameChange, onConfirmUnknownEmail,
}: EmailRecipientFieldsProps): React.ReactElement {
  return (
    <>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        {recipients.map((r, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pl-1.5 pr-1 py-0.5 text-[11px] font-normal">
            <span className="text-sm leading-none">{getCountryFlag(r.countryCode || "")}</span>
            <span className="truncate max-w-[180px]">
              {r.contactAlias || r.contactName
                ? `${r.contactAlias || r.contactName} · ${r.companyAlias || r.companyName}`
                : r.companyAlias || r.companyName}
            </span>
            <button onClick={() => onRemoveRecipient(i)} className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/10">
              <X className="w-2.5 h-2.5 text-muted-foreground hover:text-destructive" />
            </button>
          </Badge>
        ))}
        <input
          type="email"
          value={manualEmail}
          onChange={(e) => onManualEmailChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); onAddManualEmail(); } }}
          onBlur={() => { if (manualEmail.trim()) onAddManualEmail(); }}
          placeholder={recipients.length === 0 ? "Digita email o usa il picker a sinistra..." : "Aggiungi email..."}
          className="flex-1 min-w-[160px] text-xs bg-transparent outline-none placeholder:text-muted-foreground/50 h-6"
        />
      </div>

      {/* Unknown email mini-dialog */}
      <Dialog open={unknownEmailDialog} onOpenChange={onSetUnknownDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Destinatario non trovato</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            L'indirizzo <strong>{pendingEmail}</strong> non è presente nel database. Inserisci le informazioni per procedere.
          </p>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">Nome contatto *</Label>
              <Input value={manualContactName} onChange={e => onManualContactNameChange(e.target.value)} placeholder="Mario Rossi" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Nome azienda *</Label>
              <Input value={manualCompanyName} onChange={e => onManualCompanyNameChange(e.target.value)} placeholder="Acme Srl" className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onSetUnknownDialog(false)}>Annulla</Button>
            <Button size="sm" className="h-8 text-xs" onClick={onConfirmUnknownEmail}>Aggiungi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
