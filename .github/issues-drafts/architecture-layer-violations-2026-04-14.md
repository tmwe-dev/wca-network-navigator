# Issue: Resolve Architecture Layer Violations

**Created**: 2026-04-14
**Priority**: Medium
**Effort**: ~3-4 PRs

## Problem

107 component→DAL imports and 16 hook→component type imports violate the intended layered architecture.

## Batch Plan

### Batch 1: Extract shared types from components to `src/types/`
Files affected: 6 hooks importing types from components
- Move `CockpitAIAction`, `SourceTab`, `AssignmentInfo` → `src/types/cockpit.ts`
- Move `AICommand`, `SortKey` → `src/types/contacts.ts`
- Move `DeepSearchResult`, `DeepSearchCurrent` → `src/types/deep-search.ts`
- Move `QueueItem`, `CanvasData`, `CanvasPhase` → `src/types/acquisition.ts`
- Move `EditAnalysis`, `OracleConfig` → `src/types/email-composer.ts`
- Move `pickerReducer` types → `src/types/email-picker.ts`

### Batch 2: Wrap DAL calls in hooks for cockpit/contacts components
- `BulkActionMenu.tsx` → use existing `useActivities` hook
- `ContactActionMenu.tsx` → use existing hooks
- `BCACreateContact.tsx` → create `useBCAActions` hook
- `BusinessCardsHub.tsx` → use existing `useBusinessCards` hook

### Batch 3: Move static data out of `src/data/`
- `agentAvatars.ts` → `src/constants/agentAvatars.ts` (not a DAL file)
- `agentTemplates.ts` → `src/constants/agentTemplates.ts`
- `wcaCountries.ts` → `src/constants/wcaCountries.ts` (if pure static)
- `wcaFilters.ts` → `src/constants/wcaFilters.ts`
- `defaultContentPresets.ts` → `src/constants/`
- `defaultEmailTypes.ts` → `src/constants/`

### Batch 4: Remove `queryKeys` imports from `src/data/`
- Move invalidation logic from DAL to hooks layer
- DAL should only do CRUD, not cache management

## Acceptance Criteria
- ESLint `no-restricted-imports` rules promoted from `warn` to `error`
- Zero violations in CI
