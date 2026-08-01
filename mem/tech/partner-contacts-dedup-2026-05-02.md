---
name: Partner Contacts Dedup 2026-05-02
description: Cleanup massivo duplicati partner_contacts (107k→29k) + UNIQUE index e backup
type: feature
---
- 2026-05-02: bonifica `partner_contacts` da 136.958 → **29.826 righe attive** (107.132 soft-deleted). Esempio fix: Radiant Global Logistics aveva 4× lo stesso "Randy Emmons", ora 1.
- Backup completo in `partner_contacts_backup_2026_05_02` (RLS on, no policy → solo service_role).
- Vincolo: `CREATE UNIQUE INDEX partner_contacts_dedup_uniq ON partner_contacts (partner_id, lower(coalesce(email,'')), lower(coalesce(name,''))) WHERE deleted_at IS NULL;` — previene futuri duplicati.
- Criterio merge: winner = `MIN(created_at)`, copia coalesce dei campi (title, direct_phone, mobile, contact_alias, is_primary OR-aggregato) dai loser.
- **TODO follow-up**: gli inserter di `partner_contacts` (sync WCA / scraper) DEVONO usare `INSERT ... ON CONFLICT (partner_id, lower(email), lower(name)) WHERE deleted_at IS NULL DO UPDATE` — altrimenti il UNIQUE index farà fallire le insert.
- Soft-delete enforced dal trigger globale `no-physical-delete`.
