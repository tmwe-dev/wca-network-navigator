/**
 * MultiSelectBulkBar — Floating action bar for bulk operations on multiple senders
 * Shows at bottom of left panel when senders are selected
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase as supabaseTyped } from '@/integrations/supabase/client';
// Cast controllato: vedi nota in BulkEmailActions.tsx (DEBT-EMAIL-INTEL-COLUMNS).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import { toast } from 'sonner';
import { Trash2, Archive, Folder, Check, X } from 'lucide-react';
import type { SenderAnalysis, EmailSenderGroup } from '@/types/email-management';

import { createLogger } from "@/lib/log";
const log = createLogger("MultiSelectBulkBar");

interface MultiSelectBulkBarProps {
  selectedSenders: SenderAnalysis[];
  groups: EmailSenderGroup[];
  onComplete?: () => void;
  onAssignGroup?: (senders: SenderAnalysis[], groupName: string, groupId: string) => Promise<void>;
}

type ActionType = 'delete' | 'archive' | 'mark-read' | 'move' | null;

export function MultiSelectBulkBar({
  selectedSenders,
  groups,
  onComplete,
  onAssignGroup,
}: MultiSelectBulkBarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionType>(null);
  const [confirmationCount, setConfirmationCount] = useState(0);
  const [confirmTimer, setConfirmTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");

  // Reset confirmation after 5 seconds of inactivity
  useEffect(() => {
    if (confirmationCount > 0 && pendingAction) {
      if (confirmTimer) clearTimeout(confirmTimer);

      const timer = setTimeout(() => {
        setPendingAction(null);
        setConfirmationCount(0);
      }, 5000);

      setConfirmTimer(timer);

      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [confirmationCount, pendingAction, confirmTimer]);

  const totalEmailCount = selectedSenders.reduce((sum, s) => sum + s.emailCount, 0);
  const totalSendersCount = selectedSenders.length;

  const handleActionClick = (action: ActionType) => {
    if (pendingAction === action) {
      if (confirmationCount === 1) {
        setConfirmationCount(2);
        executeAction(action);
      }
    } else {
      setPendingAction(action);
      setConfirmationCount(1);
    }
  };

  const executeAction = async (action: ActionType) => {
    if (!action) return;

    setIsLoading(true);
    setProgress({ current: 0, total: totalEmailCount });

    try {
      // Collect all emails from all selected senders
      const emailPromises = selectedSenders.map((sender) =>
        supabase
          .from('channel_messages')
          .select('id')
          .eq('channel', 'email')
          .eq('from', sender.email)
          .is('deleted_at', null)
      );

      const results = await Promise.all(emailPromises);
      const allEmails: string[] = [];
      results.forEach((result) => {
        if (!result.error && result.data) {
          allEmails.push(...result.data.map((e: { id: string }) => e.id));
        }
      });

      if (allEmails.length === 0) {
        toast.info('Nessuna email trovata');
        setProgress(null);
        setIsLoading(false);
        return;
      }

      // Process emails one at a time with 200ms delay
      for (let i = 0; i < allEmails.length; i++) {
        const emailId = allEmails[i];

        try {
          if (action === 'delete') {
            await supabase
              .from('channel_messages')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', emailId);
          } else if (action === 'archive') {
            await supabase
              .from('channel_messages')
              .update({ folder: 'ARCHIVE' })
              .eq('id', emailId);
          } else if (action === 'mark-read') {
            await supabase
              .from('channel_messages')
              .update({ is_read: true })
              .eq('id', emailId);
          } else if (action === 'move' && selectedFolder) {
            await supabase
              .from('channel_messages')
              .update({ folder: selectedFolder })
              .eq('id', emailId);
          }
        } catch (err) {
          log.error(`Error processing email ${i + 1}:`, { error: err });
        }

        // Update progress
        setProgress({ current: i + 1, total: allEmails.length });

        // 200ms delay between emails
        if (i < allEmails.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      const actionLabels: Record<Exclude<ActionType, null>, string> = {
        delete: 'eliminate',
        archive: 'archiviate',
        'mark-read': 'marked as read',
        move: 'moved',
      };
      const label = action ? actionLabels[action] : '';
      toast.success(
        `${allEmails.length} email ${label} da ${totalSendersCount} mittenti`
      );

      setPendingAction(null);
      setConfirmationCount(0);
      setProgress(null);
      setSelectedFolder("");

      onComplete?.();
    } catch (err) {
      toast.error("Errore durante l'operazione");
      log.error("error", { error: err });
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleAssignGroup = async () => {
    if (!selectedGroupId || !onAssignGroup) return;
    const group = groups.find((g) => g.id === selectedGroupId);
    if (!group) return;

    try {
      setIsLoading(true);
      await onAssignGroup(selectedSenders, group.nome_gruppo, group.id);
      setSelectedGroupId("");
      toast.success(`${totalSendersCount} mittenti → ${group.nome_gruppo}`);
      onComplete?.();
    } catch (err) {
      toast.error("Errore assegnazione");
      log.error("error", { error: err });
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonLabel = (action: ActionType): string => {
    if (pendingAction === action && confirmationCount === 1) {
      if (action === 'delete') return `Conferma: eliminare ${totalEmailCount} email da ${totalSendersCount} mittenti?`;
      if (action === 'archive') return `Archivia ${totalEmailCount} email?`;
      if (action === 'move') return `Sposta ${totalEmailCount} email?`;
      return 'Conferma?';
    }

    return action === 'delete'
      ? 'Elimina email'
      : action === 'archive'
        ? 'Archivia email'
        : action === 'mark-read'
          ? 'Segna come letto'
          : action === 'move'
            ? 'Sposta email'
            : '';
  };

  const getButtonVariant = (action: ActionType) => {
    if (pendingAction === action && confirmationCount === 1) {
      return action === 'delete' ? 'destructive' : 'secondary';
    }
    return 'outline';
  };

  return (
    <div className="border-t bg-muted/40 px-3 py-3 flex-shrink-0 flex flex-col gap-3">
      {/* Progress bar */}
      {progress && isLoading && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-muted-foreground">
            Elaborazione {progress.current}/{progress.total} email...
          </div>
          <Progress value={(progress.current / progress.total) * 100} className="h-1.5" />
        </div>
      )}

      {/* Action buttons grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Delete button */}
        <Button
          size="sm"
          variant={getButtonVariant('delete')}
          onClick={() => handleActionClick('delete')}
          disabled={isLoading}
          className="text-xs"
          title={`Elimina ${totalEmailCount} email`}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Elimina
        </Button>

        {/* Archive button */}
        <Button
          size="sm"
          variant={getButtonVariant('archive')}
          onClick={() => handleActionClick('archive')}
          disabled={isLoading}
          className="text-xs"
          title={`Archivia ${totalEmailCount} email`}
        >
          <Archive className="h-3.5 w-3.5 mr-1" />
          Archivia
        </Button>

        {/* Mark as read button */}
        <Button
          size="sm"
          variant={getButtonVariant('mark-read')}
          onClick={() => handleActionClick('mark-read')}
          disabled={isLoading}
          className="text-xs"
          title={`Segna ${totalEmailCount} email come letto`}
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          Leggi
        </Button>
      </div>

      {/* Move to folder */}
      <div className="flex items-center gap-2">
        <Select value={selectedFolder} onValueChange={setSelectedFolder}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <Folder className="h-3 w-3 mr-2" />
            <SelectValue placeholder="Sposta a..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INBOX">Inbox</SelectItem>
            <SelectItem value="ARCHIVE">Archivio</SelectItem>
            <SelectItem value="SPAM">Spam</SelectItem>
            <SelectItem value="TRASH">Cestino</SelectItem>
          </SelectContent>
        </Select>
        {selectedFolder && (
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => handleActionClick('move')}
            disabled={isLoading}
            title="Conferma spostamento"
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Assign to group */}
      {groups.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Assegna gruppo..." />
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
              onClick={handleAssignGroup}
              disabled={isLoading}
              title="Assegna gruppo"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Confirmation message when action is pending */}
      {pendingAction && confirmationCount === 1 && (
        <div className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded border border-destructive/30">
          {getButtonLabel(pendingAction)}
        </div>
      )}

      {/* Summary line */}
      {!isLoading && (
        <div className="text-xs text-muted-foreground">
          {totalSendersCount} mittenti · {totalEmailCount} email totali
        </div>
      )}
    </div>
  );
}
