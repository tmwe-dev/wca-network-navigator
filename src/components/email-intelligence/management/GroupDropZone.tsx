/**
 * GroupDropZone — Drop zone for sender groups (ported from tmwengine, adapted to WCA)
 */
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, List, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EmailSenderGroup, SenderAnalysis } from '@/types/email-management';
import { BackfillButton } from './BackfillButton';

interface GroupDropZoneProps {
  group: EmailSenderGroup;
  onRefresh: () => void;
  isHovered?: boolean;
  /** Highlight temporaneo (es. dopo click su chip AI in SenderCard). */
  isHighlighted?: boolean;
  /**
   * Rules assigned to this group, provided by the parent.
   * Lifted out of this component to avoid N parallel queries +
   * N realtime channels (one per group) — see useGroupingData.
   */
  rules?: AssignedRule[];
  onRulesChanged?: () => void;
  /** Numero di sender attualmente selezionati nel rail (abilita "+ Associa"). */
  selectedCount?: number;
  /** Callback quando l'utente clicca "+ Associa" (parent gestisce il bulk). */
  onBulkAssign?: (group: EmailSenderGroup) => void;
  /** Quando l'utente clicca un partner nel gruppo, apri la popup azioni. */
  onPartnerClick?: (sender: SenderAnalysis) => void;
}

interface AssignedRule {
  id: string;
  email_address: string;
  display_name?: string | null;
  company_name?: string | null;
  domain?: string | null;
}

