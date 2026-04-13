

# Plan: Prompt 90 — Refactor Monoliti + Qualità Codice

## Summary

Split 4 monolithic components (>500 LOC each) into orchestrator + sub-components, eliminate critical `any` types, add CSV export and lead score recalculation to CRM. TestExtensions is actively used — it gets split, not removed.

## Scope

| File | Current LOC | Target LOC | Action |
|------|------------|------------|--------|
| `Campaigns.tsx` | 578 | ~120 | Split into 5 sub-components + hook |
| `AIArena.tsx` | 529 | ~100 | Split into 5 sub-components + hook |
| `AuthenticatedLayout.tsx` | 575 | ~80 | Extract sidebar nav, header, content |
| `TestExtensions.tsx` | 647 | ~120 | Split (it's used in 3 routes) |

Plus: ~115 `any` types in `src/data/` and `src/hooks/` to fix, CSV export button, lead score recalculate button.

---

## Step-by-step

### 1. Split `Campaigns.tsx` (578 → ~120)
Create:
- `src/components/campaigns/CampaignHeader.tsx` — country picker, source toggle, search
- `src/components/campaigns/CampaignPartnerList.tsx` — partner selection list
- `src/components/campaigns/CampaignGoalDialog.tsx` — goal dialog
- `src/components/campaigns/CampaignStats.tsx` — top stats bar
- `src/components/campaigns/useCampaignData.ts` — all queries + state

### 2. Split `AIArena.tsx` (529 → ~100)
Create:
- `src/components/ai-arena/ArenaPreSession.tsx` — config (focus, channel, language, batch)
- `src/components/ai-arena/ArenaActiveSession.tsx` — active session (card, reasoning, draft)
- `src/components/ai-arena/ArenaPostSession.tsx` — summary view
- `src/components/ai-arena/ArenaSessionControls.tsx` — action buttons
- `src/components/ai-arena/useArenaSession.ts` — state machine hook

### 3. Split `AuthenticatedLayout.tsx` (575 → ~80)
Create:
- `src/v2/ui/templates/LayoutSidebarNav.tsx` — nav groups + items
- `src/v2/ui/templates/LayoutHeader.tsx` — header bar with status, operator, theme
- `src/v2/ui/templates/LayoutProviders.tsx` — provider wrapper
- `src/v2/ui/templates/useLayoutState.ts` — sidebar open/close, mobile detection

### 4. Split `TestExtensions.tsx` (647 → ~120)
It's used in 3 route files — split into sub-components, keep exports.

### 5. Eliminate `any` in critical files
Replace ~115 `any` usages across `src/data/*.ts` and `src/hooks/*.ts` with proper types from Supabase types or `unknown` with type guards. Priority on DAL modules and core hooks.

### 6. Add CRM Export CSV
Add "Export CSV" button to `ContactFiltersBar.tsx` that exports current filtered contacts.

### 7. Add Lead Score Recalculate
Add "Ricalcola Score" button in contact drawer that invokes `calculate-lead-scores` edge function via `invokeEdge`.

### 8. Verify
- 0 TypeScript errors
- No component in `src/` exceeds 400 LOC
- No `console.log` in `src/` (only `console.error` in catch)
- All existing functionality preserved

