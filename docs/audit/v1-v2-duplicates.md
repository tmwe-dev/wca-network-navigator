# V1/V2 Duplicati — Audit Manuale

Aggiornato 2026-07-19 dopo verifica file-per-file (diff + consumer count).

**Esito**: 0 file byte-identici. I 23 "candidati" originali erano collisioni di basename, non veri duplicati (contenuti, firme e ruoli diversi — es. `client.ts` Supabase vs edge client v2).

## Eliminati (0 consumatori verificati)

| File | Motivo |
|------|--------|
| `src/types/bridge.ts` | Zero import (`@/types/bridge` non referenziato). Tutti i consumer puntano a `@/v2/io/extensions/bridge`. |
| `src/components/agents/AgentDetail.tsx` | Zero import. Sostituito dal componente v2 `src/v2/ui/pages/prompt-lab/atlas/AgentDetail.tsx`. |

## Da mantenere (consumer attivi in v1 legacy — non toccare senza migrare i chiamanti)

| File v1 | Consumer count | Note |
|---------|----------------|------|
| `src/data/activities.ts` | 16 | DAL v1, superset del v2 (275 vs 54 LOC). Migrare gradualmente. |
| `src/data/agents.ts` | 10 | DAL v1 esteso. |
| `src/data/blacklist.ts` | 2 | DAL, il v2 è un tool Command con firma diversa. |
| `src/data/contacts.ts` | 28 | DAL v1 grosso. Alta priorità di consolidamento futuro. |
| `src/types/contacts.ts` | 1 | Solo `import type`. Piccolo, low ROI. |
| `src/data/partners.ts` | 46 | DAL 684 LOC vs 159 v2 — funzioni diverse, non sovrapposte. |
| `src/data/prospects.ts` | 4 | DAL v1. |
| `src/lib/errors.ts` | 2 | Legacy 9 LOC vs domain errors 167 LOC (semantica diversa). |
| `src/lib/import/fileParser.ts` | 3 | Parser generico legacy; v2 è prompt-lab specific. |
| `src/lib/api/rateLimiter.ts` | 4 | RateLimiter globale vs Sherlock-specific. |
| `src/lib/queryKeysParts/system.ts` | 1 (queryKeys.ts) | Solo omonimia: v2 è prompts/system, non query keys. |
| `src/constants/agentTemplates/kb.ts` | 1 (index barrel) | Costanti template, non tool KB. |
| `src/components/shared/EmptyState.tsx` | 3 | Variante v1 con illustrazioni, API più ricca del v2 atom. |
| `src/components/ui/EmptyState.tsx` | 1 | Wrapper shadcn-style. |
| `src/components/ui/PageErrorBoundary.tsx` | 12 | Boundary v1 usato ovunque. Non deprecare senza sostituzione atomica. |
| `src/components/ui/tabs.tsx` | 56 | Primitivo shadcn, non è duplicato del `cestinone/tabs.tsx` (pagina). |
| `src/components/operations/DeepSearchCanvas.tsx` | 6 | Canvas v1 (277 LOC) vs v2 email-forge (296 LOC), consumer diversi. |
| `src/components/email-intelligence/FunnemailTab.tsx` | 1 | Tab v1 legacy (348 LOC) vs wrapper v2 (59). |
| `src/components/email-intelligence/manual-grouping/ActiveFiltersBar.tsx` | 1 (ManualGroupingTab) | Locale della feature manual-grouping. |
| `src/components/shared/entity-toolbar/useActiveFilterChips.ts` | 1 | Hook v1 con logica specifica. |
| `src/integrations/supabase/client.ts` | (auto-gen) | Client SDK Supabase, NON toccare (auto-generato). |

## Conclusione

Il campo "23 duplicati" era fuorviante: **21 file sono legittimamente coesistenti** (feature ancora vive, semantiche diverse, o file auto-generati). Solo 2 sono stati eliminati con sicurezza. Ulteriori cleanup richiedono la migrazione dei consumer (attività per-dominio, non refactor di massa).

| File | V1 (legacy) | V2 (attuale) |
|------|-------------|--------------|
| `ActiveFiltersBar.tsx` | `src/components/email-intelligence/manual-grouping/ActiveFiltersBar.tsx` | `src/v2/ui/molecules/ActiveFiltersBar/ActiveFiltersBar.tsx` |
| `activities.ts` | `src/data/activities.ts` | `src/v2/io/supabase/queries/activities.ts` |
| `AgentDetail.tsx` | `src/components/agents/AgentDetail.tsx` | `src/v2/ui/pages/prompt-lab/atlas/AgentDetail.tsx` |
| `agents.ts` | `src/data/agents.ts` | `src/v2/io/supabase/queries/agents.ts` |
| `blacklist.ts` | `src/data/blacklist.ts` | `src/v2/ui/pages/command/tools/blacklist.ts` |
| `bridge.ts` | `src/types/bridge.ts` | `src/v2/io/extensions/bridge.ts` |
| `client.ts` | `src/integrations/supabase/client.ts` | `src/v2/io/edge/client.ts` |
| `contacts.ts` | `src/data/contacts.ts` | `src/v2/io/supabase/queries/contacts.ts` |
| `contacts.ts` | `src/types/contacts.ts` | `src/v2/io/supabase/queries/contacts.ts` |
| `DeepSearchCanvas.tsx` | `src/components/operations/DeepSearchCanvas.tsx` | `src/v2/ui/pages/email-forge/DeepSearchCanvas.tsx` |
| `EmptyState.tsx` | `src/components/shared/EmptyState.tsx` | `src/v2/ui/atoms/EmptyState.tsx` |
| `EmptyState.tsx` | `src/components/ui/EmptyState.tsx` | `src/v2/ui/atoms/EmptyState.tsx` |
| `errors.ts` | `src/lib/errors.ts` | `src/v2/core/domain/errors.ts` |
| `fileParser.ts` | `src/lib/import/fileParser.ts` | `src/v2/ui/pages/prompt-lab/utils/fileParser.ts` |
| `FunnemailTab.tsx` | `src/components/email-intelligence/FunnemailTab.tsx` | `src/v2/ui/pages/email-lab/FunnemailTab.tsx` |
| `kb.ts` | `src/constants/agentTemplates/kb.ts` | `src/v2/agent/runtime/tools/kb.ts` |
| `PageErrorBoundary.tsx` | `src/components/ui/PageErrorBoundary.tsx` | `src/v2/ui/atoms/PageErrorBoundary.tsx` |
| `partners.ts` | `src/data/partners.ts` | `src/v2/io/supabase/queries/partners.ts` |
| `prospects.ts` | `src/data/prospects.ts` | `src/v2/io/supabase/queries/prospects.ts` |
| `rateLimiter.ts` | `src/lib/api/rateLimiter.ts` | `src/v2/services/sherlock/rateLimiter.ts` |
| `system.ts` | `src/lib/queryKeysParts/system.ts` | `src/v2/agent/runtime/prompts/system.ts` |
| `tabs.tsx` | `src/components/ui/tabs.tsx` | `src/v2/ui/pages/cestinone/tabs.tsx` |
| `useActiveFilterChips.ts` | `src/components/shared/entity-toolbar/useActiveFilterChips.ts` | `src/v2/hooks/companyList/useActiveFilterChips.ts` |