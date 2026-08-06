# Campagna finale "Supera 90.000" — TMWE Partner Connect

Base: `ba38a93079eb17e0e5bb085f2afce62f6dfd4429` · Nessun deploy · Nessuna migrazione
· Nessuna scrittura su dati produttivi · Schema/RLS/permessi invariati.

---

## 1 — Bonifica DAL multi-dominio

Censimento globale `supabase.from()` fuori da `src/data/**`.

| Momento         | Bypass                        |
| --------------- | ----------------------------- |
| Inizio campagna | **180**                       |
| Fine campagna   | **152**                       |
| **Rimossi**     | **28** (target ≥25 raggiunto) |

### Cluster migrati

| File runtime                                 | Bypass prima | Dopo | DAL di destinazione                                  |
| -------------------------------------------- | ------------ | ---- | ---------------------------------------------------- |
| `email-intelligence/RulesAndActionsTab.tsx`  | 14           | 0    | `emailAddressRules`, `emailPrompts`, `emailGrouping` |
| `email-intelligence/AddressRulesManager.tsx` | 5            | 0    | `emailAddressRules`                                  |
| `outreach/InUscitaTab.tsx`                   | 9            | 0    | `outreachPipeline.fetchOutreachSubCounts`            |
| `manual-grouping/useGroupAssignment.ts`      | 7            | 0    | `emailGrouping` (write path)                         |
| `ai-control/PendingActionsPanel.tsx`         | 7            | 0    | `aiPendingActions` (nuovo modulo)                    |
| `v2/.../settings/DataSettingsTab.tsx`        | 4            | 0    | `dataCounts` (nuovo modulo)                          |

### Invarianti preservati esplicitamente

- Query, colonne `select`, filtri, `order`, `limit`, paginazione: 1:1.
- Semantica errori conservata **anche dove era anomala**: gli update legacy
  `email_address_rules`/`email_prompts` **senza filtro `id`** in
  `RulesAndActionsTab` sono stati estratti come
  `updateAddressRuleUnfiltered` / `updateEmailPromptUnfiltered` con commento
  esplicito, invece di essere "corretti": correggerli avrebbe cambiato il
  comportamento commerciale in un batch di refactor. Va trattato come finding
  separato.
- Errori ignorati nel legacy restano ignorati (`ai_decision_log`, `kb_entries`,
  `email_sender_groups`); errori propagati restano propagati.
- Batching, `Promise.all`, ordine delle write, toast, invalidazioni di cache,
  auth e `operator_id` opzionale: invariati.
- Nessun `any`, `unknown as`, `untypedFrom` nuovo, nessun `ts-ignore`.

Nuovo test contract `src/test/dal-90k-extractions.test.ts` (6 test) sulle firme
estratte: un rollback accidentale del DAL rompe la suite, non la UI.

---

## 2 — Edge auth, secondo cluster

Mappate le funzioni con auth in-code non ancora su `_shared/authGuard`.

### Migrate (contratto byte-identico verificato)

| Function             | Prima                                                                            | Dopo                                                                  |
| -------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `wca-country-counts` | header check + `getClaims` inline, `{error:"AUTH_REQUIRED"\|"AUTH_INVALID"}` 401 | `requireAuth(req, dynCors, { errorFormat: "terse" })`                 |
| `email-imap-proxy`   | idem via `jsonResponse`, con fallback `catch → AUTH_INVALID`                     | `requireAuth(... terse)` dentro try/catch, fallback legacy preservato |

`deno check` prima/dopo: `wca-country-counts` 2 errori preesistenti → 2 (identici);
`email-imap-proxy` 3 → 3 (identici). Nessuna regressione introdotta.
`authGuard.test.ts` 8 pass. `audit-function-auth.mjs`: 0 findings, allowlist 14.

### Perché le residue NON sono sicure (misurato, non stimato)

Target di 8 funzioni **non raggiunto**: solo 2 hanno contratto equivalente.
Le altre 26 candidate si dividono in tre famiglie con contratto diverso:

| Famiglia                                     | Numero                                                                                                                                                                                                                 | Payload d'errore                                    | Perché blocca la migrazione                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `getUser()` + `INVALID_TOKEN`                | 6 (`apply-classification-insight`, `learn-from-group-correction`, `manage-email-folders`, `refine-classification-rule`, `suggest-email-groups`, `backfill-email-rules`)                                                | `{error:"INVALID_TOKEN"}`                           | `requireAuth` emette `AUTH_INVALID`: cambio di codice visibile ai consumer                                                               |
| `edgeError()`                                | 8 (`ai-assistant`, `check-inbox`, `check-inbox-booking`, `get-*-credentials`, `save-*`, `send-email`, `consume-credits`, `funnemail-send-autoresponder`, `save-correction-memory`)                                     | `{error: <message>, code}` e **AUTH_INVALID → 403** | shape del body diversa e status diverso (403 vs 401)                                                                                     |
| `{error:"Unauthorized"}` / `missing_auth`    | 10 (`email-sync-worker`, `ai-arena-suggest`, `generate-outreach`, `ai-monitor`, `memory-embed-backfill`, `simulate-funnemail-classify`, `review-message`, `kb-embed-backfill`, `improve-email`, `process-email-queue`) | stringa libera                                      | il client discrimina sul testo; migrare richiede adeguamento consumer                                                                    |
| solo header check, nessuna validazione token | 3 (`ai-utility`, `generate-content`, `unified-assistant`)                                                                                                                                                              | `{error:"AUTH_REQUIRED"}`                           | `requireAuth` **validerebbe anche il token**: è un irrobustimento, ma cambia il comportamento per token scaduti (oggi inoltrati a valle) |

