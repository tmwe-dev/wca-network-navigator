# Fascicolo di consegna (Fase 7) — Bonifica WCA Network Navigator

Data: 2026-09-02 · Protocollo Bonifica v1.0 · Registro: `.lovable/bonifica/`

## 1. Che cosa è stato guardato

- 2020 file sorgente (`src/`), 37 rotte UI v2, 66 voci di menu.
- 150 edge functions (`supabase/functions/`), cron DB, webhook e bridge estensioni.
- 416 migration (storia immutabile, fuori perimetro di taglio).
- Inventario completo: `inventario.md`, `edge-inventario.md`.

## 2. Con quale metodo

Tre lenti, mai una sola:
- **Lente 1 — raggiungibilità statica**: `scripts/bonifica/orfani.mjs` (grafo import reale dagli entry point, alias `@/`, import dinamici) e `scripts/bonifica/edge-orfani.mjs` (invoke / URL `/functions/v1/` / SQL).
- **Lente 2 — traffico reale**: `usage_events` (rotte + edge via `_shared/usageTrack.ts`), `edge_metrics`, `ai_prompt_log`, `ai_invocation_audit`, `system_loops`, log di piattaforma `function_edge_logs`, `cron.job`.
- **Lente 3 — intento storico**: README di modulo, memorie di progetto, contratti pubblici (bridge, webhook).

Regola applicata senza eccezioni: basta una lente "vivo" perché sia vivo; servono tre "morto" per tagliare.

## 3. Che cosa è stato tolto

Nessuna rimozione di comportamento. Solo **unificazioni** di duplicati esatti (stessa idea in due posti):

| Cluster | Operazione | Data |
| ------- | ---------- | ---- |
| A2 | `caCerts.ts` ×6 → `_shared/caCerts.ts` (6 import aggiornati) | 2026-09-02 |
| A3 | `bounceDetector.ts` ×2 → `_shared/bounceDetector.ts` | 2026-09-02 |
| A4 | `enqueueEnrichment.ts` ×2 → `_shared/enqueueEnrichment.ts` | 2026-09-02 |
| A7 | `mimeDecoder.ts` ×2 → `_shared/mimeDecoder.ts` | 2026-09-02 |

Unica differenza residua nei tre moduli A3/A4/A7: l'etichetta del logger, ora `inbox-shared`.

## 4. Che cosa è stato lasciato e perché

- **A1** `AuroraBorealis.tsx`: duplicazione intenzionale, `src/standalone-globe/` è pacchetto estraibile per contratto.
- **A5/A6** test gemelli: restano accanto alla funzione, unificarli riduce l'isolamento.
- **A8** e migration duplicate: storia DB applicata, immutabile.
- **Sezione E** (obbligatori invisibili): trigger soft-delete, `hardGuards`, prompt versionati, `authorized_users`, bridge estensioni.
- **4 edge WCA bridge** (`save-wca-cookie`, `save-wca-contacts`, `process-download-job`, `get-wca-credentials`): senza chiamanti nel repo ma backbone dell'estensione Chrome.

## 5. Che cosa resta in osservazione

- **Q1**: 20 componenti frontend non raggiunti dal grafo import — scadenza 2026-10-02 (`quarantena.md`).
- **Q2**: 61 edge functions senza chiamanti né traffico — scadenza 2026-10-02 (`edge-inventario.md`).
- Altri 316 candidati Lente 1 restano in inventario, non in quarantena.

## 6. Limiti dichiarati dell'analisi

- Solo 11 edge functions su 150 scrivono su `edge_metrics`; i log di piattaforma hanno ritenzione di poche ore → "nessun traffico" **non** prova la morte.
- **Bias kill-switch**: `system_flags.cron_paused = true` dal 2026-08-01 → zero esecuzioni cron in 30 giorni. Per le funzioni cron-only la Lente 2 è cieca. 10 candidati Q2 marcati come affetti.
- `usage_events` ha meno di un ciclo completo di osservazione.

## 7. Come si torna indietro

`rollback.md`: ripristino da git dei file unificati (contenuto identico, nessun cambio di logica) e redeploy delle edge toccate. Tempo misurato: ordine dei minuti, nessuna migration coinvolta.

## 8. Condizioni per il prossimo giro

1. Riattivare `cron_paused` (decisione operativa dell'utente: riattiva invii reali) e raccogliere **7 giorni consecutivi** di metriche.
2. Estendere `trackUsage` alle edge functions Q2 non ancora instrumentate.
3. Alla scadenza del 2026-10-02, revisione lotto per lotto: uscita dalla quarantena solo con prova positiva; rimozioni in commit di sola sottrazione, mai in blocco.

## Riproducibilità

```
node scripts/bonifica/snapshot.mjs
node scripts/bonifica/orfani.mjs
node scripts/bonifica/edge-orfani.mjs
```
