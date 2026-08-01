## Obiettivo
Portare il punteggio ponderato reale da **73.500** a **95.000**, agendo sugli assi a peso alto oggi non presidiati. Nessun lavoro cosmetico sulle metriche: ogni batch cambia il codice e poi il contatore.

## Precondizione: rendere onesti i contatori (blocca tutto il resto)
Finché i contatori sono ciechi, ogni progresso è indimostrabile.
1. `src/test/arch-dal-guard.test.ts`: includere `untypedFrom(` nel conteggio bypass (oggi allowlistato via `src/lib/supabaseUntyped`). Il ratchet passerà da 0 a **60** — è il valore vero.
2. `scripts/ts-safety-metrics.mjs`: estendere `explicitAny` a `Record<[^>]*any`, `Array<any>`, `Promise<any>`, `: any` in posizione generica. Il contatore passerà da 11 a ~30.
3. `scripts/audit-function-auth.mjs`: aggiungere due metriche mancanti — funzioni con `auth.getUser()` inline (oggi 46) e funzioni prive di blocco `[functions.*]` in `config.toml` (oggi 118).

## BATCH A — untypedFrom reale a 0 (asse DAL 82k → 95k)
- Eliminare il codice morto `ra_*`: `src/hooks/useRAProspects.ts`, `src/hooks/useRAJobs.ts` puntano a 4 tabelle inesistenti nello schema (verificato su 216 tabelle). Rimuovere hook e call site, non "tipizzarli".
- Rimuovere `src/v2/io/extensions/_backup/2026-04-20-firescrape-v1/`.
- `src/v2/ui/pages/command/lib/safeQueryExecutor.ts:119`: sostituire `untypedFrom(plan.table)` con un dispatch su whitelist enumerata di tabelle → funzioni DAL tipizzate. È l'unico punto che consente all'LLM di interrogare tabelle arbitrarie.
- Migrare i restanti tool Command (`launchMission.ts`, `scrapeProspect.ts`) alle funzioni DAL già esistenti.

## BATCH B — contratti Edge (asse 68k → 92k, peso .10)
- Migrare le **46** funzioni con `auth.getUser()` inline a `_shared/authGuard`, in lotti da 8 con `deno check` per lotto.
- Dichiarare in `supabase/config.toml` tutte le **150** funzioni (oggi 32), con `verify_jwt` esplicito; le 14 pubbliche restano allowlistate e commentate.
- Uniformare le 4 funzioni con CORS letterale su `_shared/cors`.
- Censire i **134** usi di `SERVICE_ROLE` e ridurli dove la funzione opera per conto dell'utente autenticato.

## BATCH C — duplicazione v1/v2 (asse 62k → 88k, peso .10)
È l'asse più pesante e il meno toccato. Va deciso e chiuso, non campionato.
- Congelare la direzione: v2 è il target, `src/components/**` diventa libreria condivisa esplicita (rinominata `src/shared/**`) invece di residuo v1. Oggi `src/v2` importa 872 percorsi distinti da `@/components`.
- Eliminare `src/v2/ui/pages/command/_legacy/` (8 file, 1.089 LOC, nessun import attivo).
- Risolvere i 22 duplicati reali segnalati da `find-v1-v2-duplicates.mjs`, uno per commit.
- Consolidare Inbox/Funnemail: 150 componenti email + 54 file funnemail; scegliere una pipeline di lettura messaggi e ritirare l'altra.

## BATCH D — type safety onesta (asse 78k → 92k)
- Eliminare i 18 `Record<string, any>` di produzione, a partire da `src/components/cockpit/AIDraftStudio.tsx:480` (props intere non tipizzate) e `src/data/notifications.ts:29,50`.
- `as unknown as` 197 → sotto 80, concentrandosi su `src/data/**` dove indica disallineamento coi tipi generati.
- `as never` 87 → sotto 30.

## BATCH E — DB e sicurezza (asse 70k/74k → 90k)
- 2 ERROR `Security Definer View`: convertire a `security_invoker = true` o giustificare per iscritto.
- 9 tabelle con RLS abilitata e zero policy: aggiungere policy o dichiararle service-role-only con GRANT coerenti.
- 33 funzioni con `search_path` mutabile: aggiungere `SET search_path = public`.
- Ridurre i 274 issue del linter a soli INFO consapevoli.

## BATCH F — qualità test (asse 71k → 90k)
- Rapporto asserzioni/test oggi 1,75 con 378 `vi.mock`: sostituire i test che verificano la forma della catena mock con test sul comportamento del mapper e degli invarianti.
- Eliminare/rinforzare le 192 asserzioni `toBeDefined/toBeTruthy`.
- E2E: 367 spec skip-BLOCKED. Costruire un harness autenticato locale così che i percorsi protetti girino davvero; senza questo l'asse resta sotto 75k qualunque cosa accada.

## BATCH G — complessità reale (asse 72k → 88k)
Qui va invertita la tendenza: la campagna DAL ha aggiunto ~30k LOC (`src/data` 244 moduli / 26.822 LOC, `src/v2/io` 4.653 LOC) senza rimuovere i chiamanti originali.
- Consolidare i 36 moduli DAL KB/Memoria/Prompt/Agenti in ~10 moduli per dominio.
- Consolidare le 23 edge function `kb-*`/`agent-*`/`memory-*`/`prompt-*` dove condividono lo stesso ciclo.
- Spezzare i 5 file oltre 650 LOC (`partners.ts`, `channelMessages.ts`, `useCockpitLogic.ts`, `HarmonizeSystemDialog.tsx`, `LinkedInTest.tsx`).

## Ordine e criterio di accettazione
Precondizione → A → B → C → D → E → F → G. Ogni batch chiude con: typecheck verde, Vitest verde, contatore aggiornato **dopo** la correzione dei contatori, e delta di LOC dichiarato. Un batch che riduce un contatore senza ridurre LOC né chiamanti va segnalato come rilocazione, non come miglioramento.

## Nota tecnica
Il salto 73.500 → 95.000 dipende quasi interamente da C (duplicazione), B (edge) e F (E2E autenticato): insieme pesano .28 e sono oggi i tre assi più bassi. Senza di essi, anche portando a zero tutti i cast e gli untypedFrom il tetto raggiungibile resta intorno a 82.000.
