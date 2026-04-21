-- LOVABLE-89/90: Decision Engine + Approval Flow
-- Aggiunge colonne necessarie per il flusso di approvazione con livelli di autonomia.

-- Nuove colonne per ai_pending_actions
ALTER TABLE ai_pending_actions ADD COLUMN IF NOT EXISTS autonomy_level text DEFAULT 'suggest';
ALTER TABLE ai_pending_actions ADD COLUMN IF NOT EXISTS execute_after timestamptz;
ALTER TABLE ai_pending_actions ADD COLUMN IF NOT EXISTS priority smallint DEFAULT 5;

-- Indice per azioni pronte all'esecuzione (approved + execute_after passato)
CREATE INDEX IF NOT EXISTS idx_pending_ready_execute
  ON ai_pending_actions(status, execute_after)
  WHERE status = 'approved' AND execute_after IS NOT NULL;

-- Indice per pulizia scadute
CREATE INDEX IF NOT EXISTS idx_pending_expires
  ON ai_pending_actions(status, expires_at)
  WHERE status = 'pending';

-- Commento: il setting 'decision_engine_autonomy' viene creato al primo uso
-- tramite evaluatePartner() con default 'prepare'.
