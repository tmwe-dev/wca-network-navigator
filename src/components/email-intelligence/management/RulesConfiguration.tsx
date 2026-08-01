/**
 * RulesConfiguration — Configura UNA azione IMAP principale + toggle "segna anche come letto".
 *
 * Le checkbox precedenti permettevano selezioni multiple incoerenti (es. archive+delete),
 * e mappavano su un campo `applied_rules` che NON esiste nello schema reale di
 * email_address_rules. La pipeline `apply-email-rules` legge solo `auto_action`
 * (singola azione) + `auto_action_params` (JSONB), quindi le selezioni precedenti
 * non venivano mai eseguite.
 *
 * L'azione `delete` sposta nel cestino IMAP (Trash) ed esegue EXPUNGE: NON è
 * eliminazione fisica irreversibile, il server applica la sua retention policy.
 * Le azioni `mark_important`, `forward_to`, `auto_reply`, `skip_inbox` non sono
 * ancora implementate e restano in coming-soon.
 */
import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Inbox } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export type ImapAction = 'none' | 'mark_read' | 'archive' | 'move_to_folder' | 'spam' | 'delete' | 'hide';

export interface RulesConfigValue {
  auto_action: ImapAction;
  auto_action_params: {
    target_folder?: string;
    also_mark_read?: boolean;
    backfill_cap?: number;
  };
}

interface RulesConfigurationProps {
  value: RulesConfigValue;
  onChange: (next: RulesConfigValue) => void;
  isSaving?: boolean;
}

const ACTION_OPTIONS: Array<{ value: ImapAction; label: string; description: string }> = [
  { value: 'none', label: 'Nessuna azione automatica', description: 'Le email arrivano in inbox normalmente' },
  { value: 'mark_read', label: 'Segna come letto', description: 'Imposta il flag \\Seen senza spostare' },
  { value: 'archive', label: 'Archivia', description: 'Sposta nella cartella Archive (o quella indicata)' },
  { value: 'spam', label: 'Sposta in Spam/Junk', description: 'Sposta nella cartella Junk (o quella indicata)' },
  { value: 'move_to_folder', label: 'Sposta in cartella…', description: 'Sposta in una cartella IMAP a tua scelta' },
  { value: 'delete', label: 'Elimina (cestino)', description: 'Sposta in Trash + EXPUNGE. Reversibile finché il server non lo cancella.' },
  { value: 'hide', label: 'Nascondi (solo nel nostro DB)', description: 'Non tocca IMAP, nasconde dal nostro inbox' },
];

const COMING_SOON: Array<{ id: string; label: string }> = [
  { id: 'mark_important', label: 'Segna come importante' },
  { id: 'forward_to', label: 'Inoltra a…' },
  { id: 'auto_reply', label: 'Risposta automatica' },
];

export function RulesConfiguration({ value, onChange, isSaving = false }: RulesConfigurationProps) {
  const [draft, setDraft] = useState<RulesConfigValue>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  const setAction = (action: ImapAction) => {
    setDraft((d) => ({
      ...d,
      auto_action: action,
      auto_action_params: {
        ...d.auto_action_params,
        // Reset target_folder se non più rilevante
        target_folder: ['archive', 'spam', 'move_to_folder'].includes(action)
          ? d.auto_action_params.target_folder
          : undefined,
      },
    }));
  };

  const setTargetFolder = (folder: string) => {
    setDraft((d) => ({
      ...d,
      auto_action_params: { ...d.auto_action_params, target_folder: folder || undefined },
    }));
  };

  const setAlsoMarkRead = (checked: boolean) => {
    setDraft((d) => ({
      ...d,
      auto_action_params: { ...d.auto_action_params, also_mark_read: checked || undefined },
    }));
  };

  const needsTargetFolder = ['archive', 'spam', 'move_to_folder'].includes(draft.auto_action);
  const allowsAlsoMarkRead = ['archive', 'spam', 'move_to_folder'].includes(draft.auto_action);

  return (
    <div className="flex flex-col gap-3">
      {/* Azione principale */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Azione automatica all'arrivo</Label>
        <Select value={draft.auto_action} onValueChange={(v) => setAction(v as ImapAction)} disabled={isSaving}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-[11px] text-muted-foreground">{opt.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cartella target (se applicabile) */}
      {needsTargetFolder && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target-folder" className="text-xs font-semibold text-muted-foreground">
            Cartella di destinazione
          </Label>
          <Input
            id="target-folder"
            placeholder={
              draft.auto_action === 'archive' ? 'Archive (default)'
              : draft.auto_action === 'spam' ? 'Junk (default)'
              : 'es. INBOX/LinkedIn'
            }
            value={draft.auto_action_params.target_folder ?? ''}
            onChange={(e) => setTargetFolder(e.target.value)}
            disabled={isSaving}
            className="h-8 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Lascia vuoto per usare il default. La cartella viene creata se non esiste.
          </p>
        </div>
      )}

      {/* Toggle "anche segna come letto" */}
      {allowsAlsoMarkRead && (
        <div className="flex items-center justify-between gap-2 rounded border border-muted bg-muted/20 px-2 py-1.5">
          <Label htmlFor="also-mark-read" className="text-xs cursor-pointer">
            Segna anche come letto durante lo spostamento
          </Label>
          <Switch
            id="also-mark-read"
            checked={draft.auto_action_params.also_mark_read === true}
            onCheckedChange={setAlsoMarkRead}
            disabled={isSaving}
          />
        </div>
      )}

      {/* Save button */}
      {dirty && (
        <Button size="sm" onClick={() => onChange(draft)} disabled={isSaving} className="w-full">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Inbox className="h-4 w-4 mr-2" />}
          Salva regola
        </Button>
      )}

      {/* Coming-soon */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">Azioni in arrivo (non ancora attive)</summary>
        <ul className="list-disc pl-5 mt-1 space-y-0.5">
          {COMING_SOON.map((c) => <li key={c.id}>{c.label}</li>)}
        </ul>
      </details>
    </div>
  );
}
