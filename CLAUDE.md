# WCA Network Navigator — Development Guidelines

## Project Overview

B2B network intelligence & sales operations platform for WCA (World Chamber Alliances) partnership discovery and management.

**Stack**: React 18 + TypeScript 5 (strict) + Vite 5 + Supabase + Tailwind/Shadcn

## Architecture

```
src/
├── pages/           Route-level components (lazy-loaded)
├── components/      Feature modules + ui/ (Shadcn)
│   └── global/filters/  Decomposed filter sub-components
├── hooks/           Business logic (composable custom hooks)
├── lib/             Utilities, API clients, repositories
│   ├── api/         wcaAppApi.ts (WCA facade), apiUtils.ts
│   ├── download/    Download engine utilities
│   └── repositories/ Supabase data access layer
├── contexts/        React contexts (useReducer-based)
├── integrations/    Supabase client + auto-generated types
├── types/           Domain types
└── data/            Static data, constants
```

## Key Conventions

### TypeScript
- `strict: true` is enabled — do not add `any` types
- Use types from `src/integrations/supabase/types.ts` for DB entities
- Use `unknown` + type guards at system boundaries

### Hooks
- Hooks = business logic, Components = UI only
- Keep hooks under 300 lines; decompose if larger
- Return objects should have < 15 properties
- Use React Query for all server state
- Use `useLocalStorage` hook (not direct localStorage)

### Components
- Keep components under 400 lines
- Use Shadcn/ui primitives from `components/ui/`
- Wrap feature routes with `FeatureErrorBoundary`
- All routes must be lazy-loaded with `lazyRetry()`

### State Management
- Server state: React Query (TanStack)
- Global client state: React Context + useReducer
- Local state: useState / useReducer
- Persistent state: `useLocalStorage` hook
- Never mix server and client state in the same hook

### Data Access
- Use repository layer (`lib/repositories/`) for Supabase queries
- Use `wcaAppApi.ts` for WCA external API calls
- Use `apiUtils.ts` (fetchWithTimeout, fetchWithRetry) for resilient HTTP

### Error Handling
- Never use empty `catch {}` blocks
- Use `console.warn` for non-critical failures
- Use `console.error` for critical failures
- Use `toast.error()` for user-facing errors
- Wrap route components with `FeatureErrorBoundary`

### Testing
- Test runner: Vitest
- Component testing: React Testing Library
- Co-locate tests next to source files (`.test.ts` / `.test.tsx`)
- Run `npx vitest run` before committing
- Run `npx tsc --noEmit` to verify types

## Commands

```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build + bundle stats
npx vitest run       # Run all tests
npx vitest --coverage # Run tests with coverage report
npx tsc --noEmit     # Type check without emitting
```

## Debug Routes

Test/debug pages (`/test-download`, `/test-linkedin`, `/test-extensions`, `/diagnostics`) are only available in development mode (`import.meta.env.DEV`).
