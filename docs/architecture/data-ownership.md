# Data Ownership & Source of Truth (Navigator come Data/Service Hub)

Documento di governance. Nessuna migrazione è stata eseguita: descrive lo stato attuale
misurato e la direzione target.

## 1. Principio

Navigator è un **hub**: aggrega e normalizza fonti, non le ingloba. Ogni entità canonica ha
una sola source of truth; tutto il resto è staging, read model o snapshot con provenienza.

## 2. Source of truth target

| Entità canonica             | Source of truth                                           | Ruolo delle altre rappresentazioni                                                         |
| --------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Company                     | WCA Network (esterno) + report azienda come arricchimento | `partners` diventa read model materializzato                                               |
| Partner                     | WCA Network                                               | Navigator referenzia via `external_ref`                                                    |
| Contact                     | Navigator (CRM)                                           | `imported_contacts`, `business_cards`, `linkedin_addresses`, `prospect_contacts` = staging |
| Relationship                | Navigator (CRM)                                           | —                                                                                          |
| Interaction / Communication | Funnemail per l'email, Navigator per gli altri canali     | `channel_messages` = read model unificato                                                  |
| Research / Enrichment       | Research Engine (servizio esterno)                        | Navigator conserva snapshot con `fetched_at`                                               |
| Opportunity / Task          | Navigator (CRM / Agent Framework)                         | —                                                                                          |

Regola: nessuna copia senza `source`, `source_id`, `fetched_at`, `confidence`.

## 3. Stato misurato (2026-08-09)

| Tabella           | Righe   |
| ----------------- | ------- |
| partners          | 12.286  |
| partner_contacts  | 137.342 |
| imported_contacts | 11.414  |
| business_cards    | 383     |
| prospects         | 10      |
| channel_messages  | 20.842  |
| activities        | 4.666   |
| interactions      | 9       |

Duplicazione di identità persona:

- `partner_contacts`: 26.452 email distinte, di cui **25.933 compaiono su più righe**.
- `imported_contacts`: 8.196 email distinte, **1.274 già presenti in `partner_contacts`**.
- `business_cards`, `prospects`, `linkedin_addresses` aggiungono rappresentazioni parziali.

Conclusione: almeno quattro rappresentazioni concorrenti di "Contact", senza colonna di
provenance o confidence che stabilisca quale prevale.

## 4. Aree di accoppiamento da sorvegliare

1. `supabase/functions/_shared/platformTools*` legge direttamente tabelle di domini diversi.
2. `partner_contacts` è letta da inbox, agenti, tool AI e CRM con matching divergenti.
3. Nessun outbox/event bus: le integrazioni sono chiamate sincrone funzione→funzione.
4. La deduplica è sparsa nel codice invece di essere un servizio di identity resolution.

## 5. Contratti di riferimento

- Tipi CDM: `src/modules/_contracts/canonical.ts`
- Event envelope: `src/modules/_contracts/events.ts`
- Interfaccia adapter: `src/modules/_contracts/sourceAdapter.ts`
- Job API / outbox: `docs/architecture/contracts/README.md`

## 6. Audit

- `node scripts/audit-identity-duplicates.mjs` — stampa le query di baseline sulla duplicazione.
- `node scripts/audit-module-boundaries.mjs` — contatori di accoppiamento, incluse le tabelle
  possedute lette fuori dal DAL.
