

# Piano: Backup Completo + Integrazione WCA Repository

## Fase 1: Backup Completo (data e ora nel nome)

Creare un backup completo salvato in `/mnt/documents/` con timestamp.

### Database — Export di tutte le 48 tabelle

Script che esporta ogni tabella pubblica in JSON:
- `backup_2026-03-24_03h00/db/partners.json` (1585 record)
- `backup_2026-03-24_03h00/db/partner_contacts.json` (2139)
- `backup_2026-03-24_03h00/db/partner_networks.json` (5991)
- `backup_2026-03-24_03h00/db/partner_services.json` (4360)
- `backup_2026-03-24_03h00/db/partner_certifications.json` (254)
- `backup_2026-03-24_03h00/db/partner_social_links.json` (1331)
- `backup_2026-03-24_03h00/db/imported_contacts.json` (11462)
- `backup_2026-03-24_03h00/db/blacklist_entries.json` (328)
- `backup_2026-03-24_03h00/db/agents.json` (11)
- `backup_2026-03-24_03h00/db/app_settings.json` (48)
- ... tutte le altre tabelle

### Codebase — Copia di tutti i file sorgente

- `backup_2026-03-24_03h00/code/` — copia completa di `src/`, `supabase/functions/`, `public/`, config files
- Include tutti i componenti, hooks, pagine, edge functions, estensioni

### Schema DB

- `backup_2026-03-24_03h00/schema.sql` — dump della struttura (CREATE TABLE, RLS policies, triggers, functions)

---

## Fase 2: Integrazione WCA Repository (dopo backup)

Come da piano approvato precedentemente:

| File | Azione |
|------|--------|
| `supabase/functions/scrape-wca-directory/index.ts` | Integrare `ssoLogin()` + `extractMembersFromHtml()` dal repo, Firecrawl come fallback |
| `supabase/functions/scrape-wca-partners/index.ts` | Integrare `ssoLogin()` + `extractProfile()` + `fetchProfile()` dal repo |
| `src/hooks/useDownloadEngine.ts` | Sostituire extension bridge con `supabase.functions.invoke("scrape-wca-partners")` |

Cheerio importato via `https://esm.sh/cheerio@1.0.0` nelle edge function Deno.

