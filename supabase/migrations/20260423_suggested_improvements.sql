-- ============================================================
-- suggested_improvements — Ciclo di apprendimento continuo
--
-- L'AI propone suggerimenti durante le interazioni.
-- L'admin li approva/rifiuta.
-- L'Architect li consuma in batch per migliorare KB e prompt.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.suggested_improvements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    uuid NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Contesto di origine
  source_context  text NOT NULL DEFAULT 'chat',
    -- 'chat' | 'email_edit' | 'feedback' | 'manual_correction' | 'voice_call' | 'classification_override'

  -- Tipo di suggerimento (determina il flusso di approvazione)
  suggestion_type text NOT NULL CHECK (suggestion_type IN ('kb_rule', 'prompt_adjustment', 'user_preference')),

  -- Contenuto
  title         text NOT NULL,
  content       text NOT NULL,
  reasoning     text,  -- Perché l'AI lo propone
  target_block_id text, -- Blocco Prompt Lab da modificare (opzionale)
  target_category text, -- Categoria KB target (opzionale, es. 'sales_doctrine')

  -- Priorità stimata dall'AI
  priority      text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Workflow di approvazione
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  reviewed_by   uuid REFERENCES auth.users(id),
  reviewed_at   timestamptz,
  review_note   text,  -- Nota admin (motivo rifiuto, modifica, etc.)

  -- Consumo da parte dell'Architect
  applied_at      timestamptz,
  applied_in_run_id uuid  -- Collegamento al run del Migliora tutto che lo ha usato
);

-- Indici per le query più frequenti
CREATE INDEX IF NOT EXISTS idx_suggested_improvements_status ON public.suggested_improvements(status);
CREATE INDEX IF NOT EXISTS idx_suggested_improvements_created_by ON public.suggested_improvements(created_by);
CREATE INDEX IF NOT EXISTS idx_suggested_improvements_type_status ON public.suggested_improvements(suggestion_type, status);

-- RLS
ALTER TABLE public.suggested_improvements ENABLE ROW LEVEL SECURITY;

-- Tutti gli utenti autenticati possono creare suggerimenti
CREATE POLICY "Users can create suggestions"
  ON public.suggested_improvements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Gli utenti vedono i propri suggerimenti
CREATE POLICY "Users can view own suggestions"
  ON public.suggested_improvements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- Gli admin vedono tutti i suggerimenti (check via app_settings o ruolo)
-- NOTA: in produzione filtrare per ruolo admin. Per ora USING(true) per il primo admin.
CREATE POLICY "Admin can view all suggestions"
  ON public.suggested_improvements
  FOR SELECT
  TO authenticated
  USING (true);

-- Gli admin possono aggiornare (approvare/rifiutare/marcare applied)
CREATE POLICY "Admin can update suggestions"
  ON public.suggested_improvements
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- user_preference: auto-approvate (skip admin review)
-- Gestito nel codice applicativo, non nel DB.

-- ============================================================
-- Vista comoda per la dashboard admin
-- ============================================================
CREATE OR REPLACE VIEW public.pending_suggestions AS
SELECT
  si.*,
  (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = si.created_by) AS creator_name
FROM public.suggested_improvements si
WHERE si.status = 'pending'
  AND si.suggestion_type IN ('kb_rule', 'prompt_adjustment')
ORDER BY
  CASE si.priority
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  si.created_at DESC;
