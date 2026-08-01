-- Allinea repo al DB live: il trigger e la funzione esistono già nel DB.
-- Questa migration è idempotente (CREATE OR REPLACE + DROP IF EXISTS).

CREATE OR REPLACE FUNCTION public.on_ai_pending_action_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    v_url := 'https://zrbditqddhjkutzjycgi.supabase.co';
    v_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4';

    PERFORM net.http_post(
      url := v_url || '/functions/v1/pending-action-executor',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object('action_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_pending_action_approved ON public.ai_pending_actions;

CREATE TRIGGER trg_ai_pending_action_approved
AFTER UPDATE ON public.ai_pending_actions
FOR EACH ROW
EXECUTE FUNCTION public.on_ai_pending_action_approved();