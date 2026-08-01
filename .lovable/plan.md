# Revisione del programma di recovery — verdetto: ADOTTARE CON MODIFICHE

Nessun file modificato, nessuna SQL applicata, nessun deploy. Solo lettura e misura.

## 1. Cosa condivido

- **Freeze + baseline generata, non asserita** (Fase 0C): è la correzione più importante rispetto al passato, dove i punteggi erano dichiarati a mano.
- **`npm ci` come P0 assoluto**: confermato rotto. Senza install deterministico ogni altra metrica è aneddotica.
- **SQL correttiva resta non applicata** e schema live trattato come evidenza, non come licenza per fabbricare storia: corretto e non negoziabile.
- **Nessuna cancellazione senza prova di zero-caller**, barrel temporanei, test di caratterizzazione prima degli split: giusto.
- **Non creare 516 hook banali**: giusto, ma la premessa numerica è sbagliata (§4).
- **E2E autenticati come gate esterno**, skip non contati come eseguiti: corretto.

## 2. Cosa è sbagliato, incompleto o rischioso

**2.1 La diagnosi dell'OOM ESLint è infondata (Fase 1C).** `eslint.config.js` non configura alcun lint type-aware: nessun `project`, nessun `projectService`, nessun `parserOptions.project`. La causa ipotizzata ("scope typed-lint, parsing progetto duplicato") non può essere quella. In questo ambiente `npx eslint src` completa senza OOM. La fase va riscritta come *profilazione prima della diagnosi*, altrimenti si "ripara" una causa inesistente.

**2.2 Il rischio maggiore non è nei 385 warning, è nelle regole di governance morte.** `eslint-rules/no-direct-ai-invoke.js` e `eslint-rules/no-direct-bulk-op.cjs` esistono ma **non sono agganciate** a `eslint.config.js`: l'AI Invocation Charter R3 e il vincolo bulkOps non sono applicati da nessuno. Inoltre `supabase/functions/**` e `scripts/**` sono in `ignores`: **149 Edge Function non sono mai lintate**. Questo va davanti a qualsiasi cosmesi sui warning.

**2.3 "Rimuovere prima import inutilizzati e dichiarazioni morte" (Fase 2B) è pericoloso qui.** Dei 385 warning, 32 sono concentrati in `src/v2/routes.tsx` e sono tutti `unused-vars` su pagine lazy dichiarate e mai referenziate (CRMPage, CockpitPage, PromptLabPage, TokenCockpitPage…). Non è codice morto per default: è un possibile **buco di routing**. Cancellarle è la scorciatoia che rompe UX. Va trattata come indagine di copertura rotte, non come pulizia.

**2.4 Fase 4D è in contraddizione con le regole di esecuzione.** "Standardizzare le buste d'errore e aggiornare ogni consumatore nello stesso batch atomico" su 149 funzioni è esattamente il big-bang che le regole vietano. Serve envelope versionato + adapter di compatibilità, migrazione per dominio, rimozione dell'adapter alla fine.

**2.5 Fase 8 non è manutenzione, è riprogettazione di prodotto.** Consolidare store KB/memoria/prompt tocca il comportamento dell'AI, la governance e i dati. Dentro un programma che promette "zero cambi di comportamento" è incoerente. Va ridotta a *sola mappatura e definizione dei contratti*; ogni consolidamento diventa un programma separato con approvazione esplicita.

**2.6 Manca del tutto una fase sicurezza.** Il linter DB riporta 274 finding (2 ERROR security-definer view, 2 WARN search_path, molti INFO "RLS enabled no policy"). Mancano anche: revisione RLS delle tabelle senza policy, scansione dipendenze/segreti, e una strategia di rollback per le modifiche Edge.

**2.7 Target Fase 6 irrealistico.** `as unknown as ≤10` su 89 significa toccare contratti generati e librerie esterne: alta probabilità di cast spostati travestiti da progresso. Meglio: **100% classificati con motivazione**, e riduzione a ≤40 con parser reali e test.

**2.8 Fase 3C ha un vincolo operativo non dichiarato.** Uno snapshot canonico si produce normalmente con `pg_dump`, che qui non è disponibile né consentito. L'alternativa (introspezione read-only + generazione dello snapshot) va decisa prima, altrimenti la fase si blocca a metà.

## 3. Dipendenze e ordine che cambierei

1. Fase 0 → invariata.
2. Fase 1 (install deterministico) → invariata, **ma** 1C diventa "profila, poi decidi".
3. **Nuova Fase 1-bis (governance dei gate)**: aggancia le regole custom, estendi ESLint a `supabase/functions/**` e `scripts/**`, estendi la regola UI→DAL a `src/v2/ui/**`. Prima di ripulire i warning, il gate deve misurare la superficie reale.
4. Fase 2 → dopo 1-bis (altrimenti si azzera un numero che poi risale).
5. Fase 3 → dopo 1 (serve install deterministico per riprodurre).
6. **Nuova Fase Sicurezza** subito dopo 3, prima di 4.
7. Fase 4 → 4D riscritta con envelope versionato.
8. Fasi 5, 6, 7 → invariate.
9. Fase 8 → declassata a sola mappatura, spostata in coda.
10. Fase 9, 10 → invariate.

## 4. Findings: confermati e contestati

