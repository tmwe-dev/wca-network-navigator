/**
 * BulkEmailActions — Buttons for bulk operations on emails with double-confirmation
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trash2, Archive, Folder, Check } from 'lucide-react';

interface BulkEmailActionsProps {
  senderEmail: string;
  onActionsComplete?: () => void;
}

type ActionType = 'delete' | 'archive' | 'mark-read' | null;

export function BulkEmailActions({ senderEmail, onActionsComplete }: BulkEmailActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionType>(null);
  const [confirmationCount, setConfirmationCount] = useState(0);
  const [totalEmails, setTotalEmails] = useState<number | null>(null);
  const [confirmTimer, setConfirmTimer] = useState<NodeJS.Timeout | null>(null);

  // Fetch total count of emails from this sender
  useEffect(() => {
    const fetchTotalEmails = async () => {
      try {
        const { count, error } = await supabase
          .from('channel_messages')
          .select('*', { count: 'exact', head: true })
          .eq('channel', 'email')
          .eq('from', senderEmail)
          .is('deleted_at', null);

        if (error) throw error;
        setTotalEmails(count || 0);
      } catch (err) {
        console.error('Error fetching email count:', err);
      }
    };

    fetchTotalEmails();
  }, [senderEmail]);

  // Reset confirmation after 5 seconds of inactivity
  useEffect(() => {
    if (confirmationCount > 0 && pendingAction) {
      // Clear previous timer
      if (confirmTimer) clearTimeout(confirmTimer);

      // Set new timer to reset after 5 seconds
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

  const handleActionClick = (action: ActionType) => {
    if (pendingAction === action) {
      // Second click - execute action
      if (confirmationCount === 1) {
        setConfirmationCount(2);
        executeAction(action);
      }
    } else {
      // First click - set pending action
      setPendingAction(action);
      setConfirmationCount(1);
    }
  };

  const executeAction = async (action: ActionType) => {
    if (!action) return;

    setIsLoading(true);
    setProgress({ current: 0, total: totalEmails || 0 });

    try {
      // Fetch all email IDs for this sender
      const { data: emails, error: fetchError } = await supabase
        .from('channel_messages')
        .select('id')
        .eq('channel', 'email')
        .eq('from', senderEmail)
        .is('deleted_at', null);

      if (fetchError) throw fetchError;

      const emailIds = (emails || []).map(e => e.id);
      const total = emailIds.length;

      if (total === 0) {
        toast.info('Nessuna email trovata');
        setProgress(null);
        setIsLoading(false);
        return;
      }

      // Process emails one at a time with progress updates
      for (let i = 0; i < emailIds.length; i++) {
        const emailId = emailIds[i];

        try {
          if (action === 'delete') {
            // Soft delete
            const { error } = await supabase
              .from('channel_messages')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', emailId);
            if (error) throw error;
          } else if (action === 'archive') {
            // Set folder to ARCHIVE
            const { error } = await supabase
              .from('channel_messages')
              .update({ folder: 'ARCHIVE' })
              .eq('id', emailId);
            if (error) throw error;
          } else if (action === 'mark-read') {
            // Mark as read
            const { error } = await supabase
              .from('channel_messages')
              .update({ is_read: true })
              .eq('id', emailId);
            if (error) throw error;
          }
        } catch (err) {
          console.error(`Error processing email ${i + 1}:`, err);
          // Continue with next email even if one fails
        }

        // Update progress
        setProgress({ current: i + 1, total });
      }

      // Show success message
      const actionLabels: Record<ActionType, string> = {
        delete: 'eliminate',
        archive: 'archiviate',
        'mark-read': 'marked as read',
        null: ''
      };

      toast.success(`${total} email ${actionLabels[action]} da ${senderEmail}`);

      // Reset UI
      setPendingAction(null);
      setConfirmationCount(0);
      setProgress(null);

      // Call callback
      onActionsComplete?.();
    } catch (err) {
      toast.error('Errore durante l\'operazione');
      console.error(err);
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const getButtonLabel = (action: ActionType): string => {
    if (pendingAction === action && confirmationCount === 1) {
      return action === 'delete'
        ? 'Sei sicuro?'
        : action === 'archive'
          ? 'Conferma archiviazione?'
          : 'Conferma?';
    }

    return action === 'delete'
      ? 'Elimina tutte'
      : action === 'archive'
        ? 'Archivia tutte'
        : 'Segna come letto';
  };

  const getButtonVariant = (action: ActionType) => {
    if (pendingAction === action && confirmationCount === 1) {
      return action === 'delete' ? 'destructive' : 'secondary';
    }
    return 'outline';
  };

  const disabledState = isLoading || totalEmails === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {/* Delete button */}
        <Button
          size="sm"
          variant={getButtonVariant('delete')}
          onClick={() => handleActionClick('delete')}
          disabled={disabledState}
          className="text-xs"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          {getButtonLabel('delete')}
        </Button>

        {/* Archive button */}
        <Button
          size="sm"
          variant={getButtonVariant('archive')}
          onClick={() => handleActionClick('archive')}
          disabled={disabledState}
          className="text-xs"
        >
          <Archive className="h-3.5 w-3.5 mr-1" />
          {getButtonLabel('archive')}
        </Button>

        {/* Mark as read button */}
        <Button
          size="sm"
          variant={getButtonVariant('mark-read')}
          onClick={() => handleActionClick('mark-read')}
          disabled={disabledState}
          className="text-xs"
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          {getButtonLabel('mark-read')}
        </Button>
      </div>

      {/* Progress bar */}
      {progress && isLoading && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-muted-foreground">
            Elaborazione {progress.current}/{progress.total}...
          </div>
          <Progress value={(progress.current / progress.total) * 100} className="h-1.5" />
        </div>
      )}

      {/* Email count info */}
      {totalEmails !== null && totalEmails > 0 && !isLoading && (
        <div className="text-xs text-muted-foreground">
          {totalEmails} email da questo mittente
        </div>
      )}

      {totalEmails === 0 && (
        <div className="text-xs text-muted-foreground">
          Nessuna email da questo mittente
        </div>
      )}
    </div>
  );
}
