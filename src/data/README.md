# Data Access Layer (DAL)

## Regola fondamentale

**Tutte le query Supabase DEVONO passare dal DAL in `src/data/`.**

Le chiamate dirette `supabase.from()` fuori da `src/data/**` sono **vietate** e bloccano la CI tramite regola ESLint.

## Struttura

Ogni modulo DAL copre un dominio:

| Modulo | Tabella(e) |
|--------|-----------|
| `contacts.ts` | `imported_contacts`, `contact_interactions` |
| `partners.ts` | `partners` |
| `partnerRelations.ts` | `partner_contacts`, `partner_social_links` |
| `businessCards.ts` | `business_cards` |
| `prospects.ts` | `prospects`, `prospect_contacts` |
| `activities.ts` | `activities` |
| `importLogs.ts` | `import_logs` |
| `cockpitQueue.ts` | `cockpit_queue` |
| `credits.ts` | `user_credits`, `credit_transactions` |
| ... | (vedi `index.ts` per elenco completo) |

## Come aggiungere una nuova query

1. Individua il modulo DAL corretto in base alla tabella
2. Aggiungi la funzione `export async function ...`
3. Importala nel consumer: `import { myFunction } from "@/data/contacts"`
4. **Mai** importare `supabase` direttamente negli hooks/components

## Cache keys

Ogni modulo DAL esporta le proprie `queryKeys` e una funzione `invalidateXxxCache(qc)` per centralizzare l'invalidazione.
