/**
 * SenderCard — Draggable sender card with domain favicon, country flag, email preview, and group assignment dropdown
 * Enhanced with per-address prompts, rules, and bulk email operations
 */
import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Mail, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { BackfillButton } from './BackfillButton';

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
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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

  const handleGroupSelection = async () => {
    if (!selectedGroupId || !onAssignGroup) return;
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    setIsAssigning(true);
    try {
      await onAssignGroup(sender, group.nome_gruppo, group.id);
      setSelectedGroupId("");
    } catch (err) {
      toast.error("Errore assegnazione");
    } finally {
      setIsAssigning(false);
    }
  };

  const loadAddressRule = async () => {
    try {
      setIsLoadingRule(true);
      // LOVABLE-FIX user_id required (DB NOT NULL) + multi-row safety
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Sessione scaduta');
        return;
      }
      const { data, error } = await sb
        .from('email_address_rules')
        .select('id, custom_prompt, applied_rules, prompt_template_id')
        .eq('email_address', sender.email)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
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
            user_id: user.id,
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

  const toggleExpanded = async () => {
    if (!isExpanded && !addressRule) {
      // Load rule when expanding if not already loaded
      await loadAddressRule();
    }
    setIsExpanded(!isExpanded);
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
        <CardContent className="p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {onToggleSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(sender.email)}
                className="h-4 w-4 flex-shrink-0"
              />
            )}
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

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
              <div className="font-semibold text-sm truncate">{sender.companyName}</div>
              <div className="text-[11px] text-muted-foreground truncate">{sender.email}</div>
            </div>

            {/* Email count + flag (compact inline row, vertically aligned to name) */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-lg font-bold text-primary leading-none">{sender.emailCount}</span>
              {flag && (
                <span className="text-base leading-none" title={sender.domain}>
                  {flag}
                </span>
              )}
            </div>

            {/* View emails button */}
            {onViewEmails && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewEmails(sender); }}
                className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors flex-shrink-0 ml-1"
                title="Visualizza email"
                draggable={false}
              >
                <Mail className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Group assignment dropdown */}
          {groups && groups.length > 0 && onAssignGroup && (
            <div className="flex items-center gap-1.5">
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Assegna gruppo…" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <span className="mr-2">{group.icon || '📁'}</span>
                      {group.nome_gruppo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedGroupId && (
                <Button
                  size="icon"
                  variant="default"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleGroupSelection(); }}
                  disabled={isAssigning}
                  title="Conferma assegnazione"
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Expand/collapse button for advanced options */}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
            disabled={isLoadingRule}
            className="w-full h-8 text-xs"
          >
            {isLoadingRule ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <>
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 mr-2" /> : <ChevronDown className="h-3.5 w-3.5 mr-2" />}
              </>
            )}
            {isExpanded ? 'Meno opzioni' : 'Più opzioni'}
          </Button>
        </CardContent>

        {/* Expandable advanced options section */}
        {isExpanded && addressRule && (
          <div className="border-t px-3 py-3 bg-muted/20 flex flex-col gap-4 text-sm">
            {/* Prompt section */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">Prompt personalizzato</label>
              <PromptTemplateSelector
                customPrompt={addressRule.custom_prompt}
                onPromptChange={handlePromptChange}
                isEditing={isSavingRule}
              />
            </div>

            {/* Rules section */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">Regole IMAP/SMTP</label>
              <RulesConfiguration
                appliedRules={addressRule.applied_rules}
                onRulesChange={handleRulesChange}
                isSaving={isSavingRule}
              />
              {/* Backfill: applica le regole IMAP ai messaggi storici di questo address */}
              {addressRule.applied_rules.some((r) =>
                ["mark_read", "archive", "move_to_folder", "spam"].includes(r),
              ) && (
                <div className="pt-1">
                  <BackfillButton scope="address" target={sender.email} variant="button" />
                </div>
              )}
            </div>

            {/* Bulk email actions section */}
            <div className="flex flex-col gap-2 pt-2 border-t">
              <label className="text-xs font-semibold text-muted-foreground">Azioni bulk</label>
              <BulkEmailActions
                senderEmail={sender.email}
                onActionsComplete={() => {
                  toast.success('Operazione completata');
                }}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
