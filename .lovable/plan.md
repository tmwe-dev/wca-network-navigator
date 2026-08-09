# Addendum: Navigator come Data/Service Hub — Batch 2 (analisi + piano)

Solo analisi e pianificazione. Nessuna modifica a codice, DB, route, Edge Functions, RLS, dati o deployment.

## 1. Posizionamento target

Navigator NON ingloba tutto. Diventa **hub di dati e servizi**: entità canoniche, viste aggregate, UI/command center. Funnemail, WCA Network, Scraper, Research/Enrichment restano (o diventano) servizi esterni collegati via contratti. CRM resta modulo estraibile con API pubblica.

```text
 [Funnemail]  [WCA Network DB]  [Scraper]  [Research/Enrichment]  [Report Azienda]
      \             |               |                |                   /
       \____________|_______ Source Adapters / Connectors ______________/
                              |
                   Identity Resolution + Provenance
                              |
                    Canonical Data Model (CDM)
                              |
        Read Models / viste aggregate  ---- Event Bus (outbox) ---- Cobra
                              |
      Moduli interni: CRM | Sales | Email | Marketing | AI Platform | Agent | Dashboard
```

## 2. Stato attuale verificato (dati reali)

Volumi e uso attuale delle tabelle chiave:

| Tabella | Righe | Aree che vi accedono |
|---|---|---|
| partners | 12.286 | DAL, v2/io, tool AI, Edge `_shared` |
| partner_contacts | 137.342 | DAL, tool AI, check-inbox, agent-execute |
| imported_contacts | 11.414 | DAL contacts, v2/io, process managers |
| business_cards | 383 | DAL contacts, v2/io mutations |
| prospects | 10 | DAL, tool AI |
| channel_messages | 20.842 | comms |
| activities | 4.666 | CRM/agenda |
| interactions | 9 | quasi inutilizzata |

Duplicazione misurata su identità persona:
- 26.452 email distinte in `partner_contacts`, ma **25.933 email compaiono più volte** nella stessa tabella (dedup non applicata alla sorgente).
- 8.196 email distinte in `imported_contacts`, di cui **1.274 già presenti in partner_contacts** (stessa persona su due tabelle, ownership ambigua).
- `business_cards`, `prospects`, `linkedin_addresses` aggiungono ulteriori rappresentazioni parziali dello stesso contatto.

Conclusione: oggi esistono **almeno 4 rappresentazioni concorrenti di "Contact"** e nessuna colonna di provenance/confidence che dica quale vince.

## 3. Source of truth proposta (nessuna migrazione ora)

| Entità canonica | Source of truth | Ruolo delle altre |
|---|---|---|
| Company | WCA Network (esterno) per partner; report azienda come arricchimento | `partners` diventa read model materializzato |
| Partner | WCA Network | Navigator referenzia via `external_ref` |
| Contact | Navigator (CRM) | `imported_contacts`, `business_cards`, `linkedin_addresses` = **staging/sorgenti**, non verità |
| Relationship | Navigator (CRM) | — |
| Interaction / Communication | Funnemail per email; Navigator per il resto | `channel_messages` = read model unificato |
| Research / Enrichment | servizio Research esterno | Navigator conserva snapshot con provenance |
| Opportunity / Task | Navigator (CRM/Agent) | — |

Regola: ogni record importato deve portare `source`, `source_id`, `fetched_at`, `confidence`. Nessuna copia senza provenance.

## 4. Punti di accoppiamento più pericolosi

1. Edge `_shared/platformTools` e `platformToolHandlers` leggono direttamente 6+ tabelle di domini diversi: sono il vero monolite nascosto.
2. `partner_contacts` letta da inbox, agenti, tool AI e CRM con logiche di matching divergenti.
3. Nessun outbox/event bus: ogni integrazione è una chiamata sincrona funzione→funzione.
4. Dedup oggi implicita e sparsa, non un servizio.

## 5. Batch 2 proposto (prudente, solo additivo e read-only sul runtime)

Nessuna modifica a tabelle, RLS, route o comportamento.

1. **Contratti**: `docs/architecture/contracts/` — schemi JSON/TS *type-only* per Company, Contact, Partner, Relationship, Interaction, ResearchSnapshot, Opportunity/Task + `EventEnvelope` (id, type, occurred_at, source, subject_ref, payload, provenance).
2. **Registro sorgenti**: `docs/architecture/data-ownership.md` con la tabella §3, mappatura colonna→entità canonica e note di conflitto.
3. **Adapter skeleton (non collegato)**: cartella `src/modules/_contracts/` con soli tipi ed interfacce `SourceAdapter` (fetch, normalize, resolveIdentity) — zero import da parte del codice esistente.
4. **Audit dedup read-only**: script `scripts/audit-identity-duplicates.mjs` che riesegue le query di §2 e stampa la baseline (nessuna scrittura DB).
5. **Estensione boundary audit**: `scripts/audit-module-boundaries.mjs` misura anche gli accessi cross-module alle tabelle di §3 e ne fissa la baseline.

Fuori scope Batch 2: qualsiasi tabella nuova, backfill, dedup reale, estrazione di servizi, modifiche a Funnemail o WCA.

## 6. Rollback

Tutti i deliverable sono file nuovi (docs, script, tipi non importati): rollback = eliminazione dei file. Zero impatto runtime, zero migrazioni.

## 7. Criteri di completamento Batch 2

- typecheck 0 errori; lint ratchet invariato; bundle ratchet invariato (nessun codice nuovo nel bundle).
- 3154 test verdi.
- `git diff` non tocca `src/` esistente, `supabase/`, `.env`, route.
- Baseline duplicati e boundary registrate in `docs/audit/`.
