# Development Guide

## Prerequisites
- Node.js 20+
- npm 10+

## Setup
1. Clone the repository
2. `npm install`
3. Copy `.env.example` to `.env` and configure variables
4. `npm run dev`

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint strict (0 warnings) |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier format |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest run |
| `npm run test:coverage` | Vitest with coverage report |
| `npm run test:ci` | Vitest with coverage + verbose (CI) |
| `npm run validate` | lint + typecheck + test |
| `npm run e2e` | Playwright E2E tests |

## Architecture

```
src/
├── v2/ui/pages/        — Pages (lazy loaded, 37 routes)
├── components/         — React components (shared, admin, mobile, etc.)
├── hooks/              — 137+ custom hooks
├── lib/                — Utility and business logic
├── i18n/               — Internationalization (IT/EN)
├── integrations/       — Supabase client & types (auto-generated)
├── test/               — Test setup and shared test utilities
supabase/
├── functions/          — Edge Functions (Deno runtime)
├── functions/_shared/  — Shared modules (CORS, auth, monitoring, etc.)
├── migrations/         — Database migrations
e2e/                    — Playwright E2E tests (19 specs)
docs/                   — API, Architecture, Edge Function docs
.github/workflows/      — CI/CD pipeline
```

## Conventions

- **TypeScript strict**: zero `as any` in Edge Functions and src/lib/
- **ESLint**: zero warnings allowed
- **Prettier**: auto-format via pre-commit hook (Husky + lint-staged)
- **Testing**: every new module in `src/lib/` MUST have a unit test
- **i18n**: every user-visible string MUST use `useTranslation()`
- **Components**: max 300 LOC; beyond that, split using Orchestrator-Hook-Subcomponent pattern
- **Edge Functions**: MUST use authGuard + monitoring + CORS + securityHeaders

## CI/CD

- **Pre-commit**: Husky + lint-staged (ESLint fix + Prettier)
- **GitHub Actions**: lint → test (with coverage) → build → deploy notification
- **Deploy**: automatic on push to main via Lovable
- **Dependency Review**: automated security scan on PRs

## Data Layer

- All data access goes through Supabase client (`@/integrations/supabase/client`)
- Row Level Security (RLS) on all tables
- Never raw SQL from client — use typed SDK methods only
- State management via TanStack Query v5

## Adding a New Page

1. Create component in `src/v2/ui/pages/YourPage.tsx`
2. Add lazy import in `src/v2/routes.tsx`
3. Add route with `guardedPage()` wrapper
4. Add nav entry in `src/v2/ui/templates/LayoutSidebarNav.tsx`
5. Add i18n key in `src/i18n/locales/en.json` and `it.json`
6. Add `data-testid="page-your-page"` to root container

## Adding an Edge Function

1. Create `supabase/functions/your-function/index.ts`
2. Use standard template (see `docs/EDGE-FUNCTIONS.md`)
3. Import `authGuard`, `monitoring`, `cors`, `securityHeaders`
4. Deploy via Lovable (automatic)
