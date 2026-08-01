# Architecture Overview — WCA Network Navigator

> Last updated: 2026-05-13 (Sprint K documentation pass)

## Tech Stack

| Layer          | Technology                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| **Frontend**   | React 18 + TypeScript 5.8 + Vite 5                                                                       |
| **Styling**    | Tailwind CSS 3.4 + Radix UI (shadcn/ui)                                                                  |
| **State**      | TanStack Query v5 (React Query) + React Context                                                          |
| **3D**         | Three.js + React Three Fiber + Drei                                                                      |
| **Animation**  | Framer Motion 11                                                                                         |
| **Backend**    | Supabase (PostgreSQL 15 + Auth + RLS + Storage + 148 Edge Functions)                                     |
| **AI**         | Multi-provider gateway (Gemini, GPT-4, Anthropic Claude, xAI Grok, Qwen, OpenRouter, Lovable AI Gateway) |
| **Voice**      | ElevenLabs (TTS + conversational agents)                                                                 |
| **PWA**        | vite-plugin-pwa + Workbox                                                                                |
| **Monitoring** | Sentry (frontend) + structured JSON logs (Edge Functions) + EdgeFunctionMetricsPanel + Discord alerts    |

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

## Key Directories

```
src/
  data/           Data Access Layer — ALL DB reads/writes go through here
  lib/            Utilities, API wrappers, logging, security helpers
  lib/ai/         AI invocation gateway (invokeAi), provider configs
  lib/security/   CSP, injection guard, input sanitizer
  lib/log/        Structured logging utilities
  pages/          Application pages (v1 routing)
  components/     React components organized by domain
  components/ui/  shadcn/ui primitives
  hooks/          Custom React hooks
  i18n/           Translations (it/en)
  v2/             Evolved v2 UI components and pages
  test/           Test setup and helpers

supabase/
  functions/      148 Edge Functions (Deno runtime)
  functions/_shared/   Shared modules (auth, CORS, monitoring, rate limiter, etc.)
  migrations/     385+ SQL migrations
  config.toml     Project configuration

docs/             Technical documentation
e2e/              End-to-end Playwright tests
```

## Data Access Layer (DAL)

**Invariant: All UI code accesses Supabase through typed DAL functions in `src/data/`.** Direct `supabase.from()` is forbidden outside DAL files.

- `src/data/*.ts` — One file per domain (partners, contacts, deals, emails, agents, etc.)
- `src/lib/supabaseUntyped.ts` — Single sanctioned `any` boundary (`untypedFrom()`) for tables not yet in generated types
- `src/lib/queryKeys.ts` — Centralized query keys split across `src/lib/queryKeysParts/` (crm, comms, system, aiAndAnalytics, v2)
- `.maybeSingle()` used everywhere (never `.single()`)

## AI Orchestration

### invokeAi() Gateway

All AI calls in the application go through a single gateway function `invokeAi()` which enforces:

- **Scope tagging**: every call declares its `scope` (e.g., "email-classify", "partner-enrich")
- **Context source**: `context.source` identifies the caller for audit trail
- **Provider routing**: AI Gateway Config selects the optimal provider per scope
- **Cost tracking**: token usage logged to `ai_interaction_log`
- **Rate limiting**: per-user token bucket on AI-intensive operations

### AI Gateway Config — 7 Providers

| Provider               | Usage                                                   |
| ---------------------- | ------------------------------------------------------- |
| **Google Gemini**      | Primary for classification, enrichment, bulk operations |
| **OpenAI GPT-4**       | Complex reasoning, email generation                     |
| **Anthropic Claude**   | Analysis, editorial review                              |
| **xAI Grok**           | Alternative reasoning paths                             |
| **Qwen**               | Multilingual tasks                                      |
| **OpenRouter**         | Fallback routing across providers                       |
| **Lovable AI Gateway** | Managed gateway with key rotation                       |

### Prompt Lab

The Prompt Lab is the governance layer for all AI prompts:

- **Operative prompts CRUD** — versioned prompts stored in `operative_prompts` table
- **A/B test arena** — `ai-arena-suggest` compares prompt variants
- **Auto-refiner** — `agent-prompt-refiner` (weekly cron) suggests improvements
- **Test runner** — `prompt-test-runner` (daily cron) runs test suites
- **Health banner** — 3-axis grading: test coverage, duplicates, persona completeness

