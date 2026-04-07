# WCA Network Navigator — Improvement Plan

**Based on**: [Architecture Evaluation](./architecture-evaluation.md) (Score: 5.4/10)  
**Target Score**: 8.0/10  
**Approach**: Incremental phases, no breaking changes, each phase independently deployable  
**Date**: April 2026  

---

## Phase 1 — Type Safety & Error Handling (Score impact: 2/10 → 5/10, 4/10 → 7/10)

> Fix the two most dangerous weaknesses first. Every subsequent phase benefits from type safety.

### 1.1 Enable TypeScript Strict Mode (Incremental)

**Problem**: `strict: false`, `noImplicitAny: false`, `strictNullChecks: false` in tsconfig — the compiler catches almost nothing.

**Files to modify**:
- `tsconfig.json` (lines 4-5)
- `tsconfig.app.json` (lines 15, 23-24)

**Steps**:

1. **Week 1 — Enable `strictNullChecks`** (highest value, catches null/undefined bugs)
   ```json
   // tsconfig.app.json
   "strictNullChecks": true
   ```
   - Run `npx tsc --noEmit` and fix errors incrementally
   - Use `// @ts-expect-error` temporarily for files that need more work
   - Prioritize: hooks/ → lib/ → pages/ → components/

2. **Week 2 — Enable `noImplicitAny`**
   ```json
   "noImplicitAny": true
   ```
   - Replace `: any` with proper types, starting with the 57 most-affected files
   - Use `unknown` + type guards at system boundaries (API responses, Supabase data)
   - Create domain types in `src/types/` for core entities: Partner, Contact, Campaign, Job

3. **Week 3 — Enable `strict: true`** (enables all remaining strict checks)
   ```json
   "strict": true
   ```
   - This enables: strictBindCallApply, strictFunctionTypes, strictPropertyInitialization, noImplicitThis, alwaysStrict
   - Also enable: `"noUnusedLocals": true`, `"noUnusedParameters": true`

**Key types to create** (`src/types/`):
```
src/types/
├── partner.ts        # WcaPartner, PartnerProfile, PartnerContact
├── contact.ts        # Contact, ImportedContact, ContactEnrichment
├── campaign.ts       # Campaign, CampaignJob, EmailTemplate
├── download.ts       # DownloadJob, JobState, CircuitBreakerState
├── api.ts            # ApiResponse<T>, ApiError, PaginatedResponse<T>
└── filters.ts        # GlobalFilters, FilterAction (for useReducer)
```

### 1.2 Fix Empty Catch Blocks (47 occurrences across 25 files)

**Problem**: 47 `catch {}` blocks silently swallow errors — bugs become invisible.

**Files** (all 25):
| File | Count |
|------|-------|
| `src/hooks/useDownloadEngine.ts` | 5 |
| `src/components/layout/ConnectionStatusBar.tsx` | 5 |
| `src/hooks/useAutoConnect.ts` | 4 |
| `src/hooks/useAiAssistantChat.ts` | 4 |
| `src/components/system/RuntimeDiagnosticPanel.tsx` | 3 |
| `src/hooks/useDirectoryDownload.ts` | 2 |
| `src/hooks/useActionPanelLogic.ts` | 2 |
| `src/hooks/useDeepSearchLocal.ts` | 2 |
| `src/lib/api/wcaAppApi.ts` | 2 |
| `src/components/global/FiltersDrawer.tsx` | 2 |
| `src/pages/MissionBuilder.tsx` | 2 |
| Remaining 14 files | 1 each |

**Action**: Replace each `catch {}` with at minimum:
```typescript
catch (error) {
  console.warn("[ModuleName] operation failed:", error);
}
```

For user-facing operations, use toast:
```typescript
catch (error) {
  console.error("[ModuleName] operation failed:", error);
  toast.error("Description of what failed");
}
```

### 1.3 Add Feature-Level Error Boundaries

**Problem**: Only `GlobalErrorBoundary` exists — any component crash kills the entire app.

**Create**: `src/components/system/FeatureErrorBoundary.tsx`

```typescript
interface Props {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
```

