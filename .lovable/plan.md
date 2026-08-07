# Piano: abbattere i contatori del debito (non aggiungere funzioni)

Obiettivo unico di questa fase: far scendere i numeri che le guardie già misurano, senza introdurre nuove feature e senza toccare business logic.

## Stato verificato adesso (non stimato)

- Edge contract audit su 149 funzioni: CORS 1, auth 95, error 132, logging 139 non conformi (baseline = misura attuale, CI verde ma debito intatto).
- `audit-prompt-sources.mjs`: il marcatore `@fallback-of` è testato sull'intero file (`MARKER.test(src)`), quindi un solo marcatore copre tutte le costanti del file. Rileva solo `const X_PROMPT = \`...\`` con backtick e nome contenente PROMPT/SYSTEM_MESSAGE/DOCTRINE/PERSONA/INSTRUCTIONS.
- `.env` è tracciato da Git (`git ls-files .env` lo trova) nonostante sia in `.gitignore`. Contiene solo chiavi pubblicabili.
- Accessi diretti al DB fuori dai layer consentiti: 21 occorrenze in 11 file (molto meno dei 185 dell'audit esterno, che è datato).
- `find-v1-v2-duplicates`: 22 coppie candidate (non 45).
- E2E bloccanti in CI: solo `e2e/smoke`; la suite completa è nightly.
- Esistono già i moduli condivisi (`_shared/authGuard.ts`, `cors.ts`, handler errori, structuredLogger): il lavoro è adozione, non creazione.

## Correzioni immediate (Fase 0)

1. Rimuovere `.env` dal tracking Git mantenendo il file locale, e assicurare la presenza di `.env.example` aggiornato.
2. `record-e2e-run`: rimuovere completamente la superficie CORS (server-to-server, protetta da `x-e2e-secret`), aggiungerla alla lista `NO_CORS_NEEDED` e portare il baseline CORS a 0.
3. Riscrivere `audit-prompt-sources.mjs`:
   - marcatore legato alla singola costante (commento nelle righe immediatamente precedenti la dichiarazione), non al file;
   - riconoscere anche stringhe con virgolette lunghe, array `.join()`, proprietà di oggetto (`systemPrompt:`, `instructions:`), e prompt costruiti per concatenazione;
   - ricalcolare il baseline reale dopo la correzione (salirà rispetto a 37: è il numero onesto) e documentarlo.

## Fase 1 — Edge Functions (ROI massimo)

Lotti da 8-10 funzioni, ordinati per esposizione (prima quelle chiamate dal browser e quelle che toccano dati partner/email).

Per ogni funzione, solo il perimetro di contratto:
- auth: adottare `authGuard` / `internalAuth` / `cronGuard` condiviso; se la funzione è pubblica per design, marcarla con un commento `@public-by-design <motivo>` e registrarla in una allow-list dell'audit;
- CORS: header condivisi + preflight;
- validazione input (schema) dove manca;
- errori: `handleEdgeError`;
- logging: `structuredLogger` al posto di `console.*`.

Nessun cambio di firma, payload o comportamento. Dopo ogni lotto: abbassare il baseline, eseguire typecheck + test + audit.

Traguardi: auth 95 → 0 reali (solo casi `@public-by-design` documentati), error 132 → 0, logging 139 → 0.

## Fase 2 — Prompt

Dopo la correzione dello script: portare i prompt non dichiarati a 0 a scaglioni. Per ogni prompt, una sola scelta esplicita: caricato dal DB, oppure fallback dichiarato con riferimento alla riga DB corrispondente. Nessun prompt "orfano".

## Fase 3 — DAL

21 accessi diretti in 11 file: chiuderli tutti spostando le query nel data layer, oppure documentando l'eccezione nella regola ESLint con motivazione. Obiettivo: budget import DAL invariato o in calo e 0 bypass non documentati.

## Fase 4 — V1/V2

Per ognuna delle 22 coppie, decisione registrata in `docs/audit/`: KEEP V1 / KEEP V2 / WRAPPER documentato / DELETE. Nessuna coppia resta "da capire". Le eliminazioni seguono la stessa doppia prova già usata nel cleanup orfani.

## Fase 5 — Tipi ai confini

Ridurre `any` solo dove i contratti contano: risultati edge, entità di dominio, payload DB, tool call degli agenti, memoria/KB, email, operazioni bulk. Nessun intervento sui componenti puramente visivi. Il budget `any` scende a ratchet a ogni lotto.

## Fase 6 — E2E bloccanti

Promuovere da nightly a CI bloccante un set core: login, ricerca partner, dettaglio partner, query AI, email, campagna, modifica dati, automazione critica. Solo spec già esistenti e stabili, per non rendere la CI intermittente.

## Note tecniche

- Ogni fase termina con: `typecheck`, `lint-ratchet`, `format:check`, suite vitest, build + bundle guard, `audit:edge-contract`, `audit:prompt-sources`, con baseline aggiornati verso il basso nello stesso commit del lavoro.
- Il ratchet non viene mai alzato: se un lotto non riesce, si riduce l'ambito del lotto.
- Nessuna nuova Edge Function, nessuna nuova pagina, nessun refactor opportunistico.
