---
name: WCA Data Availability — Sync Esterno
description: I partner WCA arrivano già completi via sync esterno (profile_description, email, phone valorizzati ≥99%). AI non deve mai proporre bulk download
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

## Tool AI rimossi

- ❌ `create_download_job` — rimosso da `toolDefinitions.ts`, `agent-execute/toolDefs.ts`, capability set
- ✅ `download_single_partner` — preservato SOLO per <1% di record incompleti (uso eccezionale)

Handler legacy `create_download_job` resta in `agent-execute/toolHandlers.ts` per backward-compat ma non più esposto al modello.

## Doctrine KB

Entry `kb_entries`: titolo "WCA Data Availability — Sync Esterno", category `doctrine`, chapter `data-governance`, priority 10, tags: doctrine/wca/data-availability/sync/guardrail.

Iniettata come `criticalProcedures` nei prompt di: `luca`, `super-assistant`, `contacts-assistant`, `cockpit-assistant`.

## UI suggestions aggiornate

`src/components/intelliflow/overlay/useIntelliFlowOverlay.ts` rotta `/network`:
- ❌ Rimossi: "Scarica tutti i partner", "Aggiorna profili mancanti"
- ✅ Aggiunti: "Deep search USA", "Classifica per servizio", "Verifica email", "Genera alias"

## Cosa NON è cambiato

- WCAScraper, Download Center, useWcaJobs, sync-wca-partners → uso admin manuale, intatti
- Schema DB partners → campi legacy preservati per analytics storica
- Hard guards / auth → invariati