L'ultima famiglia è un finding di sicurezza reale da trattare con un batch
dedicato + verifica sui consumer, non dentro un consolidamento "puro".

---

## 3 — Agenti/KB

Nessun wrapper realmente identico con tutti i caller migrabili nello stesso
checkpoint: gli adapter agenti differiscono su prompt, retry o precedence.
**DEFERRED** senza rimozioni: la campagna vieta i cambi di comportamento e una
rimozione parziale lascerebbe caller orfani.

## 4 — Prestazioni / bundle

Build verde. Bundle guard: **430 asset, 10.301 KB** (identico prima/dopo — nessun
modulo aggiunto al grafo, solo spostamento di codice da componenti a `src/data`).
Il superamento del limite dichiarato (3.500 KB) è **preesistente** e dominato da
`exceljs` (917 KB), `three-core` (651 KB), `xlsx` (419 KB), `charts` (412 KB).
Nessun lazy import applicato: le route pesanti sono già separate e ogni ulteriore
split toccherebbe la UX, vietata dalla campagna.

## 5 — E2E

Nessuna sessione autenticata disponibile in sandbox e nessun ambiente pubblicato
utilizzabile: le 76 spec Playwright restano non eseguibili in questo turno.
Residuo realmente bloccato: **autorizzazione a eseguire E2E autenticati su
ambiente pubblicato**.

## 6 — Database (read-only)

Nessuna migration. Le 274 segnalazioni del linter restano classificate come nella
FASE 6 precedente (`RLS Enabled No Policy` INFO, `Security Definer View` ERROR ×2,
`Function Search Path Mutable` WARN, `Extension in Public` WARN). Il piano
eseguibile per le 2 view security-definer e per i `search_path` richiede
migrazioni SQL: **vietato dalla campagna**, non conteggiato come fix.

---

## Gate finali

- `tsgo --noEmit` → 0 errori
- `eslint src` → **0 errori**, 241 warning (baseline invariata)
- `npm run build` → verde
- `vitest run` ×2 consecutive → **388 file, 3104 pass, 2 skip, 0 fail**
- `deno test _shared/authGuard.test.ts` → 8 pass
- `node scripts/audit-function-auth.mjs` → 0 findings
- `node scripts/bundle-size-guard.mjs` → invariato

---

## Radar (stessa formula del baseline 74.720 e dello score 85.500)

| Dimensione              | Prima      | Ora        | Note                                                             |
| ----------------------- | ---------- | ---------- | ---------------------------------------------------------------- |
| Funzionalità            | 19.000     | 19.000     | nessuna feature aggiunta o rimossa, comportamento invariato      |
| Affidabilità / test     | 18.500     | 18.700     | +6 test contract DAL, 3104 verdi ×2                              |
| Pulizia codice          | 16.000     | 17.200     | 28 bypass DAL rimossi (180→152), 2 moduli DAL nuovi tipizzati    |
| Coerenza infrastruttura | 15.500     | 15.900     | +2 edge function su `requireAuth`, famiglie residue quantificate |
| Sicurezza / governance  | 16.500     | 16.700     | auth guard esteso, anomalie legacy documentate anziché nascoste  |
| **Totale**              | **85.500** | **87.500** | 8,75 / 10                                                        |

## Perché NON dichiaro 90.000

Lo scoring resta sotto target e non modifico i pesi per raggiungerlo. I tre
residui che valgono il delta mancante sono **tutti bloccati dai divieti della
campagna**. Autorizzazione minima necessaria per ciascuno:

1. **Database (~1.500 punti)** — autorizzazione a eseguire migrazioni SQL per
   `search_path` sulle funzioni e revisione delle 2 security-definer view.
2. **Edge auth famiglie 1-3 (~1.000 punti)** — autorizzazione a modificare il
   contratto d'errore lato client (`INVALID_TOKEN`/`Unauthorized` → `AUTH_INVALID`),
   cioè a toccare i consumer nello stesso batch.
3. **E2E (~500 punti)** — autorizzazione a eseguire le spec autenticate su
   ambiente pubblicato (serve sessione utente valida).