**Wrap these page sections** (in `src/App.tsx` route definitions):
- Email Composer routes
- Download Engine / Operations
- Acquisition Pipeline
- CRM / Contacts
- Campaigns
- AI Lab / Agent Chat
- Mission Builder

---

## Phase 2 — Testing Foundation (Score impact: 2/10 → 6/10)

> React Testing Library is already installed. Vitest is configured. Just need tests.

### 2.1 Install Missing Dependencies

```bash
npm install -D @testing-library/user-event
```

### 2.2 Configure Coverage Reporting

**File**: `vitest.config.ts`
```typescript
test: {
  environment: "jsdom",
  globals: true,
  setupFiles: ["./src/test/setup.ts"],
  include: ["src/**/*.{test,spec}.{ts,tsx}"],
  coverage: {
    provider: "v8",
    reporter: ["text", "html", "lcov"],
    include: ["src/hooks/**", "src/lib/**", "src/components/**"],
    exclude: ["src/test/**", "src/integrations/supabase/types.ts"],
    thresholds: {
      statements: 40,
      branches: 30,
      functions: 40,
      lines: 40,
    },
  },
},
```

### 2.3 Write Tests for Critical Hooks (Priority Order)

Co-locate tests next to source files:

| Hook | Test File | What to Test |
|------|-----------|-------------|
| `useDownloadEngine` | `hooks/useDownloadEngine.test.ts` | Job lifecycle, circuit breaker transitions, error recovery, stop behavior |
| `useContacts` | `hooks/useContacts.test.ts` | CRUD operations, filter application, pagination, error states |
| `useEmailCampaignQueue` | `hooks/useEmailCampaignQueue.test.ts` | Queue processing, realtime updates, retry logic |
| `useCockpitLogic` | `hooks/useCockpitLogic.test.ts` | View mode switching, drag/drop state, filter application |
| `useAcquisitionPipeline` | `hooks/useAcquisitionPipeline.test.tsx` | Pipeline state machine, session health, network stats |
| `useAgents` | `hooks/useAgents.test.ts` | CRUD, agent template loading |
| `useLinkedInFlow` | `hooks/useLinkedInFlow.test.ts` | Search flow, enrichment states |
| `useImportLogs` | `hooks/useImportLogs.test.ts` | Import validation, log persistence |

**Testing pattern** (using renderHook from @testing-library/react):
```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })}>
    {children}
  </QueryClientProvider>
);
```

### 2.4 Write Tests for Utility Libraries

| Library | Test File | What to Test |
|---------|-----------|-------------|
| `lib/api/wcaAppApi.ts` | `lib/api/wcaAppApi.test.ts` | Endpoint calls, error responses, timeout handling |
| `lib/api/wcaScraper.ts` | `lib/api/wcaScraper.test.ts` | Scraping facade, retry behavior |
| `lib/localDirectory.ts` | `lib/localDirectory.test.ts` | Cache read/write, expiration |
| `lib/download/jobState.ts` | `lib/download/jobState.test.ts` | State transitions, persistence |
| `lib/download/extractProfile.ts` | `lib/download/extractProfile.test.ts` | Profile parsing, edge cases |
| `lib/wcaCheckpoint.ts` | `lib/wcaCheckpoint.test.ts` | Rate limiting logic |
| `lib/countries.ts` | `lib/countries.test.ts` | Country code resolution |

### 2.5 Add Basic Component Tests

| Component | What to Test |
|-----------|-------------|
| `ProtectedRoute` | Redirect on unauthenticated, render on authenticated |
| `GlobalErrorBoundary` | Error capture, diagnostic info display |
| `AppLayout` | Sidebar toggle, route rendering |
| `ConnectionStatusBar` | Status display, reconnect behavior |

---

## Phase 3 — Hooks Decomposition (Score impact: 5/10 → 7/10)

> Split monolithic hooks into composable, single-responsibility hooks.

### 3.1 Decompose `useAcquisitionPipeline` (744 lines → ~4 hooks)

**Current file**: `src/hooks/useAcquisitionPipeline.tsx`  
**Returns**: 38 values (severe SRP violation)