export function GroupDropZone({
  group,
  onRefresh,
  isHovered = false,
  isHighlighted = false,
  rules = [],
  onRulesChanged,
  selectedCount = 0,
  onBulkAssign,
  onPartnerClick,
}: GroupDropZoneProps) {
  const partnerToSender = (rule: AssignedRule): SenderAnalysis => ({
    email: rule.email_address,
    companyName: rule.display_name || extractCompany(rule.email_address, rule.domain, rule.company_name),
    domain: rule.domain ?? rule.email_address.split('@')[1] ?? '',
    emailCount: 0,
    isClassified: true,
  } as SenderAnalysis);


  // Estrae il dominio "root" (penultimo segmento prima del TLD) da un'email.
  // Per "info@mail.everok.eu" → "Everok" (non "Mail" come faceva la vecchia regex).
  const extractCompany = (email: string, domain?: string | null, companyName?: string | null): string => {
    if (companyName && companyName.trim()) return companyName.trim();
    const host = (domain || email.split('@')[1] || '').toLowerCase();
    const parts = host.split('.').filter(Boolean);
    if (parts.length === 0) return email;
    const root = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return root.charAt(0).toUpperCase() + root.slice(1);
  };

  const handleRemoveRule = async (ruleId: string, email: string) => {
    const { error } = await supabase
      .from('email_address_rules')
      .update({ group_name: null, group_color: null, group_icon: null })
      .eq('id', ruleId);
    if (!error) {
      toast.success(`${extractCompany(email)} rimosso da ${group.nome_gruppo}`);
      onRulesChanged?.();
    } else {
      toast.error('Errore rimozione');
    }
  };

  const handleDeleteGroup = async () => {
    // Remove group_name from all assigned rules
    await supabase
      .from('email_address_rules')
      .update({ group_name: null, group_color: null, group_icon: null })
      .eq('group_name', group.nome_gruppo);
    // Delete group definition
    const { error } = await supabase
      .from('email_sender_groups')
      .delete()
      .eq('id', group.id);
    if (!error) {
      toast.success(`${group.nome_gruppo} eliminato`);
      onRefresh();
    } else {
      toast.error('Errore eliminazione gruppo');
    }
  };

  return (
    <div
      className="h-full w-full min-h-[160px]"
      data-drop-zone="true"
      data-group-id={group.id}
      data-group-name={group.nome_gruppo}
    >
      <Card
        className={cn(
          "h-full transition-colors duration-150 border-2 flex flex-col overflow-hidden",
          isHovered && "border-primary bg-primary/5 ring-2 ring-primary/30",
          // Glow animato quando il gruppo è "highlighted" (es. via chip AI).
          isHighlighted && "ring-4 ring-primary/50 shadow-[0_0_0_4px_hsl(var(--primary)/0.15)] animate-pulse",
        )}
        style={{
          borderColor: isHovered ? group.colore : undefined,
          backgroundColor: isHovered ? `${group.colore}15` : undefined,
        }}
      >
        <CardHeader
          className="pb-3 border-b flex-shrink-0 relative bg-gradient-to-r"
          style={{ backgroundImage: `linear-gradient(to right, ${group.colore}59, ${group.colore}00)` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{group.icon || '📁'}</span>
              <div>
                <CardTitle className="text-base">
                  {group.nome_gruppo} <span className="text-muted-foreground ml-1.5 font-normal">({rules.length})</span>
                </CardTitle>
                {group.descrizione && <CardDescription className="text-xs mt-1">{group.descrizione}</CardDescription>}
              </div>
            </div>
            <div className="flex gap-1">
              {/* Bulk associate: visibile solo se ci sono sender selezionati */}
              {selectedCount > 0 && onBulkAssign && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBulkAssign(group);
                  }}
                  title={`Associa ${selectedCount} mittenti a ${group.nome_gruppo}`}
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  Associa {selectedCount}
                </Button>
              )}
              {/* Backfill IMAP del gruppo: applica le regole agli storici sequenzialmente per address */}
              <BackfillButton
                scope="group"
                target={group.nome_gruppo}
                addressCount={rules.length}
                variant="icon"
              />
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Vedi tutte le aziende"
                    title="Vedi e gestisci tutte le aziende associate"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <span className="text-2xl">{group.icon || '📁'}</span>{group.nome_gruppo}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 mt-4">
                    {rules.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">Nessun mittente classificato</p>
                    ) : (
                      rules.map(rule => (
                        <div
                          key={rule.id}
                          className={cn(
                            "flex items-center justify-between p-3 bg-muted/40 rounded-md hover:bg-muted/60 transition-colors group",
                            onPartnerClick && "cursor-pointer",
                          )}
                          onClick={() => onPartnerClick?.(partnerToSender(rule))}
                          title={onPartnerClick ? "Clicca per modificare azioni e regole" : undefined}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-base">{rule.display_name || extractCompany(rule.email_address, rule.domain, rule.company_name)}</div>
                            <div className="text-sm text-muted-foreground">{rule.email_address}</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveRule(rule.id, rule.email_address);
                            }}
                            aria-label="Elimina"
                          >
                             <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" aria-label="Elimina"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare gruppo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Eliminare <strong>{group.nome_gruppo}</strong>?
                      {rules.length > 0 && (
                        <span className="block mt-2 text-destructive font-medium">
                          {rules.length} associazioni verranno rimosse.
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-2 flex-1 overflow-hidden flex flex-col items-center justify-center relative">
          {/* Drop hint — compact pill that fits the 20vh card height
              and sits above the preview text without clipping behind the header. */}
          {isHovered && (
            <div className="absolute inset-x-2 top-1 z-10 flex items-center justify-center pointer-events-none animate-pulse">
              <div className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold shadow flex items-center gap-1">
                <span>👇</span>
                <span>Rilascia qui</span>
              </div>
            </div>
          )}
          {rules.length > 0 ? (
            <div className="text-left w-full px-2 space-y-0.5 overflow-hidden">
              {rules.slice(0, 3).map((r) => (
                <div key={r.id} className="leading-tight truncate">
                  <span className="font-semibold text-xs">{r.display_name || extractCompany(r.email_address, r.domain, r.company_name)}</span>
                  <span className="text-[10px] text-muted-foreground ml-1 truncate">{r.email_address}</span>
                </div>
              ))}
              {rules.length > 3 && (
                <div className="text-[10px] text-primary font-medium pt-0.5">
                  +{rules.length - 3} altre — clicca <List className="inline h-2.5 w-2.5" /> per vederle
                </div>
              )}
            </div>
          ) : (
            !isHovered && <p className="text-xs text-muted-foreground">Trascina sender qui</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
