-- Tabella per registrare le proposte read-only dell'Harmonizer
-- (resolution_layer in 'contract' o 'code_policy') che richiedono
-- intervento dello sviluppatore e non vanno eseguite sul DB.
-- Sostituisce il vecchio "buco" dell'audit log dove si perdevano.

CREATE TABLE public.harmonizer_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL,
  proposal_id TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('contract', 'code_policy')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  block_name TEXT,
  missing_contracts JSONB NOT NULL DEFAULT '[]'::jsonb,
  code_policy_needed TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  impact_score INTEGER NOT NULL DEFAULT 5 CHECK (impact_score BETWEEN 1 AND 10),
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','wont_fix')),
  assigned_to UUID,
  resolution_notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_harmonizer_followups_run ON public.harmonizer_followups(run_id);
CREATE INDEX idx_harmonizer_followups_status ON public.harmonizer_followups(status) WHERE status IN ('open','in_progress');
CREATE INDEX idx_harmonizer_followups_layer ON public.harmonizer_followups(layer);

ALTER TABLE public.harmonizer_followups ENABLE ROW LEVEL SECURITY;

-- Policy: i follow-up sono SHARED tra tutti gli operatori (come la KB)
-- Lettura: qualunque utente autenticato
CREATE POLICY "Authenticated users can read followups"
  ON public.harmonizer_followups
  FOR SELECT
  TO authenticated
  USING (true);

-- Inserimento: qualunque utente autenticato (created_by deve essere se stesso)
CREATE POLICY "Authenticated users can create followups"
  ON public.harmonizer_followups
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Aggiornamento: solo admin oppure assignee
CREATE POLICY "Admins or assignees can update followups"
  ON public.harmonizer_followups
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR auth.uid() = assigned_to
    OR auth.uid() = created_by
  );

-- Delete: solo admin (soft delete preferito ma non strettamente imposto qui)
CREATE POLICY "Admins can delete followups"
  ON public.harmonizer_followups
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger updated_at
CREATE TRIGGER update_harmonizer_followups_updated_at
  BEFORE UPDATE ON public.harmonizer_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();