**Split into**:
| New Hook | Responsibility | Est. Lines |
|----------|---------------|------------|
| `useAcquisitionOrchestrator.ts` | Pipeline start/stop/pause, session management, queue processing | ~200 |
| `useNetworkPerformance.ts` | Network stats, regression analysis, scan statistics | ~150 |
| `usePipelineUIState.ts` | Toolbar state, canvas phase, animations, live stats display | ~150 |
| `useAcquisitionResume.ts` | Already exists — keep as-is | existing |

**Compose in page**:
```typescript
// src/pages/AcquisizionePartner.tsx
const orchestrator = useAcquisitionOrchestrator();
const performance = useNetworkPerformance(orchestrator.sessionId);
const ui = usePipelineUIState(orchestrator.status);
```

### 3.2 Decompose `useCockpitLogic` (310 lines → ~3 hooks)

**Current file**: `src/hooks/useCockpitLogic.ts`  
**Returns**: 22 values

**Split into**:
| New Hook | Responsibility | Est. Lines |
|----------|---------------|------------|
| `useCockpitViewState.ts` | viewMode, sourceTab, filters, search | ~80 |
| `useCockpitDragDrop.ts` | draggedContactId, dragCount, handleDragStart/End/Drop | ~70 |
| `useCockpitActions.ts` | AI actions, LinkedIn lookup, deep search, bulk operations, delete | ~160 |

### 3.3 Decompose `useLinkedInFlow` (589 lines → ~2 hooks)

**Split into**:
| New Hook | Responsibility | Est. Lines |
|----------|---------------|------------|
| `useLinkedInSearch.ts` | Search execution, result parsing, pagination | ~250 |
| `useLinkedInEnrichment.ts` | Profile enrichment, data merging, status tracking | ~250 |

### 3.4 Decompose `useImportLogs` (618 lines → ~2 hooks)

**Split into**:
| New Hook | Responsibility | Est. Lines |
|----------|---------------|------------|
| `useImportValidation.ts` | File parsing, schema validation, error reporting | ~250 |
| `useImportPersistence.ts` | Database writes, conflict resolution, log tracking | ~300 |

---

## Phase 4 — Component Decomposition (Score impact: 6/10 → 8/10)

> Break god components into focused, testable sub-components.

### 4.1 Decompose `FiltersDrawer` (1,300 lines)

**Current file**: `src/components/global/FiltersDrawer.tsx`

**Split into**:
```
src/components/global/filters/
├── FiltersDrawer.tsx            # Shell: drawer layout + tab navigation (~100 lines)
├── GeoFilters.tsx               # Country, region filters
├── QualityFilters.tsx           # Quality score, lead status
├── ChannelFilters.tsx           # Email, WhatsApp, LinkedIn
├── StatusFilters.tsx            # Outreach status, activity
├── DateFilters.tsx              # Date ranges, sorting
├── WorkspaceFilters.tsx         # Workspace-specific filters
└── FilterChip.tsx               # Reusable filter tag component
```

### 4.2 Decompose `BusinessCardsHub` (1,084 lines)

**Split into**:
```
src/components/contacts/business-cards/
├── BusinessCardsHub.tsx         # Orchestrator (~100 lines)
├── CardScanner.tsx              # Camera/upload UI
├── CardParser.tsx               # OCR/parsing logic display
├── CardPreview.tsx              # Parsed data preview
├── CardImportForm.tsx           # Manual corrections + import
└── CardHistory.tsx              # Previously scanned cards
```

### 4.3 Decompose `AddContactDialog` (791 lines)

**Split into**:
```
src/components/contacts/add-contact/
├── AddContactDialog.tsx         # Dialog shell + step navigation (~80 lines)
├── ContactBasicInfo.tsx         # Name, email, phone fields
├── ContactCompanyInfo.tsx       # Company, role, industry
├── ContactSourceInfo.tsx        # Origin, channel, notes
└── ContactImportOptions.tsx     # Import/duplicate handling
```

### 4.4 Reduce `ContactStream` Props (26 → ~8)

**Current file**: `src/components/cockpit/ContactStream.tsx`

**Strategy**: Move related props into context or composed hooks:
- Drag/drop props (5) → `useCockpitDragDrop` context
- Selection props (3) → `useSelection` hook
- Filter props (4) → `GlobalFiltersContext` (already available)
- Search props (2) → lift into parent via context

