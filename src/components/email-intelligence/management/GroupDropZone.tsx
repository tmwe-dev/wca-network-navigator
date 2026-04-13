/**
 * GroupDropZone — Drop zone for sender groups (ported from tmwengine, adapted to WCA)
 */
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EmailSenderGroup } from '@/types/email-management';

interface GroupDropZoneProps {
  group: EmailSenderGroup;
  onRefresh: () => void;
  isHovered?: boolean;
}

interface AssignedRule {
  id: string;
  email_address: string;
  display_name?: string | null;
}

export function GroupDropZone({ group, onRefresh, isHovered = false }: GroupDropZoneProps) {
  const [rules, setRules] = useState<AssignedRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRules();
    const channel = supabase
      .channel(`group-rules-${group.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_address_rules' }, () => loadRules())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [group.nome_gruppo]);

  const loadRules = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('email_address_rules')
      .select('id, email_address, display_name')
      .eq('group_name', group.nome_gruppo)
      .order('created_at', { ascending: false });
    setRules((data || []) as AssignedRule[]);
    setLoading(false);
  };

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
      loadRules();
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
      className="h-[20vh] w-[15vw] min-w-[260px] max-w-[360px]"
      data-drop-zone="true"
      data-group-id={group.id}
      data-group-name={group.nome_gruppo}
    >
      <Card
        className={cn(
          "h-full transition-all border-2 flex flex-col overflow-hidden",
          isHovered && "border-primary bg-primary/5 shadow-2xl scale-105 ring-4 ring-primary/20"
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
                  {group.nome_gruppo} <span className="text-destructive ml-1.5">{rules.length}</span>
                </CardTitle>
                {group.descrizione && <CardDescription className="text-xs mt-1">{group.descrizione}</CardDescription>}
              </div>
            </div>
            <div className="flex gap-1">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ingrandisci"><ZoomIn className="h-4 w-4" /></Button>
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
                        <div key={rule.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-md hover:bg-muted/60 transition-colors group">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-base">{rule.display_name || extractCompany(rule.email_address)}</div>
                            <div className="text-sm text-muted-foreground">{rule.email_address}</div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
                            onClick={() = aria-label="Elimina"> handleRemoveRule(rule.id, rule.email_address)} aria-label="Elimina">
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
        <CardContent className="pt-4 flex-1 overflow-hidden flex flex-col items-center justify-center">
          {isHovered && rules.length === 0 && (
            <div className="text-center py-12 animate-pulse">
              <div className="text-5xl mb-3">👇</div>
              <p className="text-sm font-medium text-primary">Rilascia qui per classificare</p>
            </div>
          )}
          {!isHovered && rules.length > 0 && (
            <div className="text-left w-full px-2">
              <div className="font-bold text-xl mb-1">{rules[0].display_name || extractCompany(rules[0].email_address)}</div>
              <div className="text-sm text-muted-foreground truncate">{rules[0].email_address}</div>
            </div>
          )}
          {!isHovered && rules.length === 0 && (
            <p className="text-xs text-muted-foreground">Trascina sender qui</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
