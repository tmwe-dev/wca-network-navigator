/**
 * GlobalAIAutomationPause — LOVABLE-93: Global pause control for all AI automations.
 * Shows current pause status, timestamp, and reason.
 * Provides toggle with confirmation dialog.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertCircle, Pause, Play, Clock, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PauseState {
  isPaused: boolean;
  pausedAt: string | null;
  pauseReason: string | null;
}

export function GlobalAIAutomationPause() {
  const [pauseState, setPauseState] = useState<PauseState>({
    isPaused: false,
    pausedAt: null,
    pauseReason: null,
  });
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  // Load current pause state
  useEffect(() => {
    const loadPauseState = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data?.user?.id) return;
        setUserId(data.user.id);

        // Fetch pause settings
        const { data: settings, error } = await supabase
          .from('app_settings')
          .select('key, value')
          .eq('user_id', data.user.id)
          .in('key', ['ai_automations_paused', 'ai_automations_paused_at', 'ai_automations_paused_reason']);

        if (error) {
          console.error('Error loading pause state:', error);
          return;
        }

        const pausedSetting = settings?.find(s => s.key === 'ai_automations_paused');
        const atSetting = settings?.find(s => s.key === 'ai_automations_paused_at');
        const reasonSetting = settings?.find(s => s.key === 'ai_automations_paused_reason');

        setPauseState({
          isPaused: pausedSetting?.value === 'true',
          pausedAt: atSetting?.value || null,
          pauseReason: reasonSetting?.value || null,
        });
      } catch (error) {
        console.error('Error loading pause state:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPauseState();
  }, []);

  const handleTogglePause = async (newPausedState: boolean) => {
    if (newPausedState && !pauseState.isPaused) {
      setShowConfirm(true);
    } else {
      await confirmToggle(!newPausedState);
    }
  };

  const confirmToggle = async (isPausedValue: boolean) => {
    if (!userId) return;

    try {
      setLoading(true);

      // Upsert pause setting
      const updates = [
        supabase
          .from('app_settings')
          .upsert(
            { user_id: userId, key: 'ai_automations_paused', value: isPausedValue ? 'true' : 'false' },
            { onConflict: 'user_id,key' }
          ),
      ];

      if (isPausedValue) {
        updates.push(
          supabase
            .from('app_settings')
            .upsert(
              { user_id: userId, key: 'ai_automations_paused_at', value: new Date().toISOString() },
              { onConflict: 'user_id,key' }
            )
        );

        if (reason.trim()) {
          updates.push(
            supabase
              .from('app_settings')
              .upsert(
                { user_id: userId, key: 'ai_automations_paused_reason', value: reason },
                { onConflict: 'user_id,key' }
              )
          );
        }
      }

      const results = await Promise.all(updates);
      const hasError = results.some(r => r.error);

      if (hasError) {
        toast.error('Errore aggiornamento stato di pausa');
        return;
      }

      setPauseState({
        isPaused: isPausedValue,
        pausedAt: isPausedValue ? new Date().toISOString() : null,
        pauseReason: isPausedValue ? reason : null,
      });

      toast.success(
        isPausedValue
          ? 'Tutte le automazioni AI sono state sospese'
          : 'Tutte le automazioni AI sono state riprese'
      );

      setReason('');
      setShowConfirm(false);
    } catch (error) {
      console.error('Error toggling pause:', error);
      toast.error('Errore aggiornamento stato di pausa');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6 flex items-center justify-center h-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={`border-primary/20 bg-card/50 backdrop-blur-sm transition-all ${
          pauseState.isPaused
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-green-500/30 bg-green-500/5'
        }`}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {pauseState.isPaused ? (
                <Pause className="h-5 w-5 text-red-500" />
              ) : (
                <Play className="h-5 w-5 text-green-500" />
              )}
              <CardTitle>Controllo Globale Automazioni AI</CardTitle>
            </div>
            <Badge variant={pauseState.isPaused ? 'destructive' : 'default'}>
              {pauseState.isPaused ? 'SOSPESO' : 'ATTIVO'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Info Alert */}
          {pauseState.isPaused && (
            <div className="flex gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-medium text-sm text-red-700">
                  Tutte le automazioni AI sono sospese
                </p>
                {pauseState.pauseReason && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {pauseState.pauseReason}
                  </p>
                )}
                {pauseState.pausedAt && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Sospeso il {new Date(pauseState.pausedAt).toLocaleString('it-IT')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Toggle Section */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
            <div className="space-y-1">
              <p className="font-medium text-sm">
                {pauseState.isPaused ? 'Riprendi Automazioni' : 'Sospendi Automazioni'}
              </p>
              <p className="text-xs text-muted-foreground">
                Disabilita globalmente check-inbox, cadence-engine e pending-action-executor
              </p>
            </div>
            <Switch
              checked={pauseState.isPaused}
              onCheckedChange={handleTogglePause}
              disabled={loading}
            />
          </div>

          {/* Status Details */}
          {pauseState.isPaused && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-muted/50">
                <p className="text-muted-foreground">Stato</p>
                <p className="font-semibold text-red-600">Sospeso</p>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <p className="text-muted-foreground">Data</p>
                <p className="font-semibold">
                  {pauseState.pausedAt
                    ? new Date(pauseState.pausedAt).toLocaleDateString('it-IT')
                    : '—'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sospendi Tutte le Automazioni AI?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione disabiliterà globalmente:
              <ul className="mt-2 ml-4 space-y-1 text-sm list-disc">
                <li>check-inbox (classificazione email)</li>
                <li>cadence-engine (follow-up automatici)</li>
                <li>pending-action-executor (esecuzione azioni)</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Reason Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Motivo della sospensione (opzionale)
            </label>
            <textarea
              placeholder="Es: Manutenzione del sistema, testing, pausa temporanea..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 text-sm border rounded-lg border-border/50 bg-background placeholder:text-muted-foreground"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmToggle(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              Sospendi Automazioni
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
