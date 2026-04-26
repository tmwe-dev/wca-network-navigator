/**
 * GroupDropZone — Drop zone for sender groups (ported from tmwengine, adapted to WCA)
 */
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDomainFaviconUrl } from '@/lib/domainUtils';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EmailSenderGroup } from '@/types/email-management';

interface GroupDropZoneProps {
  group: EmailSenderGroup;
  onRefresh: () => void;
  isHovered?: boolean;
  /**
   * Rules assigned to this group, provided by the parent.
   * Lifted out of this component to avoid N parallel queries +
   * N realtime channels (one per group) — see useGroupingData.
   */
  rules?: AssignedRule[];
  onRulesChanged?: () => void;
}

interface AssignedRule {
  id: string;
  email_address: string;
  display_name?: string | null;
}

export function GroupDropZone({ group, onRefresh, isHovered = false, rules = [], onRulesChanged }: GroupDropZoneProps) {
  const [faviconError, setFaviconError] = useState<Record<string, boolean>>({});

  const extractCompany = (email: string): string => {
    const match = email.match(/@([^.]+)\./);
    return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : email;
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

  // Rules already arrive ordered by created_at DESC from useGroupingData,
  // so rules[0] is the latest associated address.
  const lastRule = rules[0];
  const lastDomain = lastRule?.email_address?.split('@')[1] ?? '';
  const lastFavicon = lastDomain ? getDomainFaviconUrl(lastDomain) : null;

  return (
    <div
      className="h-[22vh] w-[15vw] min-w-[280px] max-w-[360px]"
      data-drop-zone="true"
      data-group-id={group.id}
      data-group-name={group.nome_gruppo}
    >
      <Card
        className={cn(
          "h-full transition-colors duration-150 border-2 flex flex-col overflow-hidden p-0",
          isHovered && "border-primary bg-primary/5 ring-2 ring-primary/30"
        )}
        style={{
          borderColor: isHovered ? group.colore : undefined,
          backgroundColor: isHovered ? `${group.colore}15` : undefined,
        }}
      >
        {/* HEADER — icona+nome/descrizione a sinistra, count grande + azioni a destra */}
        <div
          className="px-3 py-2.5 border-b flex-shrink-0 relative bg-gradient-to-r"
          style={{ backgroundImage: `linear-gradient(to right, ${group.colore}59, ${group.colore}00)` }}
        >
          <div className="flex items-start gap-2.5">
            {/* Icona */}
            <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{group.icon || '📁'}</span>

            {/* Nome + descrizione (impilati) */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate leading-tight" style={{ color: group.colore }}>
                {group.nome_gruppo}
              </div>
              {group.descrizione && (
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">{group.descrizione}</div>
              )}
            </div>

            {/* Conteggio grande */}
            <div className="flex flex-col items-center gap-0 flex-shrink-0 min-w-[28px]">
              <span
                className="text-xl font-bold leading-none"
                style={{ color: group.colore }}
              >
                {rules.length}
              </span>
            </div>

            {/* Azioni: lista + cestino */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Vedi tutte le aziende"
                    title="Vedi e gestisci tutte le aziende associate"
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <span className="text-2xl">{group.icon || '📁'}</span>
                      {group.nome_gruppo}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {rules.length} {rules.length === 1 ? 'azienda' : 'aziende'}
                      </span>
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 mt-4">
                    {rules.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">Nessun mittente classificato</p>
                    ) : (
                      rules.map(rule => (
                        <div key={rule.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-md hover:bg-muted/60 transition-colors group">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-base">{rule.display_name || extractCompany(rule.email_address)}</div>
                            <div className="text-sm text-muted-foreground">{rule.email_address}</div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
                            onClick={() => handleRemoveRule(rule.id, rule.email_address)} aria-label="Elimina">
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
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" aria-label="Elimina">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
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
        </div>

        {/* BODY — solo l'ultima azienda associata, in stile card mittente */}
        <div className="flex-1 px-3 py-2 relative flex flex-col justify-center min-h-0">
          {/* Drop hint pill quando in hover */}
          {isHovered && (
            <div className="absolute inset-x-2 top-1 z-10 flex items-center justify-center pointer-events-none animate-pulse">
              <div className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold shadow flex items-center gap-1">
                <span>👇</span>
                <span>Rilascia qui</span>
              </div>
            </div>
          )}

          {lastRule ? (
            <div className="flex flex-col gap-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                Ultima associata
              </div>
              <div className="flex items-center gap-2">
                {/* Favicon */}
                {lastFavicon && !faviconError[lastRule.id] ? (
                  <img
                    src={lastFavicon}
                    alt=""
                    className="h-5 w-5 rounded-sm flex-shrink-0 object-contain"
                    loading="lazy"
                    onError={() => setFaviconError((p) => ({ ...p, [lastRule.id]: true }))}
                  />
                ) : (
                  <div className="h-5 w-5 rounded-sm bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {lastDomain.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs truncate leading-tight">
                    {lastRule.display_name || extractCompany(lastRule.email_address)}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{lastRule.email_address}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 hover:text-destructive"
                  onClick={() => handleRemoveRule(lastRule.id, lastRule.email_address)}
                  title="Rimuovi dal gruppo"
                  aria-label="Rimuovi"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {rules.length > 1 && (
                <div className="text-[10px] text-muted-foreground pt-0.5">
                  +{rules.length - 1} altre — clicca <List className="inline h-2.5 w-2.5" /> per vederle
                </div>
              )}
            </div>
          ) : (
            !isHovered && (
              <p className="text-xs text-muted-foreground text-center">Trascina sender qui</p>
            )
          )}
        </div>
      </Card>
    </div>
  );
}
