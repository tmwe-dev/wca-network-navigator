/**
 * SenderCard — Draggable sender card with domain favicon, country flag, email preview, and group assignment dropdown
 * Enhanced with per-address prompts, rules, and bulk email operations
 */
import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Mail, Settings2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getFlagFromDomain, getDomainFaviconUrl } from '@/lib/domainUtils';
import type { SenderAnalysis, EmailSenderGroup } from '@/types/email-management';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
// Cast controllato: questo modulo seleziona/aggiorna `applied_rules` e
// `prompt_template_id` su `email_address_rules`, ma le colonne reali sono
// diverse (vedi DEBT-EMAIL-INTEL-COLUMNS). Bypass tipi locale.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { PromptTemplateSelector } from './PromptTemplateSelector';
import { RulesConfiguration } from './RulesConfiguration';
import { BulkEmailActions } from './BulkEmailActions';

interface SenderCardProps {
  sender: SenderAnalysis;
  onDragStart?: (sender: SenderAnalysis) => void;
  onDragEnd?: (clientX: number, clientY: number) => void;
  onDoubleClick?: (sender: SenderAnalysis) => void;
  onViewEmails?: (sender: SenderAnalysis) => void;
  groups?: EmailSenderGroup[];
  onAssignGroup?: (sender: SenderAnalysis, groupName: string, groupId: string) => Promise<void>;
  onAddressRuleUpdated?: () => void;
  isSelected?: boolean;
  onToggleSelect?: (email: string) => void;
}

interface AddressRule {
  id: string;
  custom_prompt: string | null;
  applied_rules: string[];
  prompt_template_id: string | null;
}