**Target**: `<ContactStream contacts={contacts} isLoading={isLoading} />`  
All other state accessed via hooks and context internally.

---

## Phase 5 — API Layer & Data Access (Score impact: 5/10 → 7/10)

> Centralize data access, add resilience patterns.

### 5.1 Create Repository Layer

**New directory**: `src/lib/repositories/`

```
src/lib/repositories/
├── partnerRepository.ts       # All partner CRUD + queries
├── contactRepository.ts       # All contact CRUD + queries
├── campaignRepository.ts      # Campaign + job queries
├── downloadRepository.ts      # Download job state management
└── types.ts                   # Shared repository types
```

**Pattern**:
```typescript
// src/lib/repositories/partnerRepository.ts
import { supabase } from "@/integrations/supabase/client";
import type { Partner } from "@/types/partner";

export const partnerRepository = {
  findAll: async (): Promise<Partner[]> => {
    const { data, error } = await supabase.from("partners").select("*");
    if (error) throw error;
    return data ?? [];
  },
  findByCountry: async (country: string): Promise<Partner[]> => {
    const { data, error } = await supabase.from("partners").select("*").eq("country", country);
    if (error) throw error;
    return data ?? [];
  },
  upsert: async (partner: Partial<Partner>): Promise<Partner> => {
    const { data, error } = await supabase.from("partners").upsert(partner).select().single();
    if (error) throw error;
    return data;
  },
};
```

**Migration**: Replace 12+ scattered `supabase.from("partners")` calls across hooks with `partnerRepository.*`.

### 5.2 Add API Resilience to `wca-app-bridge.ts`

**File**: `src/lib/wca-app-bridge.ts`

**Add**:
1. **Request timeout** (AbortController, 30s default)
2. **Retry with exponential backoff** (3 retries, 1s/2s/4s)
3. **Response validation** (`response.ok` check before `.json()`)
4. **Typed error hierarchy**:

```typescript
// src/types/api.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export class NetworkError extends ApiError { /* ... */ }
export class AuthError extends ApiError { /* ... */ }
export class RateLimitError extends ApiError { /* ... */ }
```

### 5.3 Add Zod Schemas for API Responses

**File**: `src/lib/api/schemas.ts`

Validate API responses at runtime for critical endpoints:
```typescript
import { z } from "zod";

export const WcaMemberSchema = z.object({
  name: z.string(),
  country: z.string(),
  city: z.string().optional(),
  email: z.string().email().optional(),
  // ...
});

export const DiscoverResponseSchema = z.object({
  members: z.array(WcaMemberSchema),
  total: z.number(),
});
```

### 5.4 Unify Extension Bridge Pattern

**Problem**: 4 nearly identical hooks for different Chrome extensions.

**Create**: `src/lib/createExtensionBridge.ts`

```typescript
export function createExtensionBridge<TMessage, TResponse>(config: {
  extensionId: string;
  name: string;
  timeout?: number;
}) {
  return {
    send: async (message: TMessage): Promise<TResponse> => { /* ... */ },
    isAvailable: (): boolean => { /* ... */ },
    onMessage: (handler: (msg: TResponse) => void) => { /* ... */ },
  };
}
```

**Refactor** `useExtensionBridge`, `useFireScrapeExtensionBridge`, `useLinkedInExtensionBridge`, `useWhatsAppExtensionBridge` to use the factory.

---

## Phase 6 — State Management Refactor (Score impact: 6/10 → 8/10)

### 6.1 Refactor `GlobalFiltersContext` (31 setState → useReducer)

**Current file**: `src/contexts/GlobalFiltersContext.tsx` (203 lines, 31 individual setters)

**Replace with**:
```typescript
type FilterAction =
  | { type: "SET_SEARCH"; payload: string }
  | { type: "SET_ORIGIN"; payload: string }
  | { type: "SET_COUNTRY"; payload: string }
  | { type: "SET_COCKPIT_FILTERS"; payload: Partial<CockpitFilters> }
  | { type: "SET_NETWORK_FILTERS"; payload: Partial<NetworkFilters> }
  | { type: "SET_CRM_FILTERS"; payload: Partial<CrmFilters> }
  | { type: "RESET" };

function filtersReducer(state: FiltersState, action: FilterAction): FiltersState {
  switch (action.type) {
    case "SET_SEARCH": return { ...state, search: action.payload };
    // ...grouped by feature domain
    case "RESET": return initialState;
  }
}
```

