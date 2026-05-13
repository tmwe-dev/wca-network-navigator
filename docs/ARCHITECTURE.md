# Architecture Overview — WCA Network Navigator

> Last updated: 2026-05-13 (Sprint K documentation pass)

## Stack

- **Frontend**: React 18 + TypeScript 5.8 + Vite 5
- **Styling**: Tailwind CSS 3.4 + Radix UI (shadcn/ui)
- **State**: TanStack Query v5 + React Context
- **3D**: Three.js + React Three Fiber + Drei
- **Animation**: Framer Motion 11
- **Backend**: Supabase (PostgreSQL 15 + Auth + RLS + 149 Edge Functions)
- **AI**: Multi-provider gateway (Gemini, GPT, Anthropic, xAI, Qwen via Lovable AI Gateway)
- **PWA**: vite-plugin-pwa + Workbox
- **Monitoring**: Sentry (frontend) + structured JSON logs (Edge Functions) + EdgeFunctionMetricsPanel

## Core Modules

1. **CRM / Partner Management** — 7,000+ logistics partners across 17 WCA networks, pipeline tracking, lead scoring, partner quality score (5-star system)
2. **Email Intelligence (Funnemail)** — 9-category AI classification, auto-escalation, holding pattern, eval dataset (50 cases, accuracy tracking), domain-level routing (commercial/operative/admin/spam)
3. **Agent System** — 8 AI agent personas (Arricchitore, Sherlock, Scout, Commerciale, Caporedattore, Correttore, Classificatore, Decisore) with tool calling, 3-level memory, daily briefings, Agent Atlas visualization
4. **Prompt Lab** — Governance layer: operative prompts CRUD, A/B test arena, auto-refiner (weekly cron), test runner (daily cron), health banner with 3 grading axes
5. **Knowledge Base** — RAG with pgvector (1536-dim embeddings), auto-pattern detection, learned_patterns from user feedback
6. **Outreach** — Multi-channel campaigns (email, WhatsApp, LinkedIn) with A/B testing, queue management, and cadence engine
7. **Dispatch** — Integrity checker (daily cron) verifying coherence between channel_messages, activities, and partner touches
8. **3D Globe** — Real-time visualization of global partner network with React Three Fiber
9. **Import / Sync** — WCA directory scraping, CSV/Excel import, business card OCR with AI matching

## Data Access Layer (DAL)

All UI code accesses Supabase through typed DAL functions in `src/data/`. Direct `supabase.from()` is forbidden outside DAL files.

- `src/lib/supabaseUntyped.ts` — Single sanctioned `any` boundary (`untypedFrom()`) for tables not yet in generated types
- `src/lib/queryKeys.ts` — Centralized query keys split across `src/lib/queryKeysParts/` (crm, comms, system, aiAndAnalytics, v2)
- `.maybeSingle()` used everywhere (never `.single()`)

## Security Layers

| Layer | Implementation |
|-------|---------------|
| Authentication | Supabase Auth + authorized_users whitelist |
| Authorization | RLS on all tables — user-scoped (auth.uid() = user_id) or admin-scoped (has_role('admin')) |
| API Auth | `authGuard.ts` on all Edge Functions (JWT via getClaims, no network getUser) |
| Rate Limiting | Token bucket per-user on AI functions + rate_limit_violations table |
| Input Validation | Zod schemas + `inputValidator.ts` |
| HTML Sanitization | DOMPurify via `htmlSanitizer.ts` |
| CORS | Dynamic origin whitelist in `_shared/cors.ts` (no wildcards) |
| Headers | Security headers (HSTS, CSP enforcing, X-Frame-Options DENY, Permissions-Policy) |
| Secrets | Vault for cron secrets, env vars for service keys, never hardcoded |

## Performance

- 37 lazy routes with `guardedPage()` error boundaries
- 8 vendor chunks (react, supabase, query, charts, motion, three-core, three-fiber, ui)
- PWA with Workbox caching strategies (NetworkFirst for API, CacheFirst for fonts)
- 10 composite indexes on hot query paths (Sprint I)
- Route prefetching on hover via `prefetchRoutes.ts`
- Chunk size limit: 500KB, Gzip + Brotli compression

## Database

- PostgreSQL 15 with 385 migrations, 60+ tables
- pgvector extension for embeddings (1536-dim)
- pgcrypto for credential encryption
- 20+ database functions (SECURITY DEFINER)
- Automated triggers for lead status sync, search vectors, user onboarding
- Soft-delete only on 15 business tables

## Testing

- **Unit**: Vitest with v8 coverage — thresholds: statements 35%, branches 25%, functions 30%, lines 35%
- **Integration**: 219 test files across src/
- **E2E**: Playwright with `data-testid` selectors
- **Edge Function**: Deno test files (`_test.ts`) per function
- **CI**: GitHub Actions (lint → test → build → deploy)
- **Security**: Automated dependency review on PRs

## Invariant Principles

1. DAL only — no `supabase.from()` in UI/hooks
2. No `any` — use `Record<string, unknown>`, `as never`, `as unknown as T`
3. `.maybeSingle()` always
4. CORS whitelist in `_shared/cors.ts`, never wildcard
5. Editorial review intoccabile on email/WA/LI
6. AI Invocation Charter: every AI call via `invokeAi()` with `scope` + `context.source`
7. Cron secrets from Vault, never hardcoded
8. Soft-delete only on business tables