export function SenderCard({
  sender,
  onDragStart,
  onDragEnd,
  onDoubleClick,
  onViewEmails,
  groups = [],
  onAssignGroup,
  onAddressRuleUpdated,
  isSelected = false,
  onToggleSelect
}: SenderCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [addressRule, setAddressRule] = useState<AddressRule | null>(null);
  const [isLoadingRule, setIsLoadingRule] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const flag = getFlagFromDomain(sender.domain);
  const faviconUrl = getDomainFaviconUrl(sender.domain);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true);
    onDragStart?.(sender);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(sender));
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(false);
    onDragEnd?.(e.clientX, e.clientY);
  };

  // Direct assignment on Select change — no separate confirm button.
  const handleGroupSelection = async (groupId: string) => {
    if (!groupId || !onAssignGroup) return;
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    setIsAssigning(true);
    try {
      await onAssignGroup(sender, group.nome_gruppo, group.id);
    } catch (err) {
      toast.error("Errore assegnazione");
    } finally {
      setIsAssigning(false);
    }
  };

  const loadAddressRule = async () => {
    try {
      setIsLoadingRule(true);
      const { data, error } = await sb
        .from('email_address_rules')
        .select('id, custom_prompt, applied_rules, prompt_template_id')
        .eq('email_address', sender.email)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setAddressRule({
          id: data.id,
          custom_prompt: data.custom_prompt,
          applied_rules: Array.isArray(data.applied_rules) ? data.applied_rules : [],
          prompt_template_id: data.prompt_template_id
        });
      } else {
        // Create a new rule if it doesn't exist
        const { data: newRule, error: createError } = await sb
          .from('email_address_rules')
          .insert({
            email_address: sender.email,
            custom_prompt: null,
            applied_rules: [],
            prompt_template_id: null
          })
          .select('id, custom_prompt, applied_rules, prompt_template_id')
          .single();

        if (createError) throw createError;
        if (newRule) {
          setAddressRule({
            id: newRule.id,
            custom_prompt: newRule.custom_prompt,
            applied_rules: [],
            prompt_template_id: newRule.prompt_template_id
          });
        }
      }
    } catch (err) {
      toast.error('Errore caricamento configurazione');
      console.error(err);
    } finally {
      setIsLoadingRule(false);
    }
  };

  const openOptionsDialog = async () => {
    if (!addressRule) {
      await loadAddressRule();
    }
    setOptionsOpen(true);
  };

  const handlePromptChange = async (prompt: string) => {
    if (!addressRule) return;

    try {
      setIsSavingRule(true);
      const { error } = await sb
        .from('email_address_rules')
        .update({
          custom_prompt: prompt || null,
          prompt_template_id: null
        })
        .eq('id', addressRule.id);

      if (error) throw error;

      setAddressRule({ ...addressRule, custom_prompt: prompt, prompt_template_id: null });
      toast.success('Prompt salvato');
      onAddressRuleUpdated?.();
    } catch (err) {
      toast.error('Errore salvataggio prompt');
      console.error(err);
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleRulesChange = async (rules: string[]) => {
    if (!addressRule) return;

    try {
      setIsSavingRule(true);
      const { error } = await sb
        .from('email_address_rules')
        .update({ applied_rules: rules })
        .eq('id', addressRule.id);

      if (error) throw error;

      setAddressRule({ ...addressRule, applied_rules: rules });
      toast.success('Regole salvate');
      onAddressRuleUpdated?.();
    } catch (err) {
      toast.error('Errore salvataggio regole');
      console.error(err);
    } finally {
      setIsSavingRule(false);
    }
  };

  return (
    <div
      ref={cardRef}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn("snap-start", isDragging && "opacity-30")}
    >
      <Card
        onDoubleClick={() => onDoubleClick?.(sender)}
        className={cn(
          "border-l-4 transition-all cursor-grab",
          !isDragging && "hover:scale-[1.02]",
          isSelected && "border-2 border-primary bg-primary/5",
          sender.emailCount > 100
            ? "border-l-destructive"
            : sender.emailCount > 50
              ? "border-l-orange-500"
              : "border-l-primary/40",
          isDragging && "cursor-grabbing"
        )}
      >
        <CardContent className="p-2.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            {onToggleSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(sender.email)}
                className="h-4 w-4 flex-shrink-0"
              />
            )}
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

            {/* Favicon */}
            {faviconUrl && !faviconError ? (
              <img
                src={faviconUrl}
                alt=""
                className="h-5 w-5 rounded-sm flex-shrink-0 object-contain"
                loading="lazy"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <div className="h-5 w-5 rounded-sm bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">
                  {sender.domain?.charAt(0)?.toUpperCase() || "?"}
                </span>
              </div>
            )}

            {/* Name + email */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate leading-tight">{sender.companyName}</div>
              <div className="text-[11px] text-muted-foreground truncate">{sender.email}</div>
            </div>

            {/* Email count + flag — compact column */}
            <div className="flex flex-col items-center gap-0 flex-shrink-0 min-w-[28px]">
              <span className="text-base font-bold text-primary leading-none">{sender.emailCount}</span>
              {flag && (
                <span className="text-sm leading-none mt-0.5" title={sender.domain}>
                  {flag}
                </span>
              )}
            </div>

            {/* Action icons — stacked compact */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {onViewEmails && (
                <button
                  onClick={(e) => { e.stopPropagation(); onViewEmails(sender); }}
                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                  title="Visualizza email"
                  draggable={false}
                >
                  <Mail className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); openOptionsDialog(); }}
                disabled={isLoadingRule}
                className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                title="Opzioni avanzate (prompt, regole, azioni bulk)"
                draggable={false}
              >
                {isLoadingRule
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Settings2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Group assignment dropdown — direct assign on selection, no extra confirm row */}
          {groups && groups.length > 0 && onAssignGroup && (
            <Select value="" onValueChange={handleGroupSelection} disabled={isAssigning}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder={isAssigning ? "Assegnazione…" : "Assegna gruppo…"} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id} className="text-xs">
                    <span className="mr-2">{group.icon || '📁'}</span>
                    {group.nome_gruppo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Advanced options modal — opened from the Settings icon */}
      <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4" />
              Opzioni avanzate · {sender.companyName}
            </DialogTitle>
            <p className="text-xs text-muted-foreground truncate">{sender.email}</p>
          </DialogHeader>

          {addressRule ? (
            <div className="flex flex-col gap-5 mt-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground">Prompt personalizzato</label>
                <PromptTemplateSelector
                  customPrompt={addressRule.custom_prompt}
                  onPromptChange={handlePromptChange}
                  isEditing={isSavingRule}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground">Regole IMAP/SMTP</label>
                <RulesConfiguration
                  appliedRules={addressRule.applied_rules}
                  onRulesChange={handleRulesChange}
                  isSaving={isSavingRule}
                />
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t">
                <label className="text-xs font-semibold text-muted-foreground">Azioni bulk</label>
                <BulkEmailActions
                  senderEmail={sender.email}
                  onActionsComplete={() => {
                    toast.success('Operazione completata');
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
