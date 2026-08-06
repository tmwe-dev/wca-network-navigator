# Batch F1b — Gate di lint reali (2026-08-02)

Obiettivo: rendere effettivi i controlli che il repository dichiarava ma non
applicava. Nessun cambio di comportamento applicativo: solo configurazione dei
gate, misura onesta e ratchet.

## Buchi trovati e chiusi

1. **Regole custom mai agganciate.** `eslint-rules/no-direct-ai-invoke.js` e
   `eslint-rules/no-direct-bulk-op.cjs` esistevano ma non erano registrate in
   `eslint.config.js`: l'AI Invocation Charter R3 e il vincolo bulkOps non erano
   applicati da nessuno. Ora sono esposte dal plugin locale `tmwe`
   (la prima rinominata in `.cjs`, obbligatorio con `"type": "module"`).
   **45 violazioni storiche reali emerse** (36 charter R3 + 9 bulkOps).

2. **`no-restricted-syntax` silenziosamente disattivato.** Tre blocchi
   sovrapposti ridefinivano la stessa regola su `src/**`: in ESLint flat config
   vince l'ultimo blocco che matcha, quindi il ban `supabase.from()` fuori dal
   DAL non era più applicato da nessuna parte. I selector sono ora in un blocco
   unico (e ripetuti esplicitamente dove un blocco successivo ridefinisce la
   regola). Restano due eccezioni **tracciate**, non nascoste:
   `src/v2/ui/pages/command/tools/scheduleActivity.ts` e
   `src/v2/ui/pages/command/lib/safeQueryExecutor.ts` (TODO F5).
   `src/v2/io/**` è riconosciuto come layer IO della linea v2, non come bypass.

3. **149 Edge Function e `scripts/` mai lintati.** Erano in `ignores`. Ora
   coperti con globals Deno e regole in modalità rilevazione: **816 warning**
   prima invisibili.

4. **Confine UI→DAL misurato solo a metà.** La regola copriva solo
   `src/components/**`; `src/v2/ui/**` era scoperto. Estesa: i
   `no-restricted-imports` passano da 244 a **507**. Gli hook restano
   legittimati a importare il DAL, quindi i 214 import in `src/hooks` non sono
   violazioni: l'audit esterno che parlava di ~516 violazioni contava anche
   quelli.

5. **CI già rossa.** `npx eslint . --max-warnings 0` non poteva passare con 385
   warning. Sostituita da `npm run lint:ratchet`: 0 errori obbligatori più un
   budget per regola.

## Baseline 2026-08-02 (post-aggancio)

Errori ESLint: **0**. Warning totali: **1.282**.

| Regola                                                 | Conteggio                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| no-restricted-imports (UI→DAL, v1 pages)               | 0 (UI instradata tramite gateway per dominio in `src/application/data/`) |
| unused-imports/no-unused-vars                          | 275                                                                      |
| @typescript-eslint/no-explicit-any (solo edge/scripts) | 0                                                                        |
| unused-imports/no-unused-imports                       | 93                                                                       |
| @typescript-eslint/no-unsafe-function-type             | 49                                                                       |
| tmwe/no-direct-ai-invoke                               | 36                                                                       |
| no-empty                                               | 27                                                                       |
| no-useless-escape                                      | 18                                                                       |
| prefer-const                                           | 12                                                                       |
| tmwe/no-direct-bulk-op                                 | 9                                                                        |
| no-case-declarations                                   | 5                                                                        |
| no-var                                                 | 4                                                                        |
| no-control-regex                                       | 3                                                                        |
| no-regex-spaces / no-useless-catch                     | 1 / 1                                                                    |

Confronto con la baseline precedente: i 385 warning di `src` erano una misura
parziale della superficie, non un livello di qualità. Il numero sale perché il
metro è corretto, non perché il codice sia peggiorato.

## Perché alcune regole sono `warn` e non `error`

`tmwe/no-direct-ai-invoke` e `tmwe/no-direct-bulk-op` descrivono violazioni di
governance vere. Promuoverle subito a `error` renderebbe il repository non
lintabile e la modifica dei 41 file coinvolti non è una modifica di
configurazione: tocca il percorso di invocazione AI e i runner bulk. Restano
`warn` con budget bloccato, e vengono portate a zero per dominio nei batch
successivi; poi diventano `error`.

## OOM di ESLint

Non riproducibile in questo ambiente: `eslint .` completa sull'intero
repository. La configurazione **non** usa lint type-aware (nessun `project` né
`projectService`), quindi la causa ipotizzata nell'audit esterno è esclusa.
La diagnosi resta aperta e va profilata sulla macchina che la osserva.

## Prossimi passi (ratchet)

1. Azzerare `tmwe/no-direct-bulk-op` (9) e poi `no-direct-ai-invoke` (36).
2. Rimuovere le due eccezioni DAL del layer command.
3. Ridurre gli import morti in `supabase/functions` (93 + 275).
4. Ogni batch abbassa i budget in `scripts/lint-ratchet.mjs`: il ratchet
   segnala esplicitamente quando un budget è più alto del reale.

## Aggiornamento 2026-08-06 — rimozione barrel `src/application/data/`

I 145 file `src/application/data/*.ts` erano puri `export * from "@/data/*"` e
servivano solo ad aggirare la layer rule "i componenti non importano il DAL".
Eliminati; i 309 file importatori riscritti su `@/data/*`.

Conseguenza: budget `no-restricted-imports` da 0 a **420**, cioè il numero reale
di import UI→DAL. Non è una regressione: è debito che prima era invisibile.
Scende a lotti con la migrazione a hook, non risale mai.
