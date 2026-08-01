# Triage v1/v2 — Fase 2 campagna 90K

Generato dal batch **FASE 2** della campagna autonoma (base `b215c791c8d9c40da8dedf2b2abf54fce92d3862`).
Metodo: rigenerazione dei candidati per collisione di basename (`scripts/find-v1-v2-duplicates.mjs`, non distruttiva) + conteggio dei referenti reali per ciascun file (import alias `@/...` e import relativi) su `src/`, `supabase/`, `e2e/`.

**Candidati attuali: 20** (erano 45 all'epoca di `COMPLEXITY_AUDIT.md`, poi 23 nell'audit manuale del 2026-07-19).
**Coppie byte-identiche: 0** → nessun duplicato reale eliminabile senza migrazione di consumer.

## Esito

**NO-GO sulle cancellazioni.** Nessuna delle coppie e' un duplicato: sono omonimie con contenuti, firme e ruoli diversi.
Ogni file v1 elencato ha consumer attivi; rimuoverlo richiede migrare i chiamanti, cioe' un lavoro per-dominio fuori dai limiti di un micro-batch reversibile.
Questa e' anche la lezione del batch V1 precedente (cancellazione di hook v2 orfani, poi annullata su richiesta utente): **non si cancella su base di conteggio import statico**.

## Tabella referenti (fatti misurati)

| Basename | File v1 | LOC | ref v1 | File v2 | LOC | ref v2 |
|---|---|---|---|---|---|---|
| `client.ts` | `src/integrations/supabase/client.ts` | 17 | 651 | `src/v2/io/edge/client.ts` | 146 | 503 |
| `partners.ts` | `src/data/partners.ts` | 727 | 56 | `src/v2/io/supabase/queries/partners.ts` | 159 | 49 |
| `tabs.tsx` | `src/components/ui/tabs.tsx` | 53 | 55 | `src/v2/ui/pages/cestinone/tabs.tsx` | 266 | 55 |
| `contacts.ts` | `src/data/contacts.ts` | 42 | 36 | `src/v2/io/supabase/queries/contacts.ts` | 79 | 27 |
| `contacts.ts` | `src/types/contacts.ts` | 9 | 27 | `src/v2/io/supabase/queries/contacts.ts` | 79 | 27 |
| `agents.ts` | `src/data/agents.ts` | 106 | 20 | `src/v2/io/supabase/queries/agents.ts` | 36 | 15 |
| `activities.ts` | `src/data/activities.ts` | 275 | 19 | `src/v2/io/supabase/queries/activities.ts` | 54 | 18 |
| `PageErrorBoundary.tsx` | `src/components/ui/PageErrorBoundary.tsx` | 60 | 12 | `src/v2/ui/atoms/PageErrorBoundary.tsx` | 44 | 12 |
| `fileParser.ts` | `src/lib/import/fileParser.ts` | 318 | 12 | `src/v2/ui/pages/prompt-lab/utils/fileParser.ts` | 172 | 11 |
| `DeepSearchCanvas.tsx` | `src/components/operations/DeepSearchCanvas.tsx` | 277 | 6 | `src/v2/ui/pages/email-forge/DeepSearchCanvas.tsx` | 296 | 6 |
| `EmptyState.tsx` | `src/components/shared/EmptyState.tsx` | 78 | 6 | `src/v2/ui/atoms/EmptyState.tsx` | 48 | 6 |
| `EmptyState.tsx` | `src/components/ui/EmptyState.tsx` | 39 | 6 | `src/v2/ui/atoms/EmptyState.tsx` | 48 | 6 |
| `prospects.ts` | `src/data/prospects.ts` | 34 | 6 | `src/v2/io/supabase/queries/prospects.ts` | 49 | 6 |
| `rateLimiter.ts` | `src/lib/api/rateLimiter.ts` | 233 | 6 | `src/v2/services/sherlock/rateLimiter.ts` | 94 | 4 |
| `ActiveFiltersBar.tsx` | `src/components/email-intelligence/manual-grouping/ActiveFiltersBar.tsx` | 117 | 5 | `src/v2/ui/molecules/ActiveFiltersBar/ActiveFiltersBar.tsx` | 91 | 5 |
| `useActiveFilterChips.ts` | `src/components/shared/entity-toolbar/useActiveFilterChips.ts` | 188 | 4 | `src/v2/hooks/companyList/useActiveFilterChips.ts` | 115 | 4 |
| `blacklist.ts` | `src/data/blacklist.ts` | 58 | 4 | `src/v2/ui/pages/command/tools/blacklist.ts` | 99 | 4 |
| `FunnemailTab.tsx` | `src/components/email-intelligence/FunnemailTab.tsx` | 349 | 2 | `src/v2/ui/pages/email-lab/FunnemailTab.tsx` | 60 | 1 |
| `kb.ts` | `src/constants/agentTemplates/kb.ts` | 220 | 2 | `src/v2/agent/runtime/tools/kb.ts` | 79 | 2 |
| `system.ts` | `src/lib/queryKeysParts/system.ts` | 101 | 1 | `src/v2/agent/runtime/prompts/system.ts` | 62 | 1 |

> I conteggi includono match su import relativi con lo stesso basename, quindi sono una **stima per eccesso**: vanno letti come 'esiste superficie di consumo', non come numero esatto di call site.

## Priorita' di consolidamento futuro (senza cancellazioni)

1. `src/data/partners.ts` (727 LOC, ~56 referenti) e `src/data/contacts.ts` — i DAL v1 sono superset di quelli v2; il percorso corretto e' **estendere il DAL** e migrare i consumer per dominio, come gia' fatto in P1.3A→G su `emailGrouping`.
2. `src/data/activities.ts` / `agents.ts` — stessa logica, superficie minore.
3. `EmptyState.tsx` / `PageErrorBoundary.tsx` — consolidabili solo dopo che l'atomo v2 copre l'API piu' ricca della variante v1.
4. `src/integrations/supabase/client.ts` — **auto-generato, intoccabile**; l'omonimia con `src/v2/io/edge/client.ts` non e' un duplicato.

## Regola operativa registrata

Un file v1 si rimuove **solo** quando: (a) 0 referenti verificati a mano, oppure (b) tutti i consumer sono stati migrati nello stesso batch, con test mirati verdi e suite completa invariata.