| Finding audit | Misura mia | Esito |
|---|---|---|
| ~4.300 file tracciati | 4.303 | confermato |
| 416 migrazioni | 416 | confermato |
| 149 Edge Function | 149 `index.ts` (150 dir con `_shared`) | confermato |
| 117 non dichiarate in config.toml | 32 dichiarate → 117 | confermato |
| 29 usano authGuard | **32** file | contestato (minore) |
| 39–42 inline `auth.getUser` | 42 file | confermato |
| `npm ci` rotto | 3 dipendenze dirette assenti dal lock: `@lovable.dev/mcp-js`, `eslint-plugin-unused-imports`, `isomorphic-dompurify` | confermato, con causa esatta |
| 385 warning | 385: 244 `no-restricted-imports` + 116 `unused-vars` + 25 `unused-imports`, su 233 file | confermato con breakdown |
| ~516 import UI→`@/data` | components 232 + v2/ui 266 = **498**; hooks 214 (leciti per architettura) | **contestato nell'inquadramento**: gli hook *devono* importare il DAL; la regola copre solo `src/components/**`, quindi v2/ui è scoperta. Superficie da sanare = 266, non 516 |
| 33 file >500 LOC | 24 in `src` (esclusi test); 31 includendo `supabase/functions`; il 33 include `types.ts` (13.979 LOC, **generato**) | contestato: il file generato va esentato |
| Metriche tipo | `as unknown as` 89, `as never` 22, `any` 6, `untypedFrom` 0, DAL bypass 0, `ts-ignore` 0 | confermato; `eslint-disable` **30**, non 29 |
| Vitest 394/3147/2/0 | identico su due run consecutivi | confermato |
| Ledger: 70 tabelle senza CREATE, 17 oggetti assenti dai tipi | identico | confermato |
| OOM lint a 2 GB | non riproducibile qui | non confermato — serve profilazione |
| CSS malformato / import misti | non verificato in questa revisione | da confermare in Fase 0 |

Nota aggiuntiva non presente nell'audit: **CI è già rossa** (`npx eslint . --max-warnings 0` in `.github/workflows/ci.yml`), quindi ogni merge oggi passa solo ignorando il gate.

## 5. Piano rivisto (sintesi)

F0 Freeze e baseline generata · F1 Install deterministico + profilazione lint · **F1b Gate veri: regole custom agganciate, Edge lintate, regola UI→DAL estesa a v2** · F2 Warning a zero con l'indagine routing separata · F3 Riproducibilità DB (decisione snapshot prima) · **F3b Sicurezza: RLS senza policy, view definer, dipendenze/segreti** · F4 Edge con envelope versionato e allowlist pubblica · F5 Confini architetturali · F6 Contratti di tipo classificati al 100% · F7 Decomposizione con test di caratterizzazione · F8 **solo mappa** KB/memoria/agenti · F9 Bundle e performance · F10 E2E autenticati.

## 6. Batch ed effort relativo

| Fase | Batch stimati | Effort | Rischio |
|---|---|---|---|
| F0 | 1 | basso | nullo |
| F1 | 2–3 | medio | basso |
| F1b | 2 | medio | **medio-alto** (fa emergere errori oggi nascosti) |
| F2 | 4–6 | medio | medio (routing) |
| F3 | 3–4 | alto | basso in dev, alto se applicata |
| F3b | 2–3 | medio | **alto** (RLS) |
| F4 | 8–12 | alto | **alto** |
| F5 | 6–10 | alto | medio |
| F6 | 5–8 | medio | basso |
| F7 | 8–12 | alto | medio-alto |
| F8 (mappa) | 2 | medio | basso |
| F9 | 3–4 | medio | basso |
| F10 | 2–3 | basso | esterno |

Totale ~50–70 batch. Le fasi 4, 7 e 3b assorbono la maggior parte del rischio.

## 7. Le cinque decisioni che richiedono l'approvazione di Luca

1. **Applicare o no le due migrazioni correttive pending** (2 ERROR view security-definer + 2 WARN search_path). Cambiano la valutazione RLS a runtime: chi legge quelle view deve avere policy sulle tabelle base. Oggi restano ferme.
2. **Ambiente disposable per la ricostruzione DB e per gli E2E autenticati**, con account seminati a privilegio minimo. Senza questo, F3D e F10 restano bloccate per sempre.
3. **Metodo dello snapshot canonico** (introspezione read-only vs strumento di dump esterno), dato che il dump completo non è disponibile su questa piattaforma.
4. **Gestione delle 32 pagine lazy non referenziate in `src/v2/routes.tsx`**: sono rotte da ripristinare o superfici da ritirare? È una decisione di prodotto, non tecnica.
5. **Perimetro della Fase 8**: confermare che KB/memoria/agenti resta *sola mappatura* in questo programma, e che qualsiasi consolidamento di store sarà un programma separato con approvazione dati.

## 8. Raccomandazione

**Adottare con modifiche.** L'impianto è solido e l'ordine P0 è giusto. Le modifiche indispensabili prima di eseguire: (a) F1C diventa profilazione, non fix presunto; (b) inserire F1b sui gate morti prima di ripulire i warning; (c) F4D con envelope versionato invece del batch atomico su 149 funzioni; (d) aggiungere la fase sicurezza; (e) F8 ridotta a mappa; (f) correggere i numeri di partenza (498/266 import, 24 file >500 LOC esclusi i generati, 32 authGuard, 30 eslint-disable), perché un programma che parte da baseline sbagliate produce report di miglioramento non verificabili.
