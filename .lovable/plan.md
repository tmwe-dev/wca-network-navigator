
# Rinforzo E2E — piano onesto

## Stato attuale (verificato)

- 39 spec in `e2e/` + 8 in `e2e/smoke/`.
- CI gira **solo** `e2e/smoke/` su push/PR (8 spec). Le altre 39 **non girano in CI**.
- `playwright.config.ts` ha `webServer` su `npm run preview` → ok per CI.
- Nessun report storico: ogni run sovrascrive `playwright-report/`.

Quindi il problema reale non è che mancano i test, è che **il 80% delle spec esistenti non viene mai eseguito** e nessuno sa quali siano effettivamente verdi oggi.

## Cosa propongo (3 fasi, ognuna utile da sola)

### Fase 1 — Inventario verità (1 giro, basso rischio)
1. Eseguo localmente tutte le 39 spec **una volta** e produco un report markdown:
   - quali passano, quali falliscono, quali sono flaky, quali hanno `test.skip`.
   - tempi di esecuzione, errori principali.
   - output in `docs/e2e/inventory-2026-05-03.md`.
2. Per ogni spec rotta: **una riga di diagnosi** (selettore obsoleto / route cambiata / dipendenza esterna / dato seed mancante). Non sistemo niente in questo giro.

Risultato: tu sai esattamente cosa hai, io so dove intervenire.

### Fase 2 — Riparazione mirata delle 6 spec critiche
Riparare quelle che coprono i flussi che si rompono di più (in base agli ultimi messaggi e alla criticità):
1. `crm-partner-flow.spec.ts` — CRUD partner (cuore del sistema).
2. `outreach-flow.spec.ts` + `outreach-holding-pattern.spec.ts` — generazione email batch (il bug "1 mail invece di 9").
3. `agent-chat-flow.spec.ts` — Command page / Direttore.
4. `email-inbound-to-task.spec.ts` — classify-email-response → escalation lead status.
5. `campaign-queue-lifecycle.spec.ts` — pipeline invio.
6. `direct-send-vs-queued-send-consistency.spec.ts` — consistency invio diretto vs coda.

Per ognuna: aggiorno selettori (`data-testid`), faccio passare almeno il "happy path", marco esplicitamente come `test.skip("flaky: <motivo>")` i sotto-step che richiedono setup non risolvibile ora.

**Vincolo**: nessuna modifica al codice dell'app eccetto aggiungere `data-testid` mancanti dove i selettori sono fragili. Niente refactor.

### Fase 3 — CI nightly + dashboard leggibile
1. Aggiungo workflow `.github/workflows/e2e-nightly.yml` che gira **tutte** le spec ogni notte (non su PR, troppo lento) e carica il report HTML come artifact.
2. Workflow on-PR resta solo `e2e/smoke/` (veloce).
3. Aggiungo pagina `/v2/settings/e2e-status` (sotto Development) che fa fetch dell'ultimo report da una location nota:
   - tabella spec → status (pass/fail/skip) → durata → ultimo run.
   - link al report HTML completo.
   - opzione 1: leggere via GitHub API (richiede token). Opzione 2: edge function che riceve i risultati in webhook a fine workflow e li salva in tabella `e2e_run_results`. **Preferisco opzione 2** (no dipendenze esterne dal frontend).

## Cosa NON faccio
- Non scrivo nuove spec da zero (prima sistemiamo le 39 esistenti).
- Non tocco il codice di produzione tranne aggiungere `data-testid` dove serve.
- Non prometto che tutte le 39 spec passeranno: alcune potrebbero essere obsolete e da archiviare.

## Domanda chiave prima di partire
Vuoi che faccia **subito tutta Fase 1** (inventario + diagnosi, senza riparazioni) così decidi tu quali 6 spec valgono lo sforzo della Fase 2? È la mossa più onesta: 1-2 ore di esecuzione, zero modifiche, e poi sai esattamente dove buttare il tempo.

In alternativa salto direttamente alla riparazione delle 6 spec che ho indicato sopra basandomi sulla criticità funzionale.
