## Piano v2.0 — Stato di Avanzamento

### Archivio decisioni precedenti
- Piano originale: Archiviazione 4 Volumi in `docs/metodo/` ✅
- Antipattern AI Code Generators documentato ✅

---

## STEP 1 — Fondazioni TypeScript e Infrastruttura Core ✅
## STEP 2 — IO Layer: Zod Schemas + Mappers + Query/Mutations ✅
## STEP 3 — Auth Completo + Profili + Ruoli ✅
## STEP 4 — Design System v2 + Layout ✅
## STEP 5 — Bridge Layer + Handlers ✅

**63 test green. Build green. Zero errori TypeScript in src/v2/.**

### STEP 3 — Migrazione DB:
- Tipo enum `app_role` (admin, moderator, user)
- Tabella `user_roles` con RLS + `has_role()` SECURITY DEFINER
- Trigger auto-assign ruolo 'user' su signup
- Leaked password protection abilitata

### STEP 3 — Hooks auth:
- `hooks/useAuthV2.ts` — Login, Google OAuth, profilo, ruoli, whitelist
- `hooks/useRequireAuth.ts` — Guard redirect
- `hooks/useRequireRole.ts` — Guard ruolo

### STEP 4 — Design System:
- Atoms: Button, Input, Badge, StatusBadge, DataCell, EmptyState, ErrorMessage
- Molecules: FormField, SearchBar, StatCard, ConfirmDialog, ActionToolbar
- Organisms: DataTable (generico tipizzato), FormSection
- Templates: AuthenticatedLayout, PublicLayout
- Pages: LoginPage, DashboardPage, ResetPasswordPage
- Routes: `src/v2/routes.tsx` lazy-loaded, montato in App.tsx su `/v2/*`

### STEP 5 — Bridge Handlers:
- `handlers/partner-bridge.ts` — create/delete con validazione domain
- `handlers/contact-bridge.ts` — create/update con validazione email
- `handlers/agent-bridge.ts` — create/update
- `handlers/campaign-bridge.ts` — create/update campaign jobs

### Prossimo: STEP 6 — Modulo Network/Partners
