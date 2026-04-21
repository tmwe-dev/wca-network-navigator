/**
 * RulesConfiguration — Checkboxes for IMAP/SMTP rules applied to an email address
 */
import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface RuleConfig {
  id: string;
  label: string;
  description: string;
}

interface RulesConfigurationProps {
  appliedRules: string[];
  onRulesChange: (rules: string[]) => void;
  isSaving?: boolean;
}

// Define available IMAP/SMTP rules
const AVAILABLE_RULES: RuleConfig[] = [
  {
    id: 'move_to_folder',
    label: 'Sposta in cartella',
    description: 'Sposta automaticamente in una cartella specifica'
  },
  {
    id: 'archive',
    label: 'Archivia',
    description: 'Archivia automaticamente le email'
  },
  {
    id: 'mark_read',
    label: 'Segna come letto',
    description: 'Marca automaticamente come letto'
  },
  {
    id: 'mark_important',
    label: 'Segna come importante',
    description: 'Contrassegna come importante'
  },
  {
    id: 'delete',
    label: 'Elimina',
    description: 'Elimina automaticamente le email'
  },
  {
    id: 'forward_to',
    label: 'Inoltra a',
    description: 'Inoltra automaticamente a un indirizzo'
  },
  {
    id: 'auto_reply',
    label: 'Rispondi automaticamente',
    description: 'Invia una risposta automatica'
  },
  {
    id: 'skip_inbox',
    label: 'Salta inbox',
    description: 'Impedisce che le email appiano nella inbox'
  }
];

export function RulesConfiguration({
  appliedRules,
  onRulesChange,
  isSaving = false
}: RulesConfigurationProps) {
  const [selectedRules, setSelectedRules] = useState<string[]>(appliedRules);

  useEffect(() => {
    setSelectedRules(appliedRules);
  }, [appliedRules]);

  const toggleRule = (ruleId: string) => {
    setSelectedRules(prev => {
      const isSelected = prev.includes(ruleId);
      return isSelected
        ? prev.filter(r => r !== ruleId)
        : [...prev, ruleId];
    });
  };

  const handleSave = () => {
    onRulesChange(selectedRules);
  };

  const hasChanges = JSON.stringify(selectedRules) !== JSON.stringify(appliedRules);

  return (
    <div className="flex flex-col gap-3">
      {/* Rules checkboxes */}
      <div className="grid grid-cols-1 gap-2">
        {AVAILABLE_RULES.map(rule => (
          <div key={rule.id} className="flex items-start gap-2">
            <Checkbox
              id={rule.id}
              checked={selectedRules.includes(rule.id)}
              onCheckedChange={() => toggleRule(rule.id)}
              disabled={isSaving}
              className="mt-1"
            />
            <Label
              htmlFor={rule.id}
              className="flex flex-col gap-0.5 cursor-pointer flex-1"
            >
              <span className="text-sm font-medium">{rule.label}</span>
              <span className="text-xs text-muted-foreground">{rule.description}</span>
            </Label>
          </div>
        ))}
      </div>

      {/* Save button */}
      {hasChanges && (
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full"
        >
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salva regole
        </Button>
      )}

      {/* Active rules summary */}
      {selectedRules.length > 0 && (
        <div className="bg-muted/30 p-2 rounded text-sm border border-muted">
          <div className="text-xs font-semibold mb-1">Regole attive:</div>
          <div className="flex flex-wrap gap-1">
            {selectedRules.map(ruleId => {
              const rule = AVAILABLE_RULES.find(r => r.id === ruleId);
              return (
                <span key={ruleId} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                  {rule?.label}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
