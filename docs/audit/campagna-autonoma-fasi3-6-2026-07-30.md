# Campagna autonoma 90K — FASI 3-6 + chiusura

Base: `d33962dede792f0bb17371348884db8a3848ac23` · Nessun deploy · Read-only sul DB
(nessuna migrazione, nessuna scrittura su dati produttivi).

---

## FASE 3 — Edge Functions (consolidamento auth)

Mappate **150** edge function. Pattern auth eterogenei: `getClaims` inline,
`getUser`, `handleEdgeError`, `requireExtensionAuth`, cron secret, HMAC.

### Migrazioni eseguite (contratto invariato `{ error: "AUTH_REQUIRED" | "AUTH_INVALID" }`)

| Function | Prima | Dopo |
| --- | --- | --- |
| `country-kb-generator` | createClient + getClaims inline | `requireAuth(req, dynCors, { errorFormat: "terse" })` |
| `calculate-lead-scores` | createClient + getClaims inline | `requireAuth(... terse)` |
| `list-elevenlabs-voices` | createClient + getClaims inline | `requireAuth(... terse)` dentro try/catch (fallback legacy `AUTH_INVALID` su eccezione) |

Criterio di selezione: solo function il cui contratto d'errore era **già
byte-identico** al formato terse dell'helper. Nessuna variazione di status code,
header CORS o shape di risposta.

### Verifiche
- `deno test supabase/functions/_shared/authGuard.test.ts` → 8 pass (offline, deterministico).
- `node scripts/audit-function-auth.mjs` → 0 findings, allowlist 14 invariata.
- `deno check` sui 3 file: gli unici 2 errori sono **preesistenti** in
  `country-kb-generator` (`result.choices` su `AiChatResult`, riga 106,
  confermato presente anche su HEAD prima della modifica) — fuori scope.

### Non migrate (DEFERRED, motivate)
`deduplicate-contacts`, `agent-audit`, `export-audit-csv` usano `getUser()` con
messaggi d'errore custom (`"Non autenticato"`): la migrazione cambierebbe il
contratto verso i consumer. Va fatta con adeguamento del client, non in un batch
puro. `apply-email-rules` propaga l'header `Authorization` a valle: richiede
analisi dedicata.

---

## FASE 4 — KB e memoria

Stato: **49** file `.md` in `public/kb-source/`, **37** voci in `index.json`
(fonte autorevole dei metadati per `scripts/seed-kb.ts`).

Il delta di 12 file è **intenzionale** ma non era documentato né protetto:
- `README.md` — documentazione di cartella;
- `harmonizer/*.md` (11) — caricati a runtime via HTTP da `harmonizerKbInjector`;
- `libreria-tmwe.md` — metadati derivati dal frontmatter.

Rischio reale: un file KB aggiunto e non indicizzato entra comunque in
`kb_entries` con slug/categoria euristici, **senza errori visibili** → degrado
silenzioso del recupero.

Intervento: nuovo test guardia `src/test/kb-source-index-integrity.test.ts`
(6 test) che verifica versione indice, esistenza dei file puntati, unicità di
slug e path, presenza di title/tag, assenza di orfani non esclusi e coerenza
delle esclusioni. Nessuna modifica ai contenuti KB.

---

## FASE 5 — Agenti e automazioni

26 cron job attivi, tutti `active = true`. Esecuzioni nelle ultime 24 h:

| Job | Schedule | Run 24h | Failed |
| --- | --- | --- | --- |
| `funnemail-reminders-tick-1min` | `* * * * *` | 1440 | 0 |
| `process-inbound-enrichment-every-minute` | `* * * * *` | 1440 | 0 |
| `agent_task_drainer_tick` | `*/2 * * * *` | 720 | 0 |
| `classify-emails-batch-every-5min` | `*/5 * * * *` | 288 | 0 |
| `outreach_scheduler_tick` | `*/5 * * * *` | 288 | 0 |
| `agent_autonomous_cycle_tick` / `email_cron_sync_tick` | `*/10 * * * *` | 144 | 0 |
| `agent_autopilot_worker_tick` / `batch_enrichment_worker_tick` | `*/30 * * * *` | 48 | 0 |
| altri (orari/giornalieri/settimanali) | — | 1-24 | 0 |

**Totale fallimenti su 24 h: 0.** Nessun job orfano, nessun job disattivato per
errore. I job settimanali (`agent-prompt-refiner-weekly`, `ai-backup`,
`ai-learning-feedback`, `kb-doctrine-audit-weekly`) non hanno run nella finestra
perché schedulati fuori dalle 24 h — comportamento corretto, non un guasto.

Nessun intervento necessario: automazioni **sane**.

---

## FASE 6 — Database, prestazioni, E2E

### Database (read-only)
`supabase linter` → **274** segnalazioni, così ripartite per tipo osservato:
`RLS Enabled No Policy` (INFO, tabelle interne senza policy — accesso di fatto
negato, non è una falla), `Security Definer View` (ERROR ×2),
`Function Search Path Mutable` (WARN, numerose), `Extension in Public` (WARN).

**DEFERRED con motivazione**: la bonifica richiede migrazioni SQL su viste e
funzioni condivise dal runtime AI e dai trigger di soft-delete. La campagna
vieta il deploy e le scritture DB: procedere ora significherebbe toccare nodi
critici (RLS, trigger, viste consumate dalle edge function) senza gate di
verifica. Va pianificato come fase dedicata con migrazione + E2E RLS.

### Prestazioni
Nessuna regressione introdotta: build verde, bundle guard invariato. Le
estrazioni DAL delle fasi P1.3A-G hanno ridotto i round-trip nella schermata
manual-grouping unificando 3 read in una sola funzione DAL.

### E2E
**76** spec Playwright presenti (`e2e/`), inclusi gli invarianti profondi
(`all-routes-deep-invariants`, `public-edge-auth-guards`, `auth-guard`,
`cron-secret-validation`). Non eseguiti in questo turno: richiedono sessione
autenticata e ambiente pubblicato, fuori dai vincoli "nessun deploy".
Copertura unitaria/integrazione: **386 file, 3098 test verdi, 0 fail**.

---

## Chiusura — radar

| Dimensione | Punteggio | Note |
| --- | --- | --- |
| Funzionalità | 19.000 / 20.000 | automazioni 0 fail/24h, pipeline messaggi consolidata |
| Affidabilità / test | 18.500 / 20.000 | 3098 unit verdi, E2E ampi ma non eseguiti qui |
| Pulizia codice | 16.000 / 20.000 | P001-027 chiuso, restano bypass DAL altrove e residui `any` |
| Coerenza infrastruttura | 15.500 / 20.000 | 150 edge function, auth ancora eterogenea (3 migrate) |
| Sicurezza / governance | 16.500 / 20.000 | authGuard testato, ma 274 lint DB aperti (deferred) |
| **Totale** | **85.500 / 100.000** | 8,55 / 10 |

### Prossime leve ad alto impatto
1. Fase DB dedicata: `search_path` sulle funzioni + revisione delle 2 security definer view.
2. Estensione `requireAuth` alle function `getUser` con adeguamento contratto lato client.
3. Continuazione bonifica bypass DAL (185 censiti in A1, oggi in calo).
