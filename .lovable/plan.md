## Piano v2.0 — Stato di Avanzamento

### Completati

- **STEP 1** ✅ — Fondazioni TypeScript e Infrastruttura Core (42 test)
- **STEP 2** ✅ — IO Layer: Zod Schemas + Mappers + Query/Mutations (63 test)
- **STEP 3** ✅ — Auth Completo + Profili + Ruoli (migrazione DB `user_roles`, hooks auth)
- **STEP 4** ✅ — Design System v2 + Layout (atoms, molecules, organisms, templates, routing `/v2/*`)
- **STEP 5** ✅ — Bridge Layer + Handlers (partner, contact, agent, campaign)
- **STEP 6** ✅ — Modulo Network/Partners (domain rules, hook, NetworkPage con DataTable)
- **STEP 7** ✅ — Modulo CRM/Contatti (domain rules, hook, CRMPage con DataTable)
- **STEP 8** ✅ — Moduli Outreach + Agenti + Campagne (domain rules, hooks, pages)
- **STEP 9** ✅ — Moduli Secondari + Routing Completo (Settings, Diagnostics, Import, tutti i route wired)
- **STEP 10** ✅ — Audit Finale + Test Coverage (77 test green, build green, zero errori TS)

**77 test green. Build green. Zero errori TypeScript in src/v2/. Tutti i 10 step completati.**

### Struttura v2 finale

```text
src/v2/
├── core/
│   ├── domain/
│   │   ├── entities.ts         — Tipi brandizzati (Partner, Contact, Agent, Activity, CampaignJob, etc.)
│   │   ├── errors.ts           — AppError factory (domain/io/infra)
│   │   ├── result.ts           — Result<T,E> monad
│   │   ├── validators.ts       — Pure validators (email, ISO, business rules)
│   │   └── rules/
│   │       ├── partner-rules.ts    — Completeness score, outreach eligibility
│   │       ├── contact-rules.ts    — Contact scoring, transfer eligibility
│   │       ├── agent-rules.ts      — Agent readiness, territory matching
│   │       ├── campaign-rules.ts   — Job status counts, completion %
│   │       └── activity-rules.ts   — Actionable check, overdue logic
│   └── mappers/                — Row → Domain entity mappers (5 files)
├── io/
│   ├── supabase/
│   │   ├── schemas/            — Zod schemas per tabella (5 files)
│   │   ├── queries/            — Result-based SELECT (6 files)
│   │   └── mutations/          — Result-based INSERT/UPDATE (5 files)
│   ├── edge/                   — Edge function client con circuit breaker
│   └── external/               — WCA API wrapper
├── bridge/
│   ├── event-bus.ts            — Pub/sub con DLQ e retry
│   ├── circuit-breaker.ts      — Circuit breaker pattern
│   ├── retry.ts                — Exponential backoff
│   └── handlers/               — Domain event → IO bridge (4 files)
├── hooks/
│   ├── useAuthV2.ts            — Auth con Result<Profile>
│   ├── useRequireAuth.ts       — Guard redirect
│   ├── useRequireRole.ts       — Role-based guard
│   ├── usePartnersV2.ts        — Partner list + detail
│   ├── useContactsV2.ts        — Contact list + detail
│   ├── useAgentsV2.ts          — Agent list
│   ├── useCampaignsV2.ts       — Campaign jobs
│   └── useActivitiesV2.ts      — Activity/outreach list
├── ui/
│   ├── atoms/                  — Button, Input, Badge, StatusBadge, etc. (7 files)
│   ├── molecules/              — SearchBar, StatCard, FormField, etc. (5 files)
│   ├── organisms/              — DataTable, FormSection (2 files)
│   ├── templates/              — AuthenticatedLayout, PublicLayout (2 files)
│   └── pages/                  — 11 pages lazy-loaded
│       ├── LoginPage.tsx
│       ├── ResetPasswordPage.tsx
│       ├── DashboardPage.tsx
│       ├── NetworkPage.tsx
│       ├── CRMPage.tsx
│       ├── OutreachPage.tsx
│       ├── AgentsPage.tsx
│       ├── CampaignsPage.tsx
│       ├── SettingsPage.tsx
│       ├── DiagnosticsPage.tsx
│       └── ImportPage.tsx
├── lib/                        — Logger, health check
├── test/                       — 9 test files, 77 test cases
└── routes.tsx                  — Complete routing con lazy loading
```
