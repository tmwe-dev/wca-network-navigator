-- ============================================================
-- FASE 1: BACKUP COMPLETO (loss-less)
-- ============================================================
-- Snapshot 1:1 delle tre tabelle business prima della deduplica.
-- Le tabelle restano permanentemente nel DB finché l'utente non
-- conferma che la pulizia è andata a buon fine.

CREATE TABLE IF NOT EXISTS public._backup_partners_2026_05_01 AS
  SELECT * FROM public.partners;

CREATE TABLE IF NOT EXISTS public._backup_partner_contacts_2026_05_01 AS
  SELECT * FROM public.partner_contacts;

CREATE TABLE IF NOT EXISTS public._backup_imported_contacts_2026_05_01 AS
  SELECT * FROM public.imported_contacts;

-- Indici per consentire ripristini selettivi rapidi
CREATE INDEX IF NOT EXISTS idx_bk_partners_id ON public._backup_partners_2026_05_01(id);
CREATE INDEX IF NOT EXISTS idx_bk_partner_contacts_id ON public._backup_partner_contacts_2026_05_01(id);
CREATE INDEX IF NOT EXISTS idx_bk_imported_contacts_id ON public._backup_imported_contacts_2026_05_01(id);

-- Blocca completamente l'accesso alle tabelle di backup (solo service_role)
ALTER TABLE public._backup_partners_2026_05_01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_partner_contacts_2026_05_01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_imported_contacts_2026_05_01 ENABLE ROW LEVEL SECURITY;

-- Nessuna policy = nessun accesso da anon/authenticated, solo service_role bypassa.

-- ============================================================
-- LOG DEI MERGE (audit completo, per ripristino selettivo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.duplicate_merge_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,             -- 'partner' | 'partner_contact' | 'imported_contact'
  canonical_id UUID NOT NULL,            -- record mantenuto
  duplicate_id UUID NOT NULL,            -- record soft-deleted
  merged_fields JSONB,                   -- campi copiati dal duplicato al canonico
  reassigned_relations JSONB,            -- conteggi righe spostate per tabella collegata
  batch_id TEXT NOT NULL,                -- 'cleanup_2026_05_01_partners_batch_001' ecc.
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dml_canonical ON public.duplicate_merge_log(canonical_id);
CREATE INDEX IF NOT EXISTS idx_dml_duplicate ON public.duplicate_merge_log(duplicate_id);
CREATE INDEX IF NOT EXISTS idx_dml_batch ON public.duplicate_merge_log(batch_id);

ALTER TABLE public.duplicate_merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read merge log"
  ON public.duplicate_merge_log FOR SELECT
  TO authenticated USING (true);

-- ============================================================
-- VERIFICA POST-BACKUP
-- ============================================================
DO $$
DECLARE
  c1 INT; c2 INT; c3 INT;
  c1b INT; c2b INT; c3b INT;
BEGIN
  SELECT COUNT(*) INTO c1 FROM public.partners;
  SELECT COUNT(*) INTO c2 FROM public.partner_contacts;
  SELECT COUNT(*) INTO c3 FROM public.imported_contacts;
  SELECT COUNT(*) INTO c1b FROM public._backup_partners_2026_05_01;
  SELECT COUNT(*) INTO c2b FROM public._backup_partner_contacts_2026_05_01;
  SELECT COUNT(*) INTO c3b FROM public._backup_imported_contacts_2026_05_01;
  IF c1 <> c1b OR c2 <> c2b OR c3 <> c3b THEN
    RAISE EXCEPTION 'Backup count mismatch: partners %/%, partner_contacts %/%, imported_contacts %/%',
      c1, c1b, c2, c2b, c3, c3b;
  END IF;
END $$;