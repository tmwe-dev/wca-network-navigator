/**
 * EmailTemplateSelector — Save-as-template dialog
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmailTemplateSelectorProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly templateName: string;
  readonly templateCategory: string;
  readonly customCategory: string;
  readonly onTemplateNameChange: (v: string) => void;
  readonly onTemplateCategoryChange: (v: string) => void;
  readonly onCustomCategoryChange: (v: string) => void;
  readonly onSave: () => void;
}

export function EmailTemplateSelector({
  open, onOpenChange, templateName, templateCategory, customCategory,
  onTemplateNameChange, onTemplateCategoryChange, onCustomCategoryChange, onSave,
}: EmailTemplateSelectorProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Salva come template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Nome template *</Label>
            <Input value={templateName} onChange={e => onTemplateNameChange(e.target.value)} placeholder="Es. Follow-up trasporti aerei" className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Tipologia *</Label>
            <Select value={templateCategory} onValueChange={onTemplateCategoryChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primo_contatto">🤝 Primo contatto</SelectItem>
                <SelectItem value="follow_up">🔄 Follow-up</SelectItem>
                <SelectItem value="richiesta_info">📋 Richiesta info</SelectItem>
                <SelectItem value="proposta_servizi">📦 Proposta servizi</SelectItem>
                <SelectItem value="partnership">🤝 Partnership</SelectItem>
                <SelectItem value="network_espresso">✈️ Network espresso</SelectItem>
                <SelectItem value="__new__">➕ Nuova categoria...</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {templateCategory === "__new__" && (
            <div>
              <Label className="text-xs">Nome nuova categoria *</Label>
              <Input value={customCategory} onChange={e => onCustomCategoryChange(e.target.value)} placeholder="Es. Post-fiera" className="h-8 text-sm" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button size="sm" className="h-8 text-xs" onClick={onSave}>Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