## Edge Functions

148 Deno-based Edge Functions in `supabase/functions/`. Each follows a standard pattern:

1. CORS preflight handling
2. Auth check (JWT via `authGuard.ts` or cron-secret via `cronGuard.ts`)
3. Input validation
4. Business logic with service-role Supabase client
5. Structured metrics logging

Shared modules live in `supabase/functions/_shared/` and include: CORS, auth guard, monitoring, security headers, rate limiter, input validator, injection guard, error handler, CSRF protection, and 100+ domain-specific helpers.

See [EDGE-FUNCTIONS.md](./EDGE-FUNCTIONS.md) for the complete catalog.

## Auth and Security

### Authentication Flow

1. User signs in via Supabase Auth (email/password)
2. `authorized_users` whitelist restricts who can access the app
3. JWT token issued by Supabase Auth
4. All Edge Functions verify JWT via `getClaims()` in `authGuard.ts` (no network `getUser()` call)
5. RLS policies on all tables enforce row-level access using `auth.uid()`

### Security Layers

| Layer             | Implementation                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Authentication    | Supabase Auth + authorized_users whitelist                                                     |
| Authorization     | RLS on all tables — user-scoped (`auth.uid() = user_id`) or admin-scoped (`has_role('admin')`) |
| API Auth          | `authGuard.ts` on all Edge Functions (JWT via getClaims, no network getUser)                   |
| Rate Limiting     | Token bucket per-user on AI functions + `rate_limit_violations` table                          |
| Input Validation  | Zod schemas + `inputValidator.ts`                                                              |
| Injection Guard   | `injectionGuard.ts` blocks prompt injection attempts                                           |
| HTML Sanitization | DOMPurify via `htmlSanitizer.ts`                                                               |
| CORS              | Dynamic origin whitelist in `_shared/cors.ts` (no wildcards)                                   |
| CSP               | Content Security Policy enforcing on all Edge Functions                                        |
| Headers           | Security headers (HSTS, X-Frame-Options DENY, Permissions-Policy)                              |
| Secrets           | Vault for cron secrets, env vars for service keys, never hardcoded                             |

## Performance

- 37 lazy routes with `guardedPage()` error boundaries
- 8 vendor chunks (react, supabase, query, charts, motion, three-core, three-fiber, ui)
- PWA with Workbox caching strategies (NetworkFirst for API, CacheFirst for fonts)
- 10 composite indexes on hot query paths (Sprint I)
- Route prefetching on hover via `prefetchRoutes.ts`
- React Query configured with staleTime/gcTime tuning via `queryConfig.ts`
- Performance utilities in `perfUtils.ts`
- Chunk size limit: 500KB, Gzip + Brotli compression

## Database

- PostgreSQL 15 with 385+ migrations, 60+ tables
- pgvector extension for embeddings (1536-dim)
- pgcrypto for credential encryption
- 20+ database functions (SECURITY DEFINER)
- Automated triggers for lead status sync, search vectors, user onboarding
- Soft-delete only on 15 business tables

## Testing

- **Unit**: Vitest with v8 coverage — thresholds: statements 35%, branches 25%, functions 30%, lines 35%
- **Integration**: 219+ test files across src/
- **E2E**: Playwright with `data-testid` selectors
- **Edge Function**: Deno test files (`_test.ts`) per function
- **AI Eval**: Funnemail eval dataset (50 annotated cases) with accuracy tracking
- **CI**: GitHub Actions (lint -> typecheck -> test -> build -> e2e)
- **Security**: Automated dependency review on PRs

## Invariant Principles

1. **DAL only** — no `supabase.from()` in UI/hooks
2. **No `any`** — use `Record<string, unknown>`, `as never`, `as unknown as T`
3. **`.maybeSingle()` always** — never `.single()`
4. **CORS whitelist** — in `_shared/cors.ts`, never wildcard
5. **Editorial review intoccabile** — on email/WA/LI outbound
6. **AI Invocation Charter** — every AI call via `invokeAi()` with `scope` + `context.source`
7. **Cron secrets from Vault** — never hardcoded
8. **Soft-delete only** — on business tables
