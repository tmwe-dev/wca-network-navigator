# Architecture Overview

## Stack
- **Frontend**: React 18 + TypeScript 5.8 + Vite 5
- **Styling**: Tailwind CSS 3.4 + Radix UI (shadcn/ui)
- **State**: TanStack Query v5 + React Context
- **3D**: Three.js + React Three Fiber + Drei
- **Animation**: Framer Motion 11
- **Backend**: Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **AI**: Multi-provider gateway (Gemini, GPT, via Lovable AI Gateway)
- **PWA**: vite-plugin-pwa + Workbox
- **Monitoring**: Sentry (frontend) + structured JSON logs (Edge Functions)

## Core Modules

1. **CRM / Partner Management** — 7,000+ logistics partners across 17 WCA networks, pipeline tracking, lead scoring
2. **Email Intelligence** — 9-category AI classification, auto-escalation, holding pattern with automated responses
3. **Agent System** — Autonomous AI agents with tool calling, 3-level memory (L1/L2/L3), and daily briefings
4. **Knowledge Base** — RAG with pgvector (1536-dim embeddings), auto-pattern detection from email classifications
5. **Outreach** — Multi-channel campaigns (email, WhatsApp, LinkedIn) with A/B testing and queue management
6. **3D Globe** — Real-time visualization of global partner network with React Three Fiber
7. **Import / Sync** — WCA directory scraping, CSV/Excel import, business card OCR with AI matching

## Security Layers

| Layer | Implementation |
|-------|---------------|
| Authentication | Supabase Auth + authorized_users whitelist |
| Authorization | RLS on all tables + `is_operator_admin()` override |
| API Auth | `authGuard.ts` on all Edge Functions |
| Rate Limiting | Token bucket per-user on AI functions |
| Input Validation | Zod schemas + `inputValidator.ts` |
| HTML Sanitization | DOMPurify via `htmlSanitizer.ts` |
| CORS | Dynamic origin whitelist (no wildcards) |
| Headers | Security headers (HSTS, X-Frame-Options, CSP) |
| Secrets | Environment variables only, never hardcoded |

## Performance

- 37 lazy routes with `guardedPage()` error boundaries
- 8 vendor chunks (react, supabase, query, charts, motion, three-core, three-fiber, ui)
- PWA with Workbox caching strategies (NetworkFirst for API, CacheFirst for fonts)
- Route prefetching on hover via `prefetchRoutes.ts`
- Chunk size limit: 500KB
- Gzip + Brotli compression via vite-plugin-compression

## Database

- PostgreSQL with 50+ tables
- pgvector extension for embeddings
- pgcrypto for credential encryption
- 20+ database functions (SECURITY DEFINER)
- Automated triggers for lead status sync, search vectors, user onboarding

## Testing

- **Unit**: Vitest with v8 coverage (target 60%+)
- **E2E**: Playwright (19 specs) with `data-testid` selectors
- **CI**: GitHub Actions (lint → test → build → deploy)
- **Security**: Automated dependency review on PRs
