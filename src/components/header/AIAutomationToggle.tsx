/**
 * AIAutomationToggle — Compact toggle for AI automations pause in header
 * Shows status indicator with green dot (active) or red dot (paused)
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AIAutomationToggleProps {
  className?: string;
}

export function AIAutomationToggle({ className }: AIAutomationToggleProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Load current pause state
  useEffect(() => {
    const loadPauseState = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data?.user?.id) return;
        setUserId(data.user.id);

        // Try user-scoped first, fallback to global (pre-migration schema)
        let settings = null;
        let error = null;
        const { data: userScoped, error: userErr } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'ai_automations_paused')
          .maybeSingle();
        settings = userScoped;
        error = userErr;

        if (error) {
          console.error('Error loading AI pause state:', error);
          return;
        }

        setIsPaused(settings?.value === 'true');
      } catch (error) {
        console.error('Error loading AI pause state:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPauseState();
  }, []);

  const handleToggle = async () => {
    if (!userId || loading) return;

    try {
      setLoading(true);
      const newPausedState = !isPaused;

      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'ai_automations_paused', value: newPausedState ? 'true' : 'false' },
          { onConflict: 'key' }
        );

      if (error) {
        toast.error('Errore aggiornamento stato AI');
        return;
      }

      setIsPaused(newPausedState);
      toast.success(
        newPausedState
          ? 'Automazioni AI sospese'
          : 'Automazioni AI riprese'
      );
    } catch (error) {
      console.error('Error toggling AI pause:', error);
      toast.error('Errore aggiornamento stato AI');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={cn(
            'h-7 px-2 flex items-center gap-1 rounded-lg transition-all text-[10px] font-semibold',
            isPaused
              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
              : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25',
            className
          )}
          aria-label={isPaused ? 'Riprendi automazioni AI' : 'Sospendi automazioni AI'}
        >
          {isPaused ? (
            <Pause className="w-3 h-3" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          <span>{isPaused ? 'AI off' : 'AI on'}</span>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            isPaused ? 'bg-red-500' : 'bg-emerald-500'
          )} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {isPaused
          ? 'Automazioni AI sospese — clicca per riprendere'
          : 'Automazioni AI attive — clicca per sospendere'}
      </TooltipContent>
    </Tooltip>
  );
}
