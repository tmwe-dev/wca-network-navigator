---
name: WCA Data Availability — Dati Locali
description: Partner, profili, contatti e biglietti da visita WCA sono già locali. AI non deve mai proporre download/scansioni/accesso directory WCA.
type: feature
---

## Stato dati WCA (≥99% dei record)

| Campo | Stato |
|---|---|
| `profile_description` | ✅ Valorizzato (sorgente di verità) |
| `email`, `phone`, `address`, `website` | ✅ Valorizzati |
| `raw_profile_html` | ❌ Vuoto (legacy scraper dismesso) |
| `raw_profile_markdown` | ❌ Vuoto (legacy) |
| `ai_parsed_at` | ❌ Vuoto (legacy) |

## Sorgente di verità

`has_profile === !!profile_description` — **NON** `raw_profile_html`.

Implementato in:
- `public.get_country_stats()` RPC (migration)
- `supabase/functions/_shared/toolHandlersRead.ts`
- `supabase/functions/_shared/platformTools.ts`
- `src/hooks/usePartnerListStats.ts`

## Tool AI vietati

- ❌ `create_download_job` — vietato
- ❌ `download_single_partner` — vietato
- ❌ `scan_directory` — vietato

Gli handler legacy, se chiamati da codice vecchio, devono rispondere con errore e non creare job. L'AI non ha accesso né potere operativo sulla directory WCA.

## Doctrine KB

Entry `kb_entries`: titolo "WCA Data Availability — Sync Esterno", category `doctrine`, chapter `data-governance`, priority 10, tags: doctrine/wca/data-availability/sync/guardrail.

Iniettata come `criticalProcedures` nei prompt di: `luca`, `super-assistant`, `contacts-assistant`, `cockpit-assistant`.

## UI suggestions aggiornate

`src/components/intelliflow/overlay/useIntelliFlowOverlay.ts` rotta `/network`:
- ❌ Rimossi: "Scarica tutti i partner", "Aggiorna profili mancanti", "Scarica da directory WCA"
- ✅ Aggiunti: "Deep search USA", "Classifica per servizio", "Verifica email", "Genera alias"

## Cosa NON è cambiato

- WCAScraper, Download Center, useWcaJobs, sync-wca-partners → uso tecnico/admin manuale, non proponibile dagli agenti AI
- Schema DB partners → campi legacy preservati per analytics storica
- Hard guards / auth → invariati