**Benefits**: Single dispatch function, action history for debugging, easier testing, grouped updates.

### 6.2 Create `useLocalStorage` Hook

**File**: `src/hooks/useLocalStorage.ts`

Replace scattered `localStorage.getItem()` / `localStorage.setItem()` calls:
```typescript
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  });
  // ...with SSR safety, error handling, and sync across tabs
}
```

---

## Phase 7 — Performance & Production Hardening (Score impact: 6/10 → 8/10)

### 7.1 Add List Virtualization

**Install**: `@tanstack/react-virtual`

**Apply to**:
- Contact lists in Cockpit (`ContactStream`)
- Partner lists in Network view
- Email lists in campaigns
- Import preview tables

### 7.2 Exclude Debug Pages from Production

**File**: `src/App.tsx`

Wrap debug routes with environment check:
```typescript
{import.meta.env.DEV && (
  <>
    <Route path="/test-extensions" element={...} />
    <Route path="/test-download" element={...} />
    <Route path="/test-linkedin" element={...} />
    <Route path="/diagnostics" element={...} />
  </>
)}
```

### 7.3 Configure Bundle Analysis

**Install**: `rollup-plugin-visualizer`

**File**: `vite.config.ts`
```typescript
import { visualizer } from "rollup-plugin-visualizer";

plugins: [
  react(),
  visualizer({ open: false, filename: "dist/bundle-stats.html" }),
],
```

### 7.4 Defer Three.js Globe

Lazy load the 3D globe only when the home page is visible:
```typescript
const Globe = lazy(() => import("@/standalone-globe/Globe"));
// Only render when in viewport using IntersectionObserver
```

---

## Phase 8 — Documentation & DX (Score impact: 5/10 → 7/10)

### 8.1 Create `CLAUDE.md`

Project conventions, architecture decisions, and development guidelines for AI-assisted development.

### 8.2 Create `CONTRIBUTING.md`

Developer onboarding: setup, conventions, PR process, testing requirements.

### 8.3 Standardize Language

Pick one language (English) for all code comments, variable names, and documentation. Italian can remain in user-facing UI strings only.

---

## Expected Score Progression

| Phase | Focus | Current | Target | Effort |
|-------|-------|---------|--------|--------|
| 1 | Type Safety + Error Handling | 2 + 4 | 5 + 7 | 1-2 weeks |
| 2 | Testing Foundation | 2 | 6 | 1-2 weeks |
| 3 | Hooks Decomposition | 5 | 7 | 1 week |
| 4 | Component Decomposition | 6 | 8 | 1 week |
| 5 | API Layer & Data Access | 5 | 7 | 1 week |
| 6 | State Management | 6 | 8 | 3-4 days |
| 7 | Performance & Production | 6 | 8 | 3-4 days |
| 8 | Documentation & DX | 5 | 7 | 2-3 days |

**Estimated total**: 6-8 weeks of focused work  
**Projected final score**: 7.5 — 8.0 / 10

```
Current:   ██████████░░░░░░░░░░  5.4/10
After Ph1: ████████████░░░░░░░░  6.0/10
After Ph2: ██████████████░░░░░░  6.5/10
After Ph3: ██████████████░░░░░░  7.0/10
After Ph4: ████████████████░░░░  7.5/10
After Ph5: ████████████████░░░░  7.8/10
After Ph6: ████████████████░░░░  7.9/10
After Ph7: ████████████████░░░░  8.0/10
After Ph8: ████████████████░░░░  8.0/10
```

---

## Execution Rules

1. **One phase at a time** — complete and verify before moving to the next
2. **No breaking changes** — every commit should leave the app deployable
3. **Test what you change** — every refactored hook/component gets a test file
4. **Verify with `tsc --noEmit`** — after every type safety change
5. **Run `vitest run`** — after every code change
6. **Commit often** — small, focused commits per task, not per phase

---

*Plan derived from [Architecture Evaluation](./architecture-evaluation.md). Each phase addresses specific findings from the evaluation with concrete file paths and implementation patterns.*
