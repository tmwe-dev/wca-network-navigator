ALTER TABLE public.partner_contacts_backup_2026_05_02 ENABLE ROW LEVEL SECURITY;
-- Nessuna policy: la tabella è puramente un backup, non accessibile via API.
COMMENT ON TABLE public.partner_contacts_backup_2026_05_02 IS
  'Snapshot pre-dedup 2026-05-02 di partner_contacts. Solo recupero manuale via service_role.';