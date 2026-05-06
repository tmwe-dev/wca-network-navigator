-- Funnemail "Lo prendo io" — claim system
CREATE TABLE IF NOT EXISTS public.funnemail_message_claims (
  message_id  text PRIMARY KEY,
  group_id    uuid,
  claimed_by  uuid NOT NULL,
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  user_id     uuid NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnemail_claims_active
  ON public.funnemail_message_claims (group_id)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_funnemail_claims_claimed_by
  ON public.funnemail_message_claims (claimed_by)
  WHERE released_at IS NULL;

ALTER TABLE public.funnemail_message_claims ENABLE ROW LEVEL SECURITY;

-- Visibilità globale (allineata a doctrine "Visibilità Globale Agenti")
CREATE POLICY "Authenticated can view all claims"
  ON public.funnemail_message_claims
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert: solo se claim_by = auth.uid()
CREATE POLICY "Users can insert own claim"
  ON public.funnemail_message_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (claimed_by = auth.uid());

-- Update: solo proprietario o admin
CREATE POLICY "Owner or admin can update claim"
  ON public.funnemail_message_claims
  FOR UPDATE
  TO authenticated
  USING (claimed_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (claimed_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Delete: solo admin (in pratica usiamo released_at; soft-delete trigger globale comunque agisce)
CREATE POLICY "Admin can delete claim"
  ON public.funnemail_message_claims
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_funnemail_claims_updated_at
  BEFORE UPDATE ON public.funnemail_message_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Force claim (admin only): rilascia claim attivo e ne crea uno nuovo per l'admin
CREATE OR REPLACE FUNCTION public.force_claim_message(
  p_message_id text,
  p_group_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  INSERT INTO public.funnemail_message_claims (message_id, group_id, claimed_by, user_id, claimed_at, released_at)
  VALUES (p_message_id, p_group_id, v_uid, v_uid, now(), NULL)
  ON CONFLICT (message_id) DO UPDATE
    SET claimed_by = EXCLUDED.claimed_by,
        group_id = COALESCE(EXCLUDED.group_id, public.funnemail_message_claims.group_id),
        user_id = EXCLUDED.user_id,
        claimed_at = now(),
        released_at = NULL,
        updated_at = now();
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.funnemail_message_claims;