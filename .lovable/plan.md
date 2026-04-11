

# WCA Network Navigator v2.0 — Piano Esecutivo Completo

---

## Stato Attuale

### v1.0 (Freeze — Non si tocca)

```text
src/
├── components/    34 sottocartelle, centinaia di file — monolitici, molti >500 LOC
├── hooks/         120+ hook — logica business mescolata con UI
├── data/          49 file DAL — copertura 100% ma senza tipizzazione strict
├── lib/           35+ file — utility, API client, log strutturato (già esistente)
├── pages/         37 pagine — tutte lazy loaded
├── types/         3 file — tipizzazione minima
├── integrations/  Supabase client auto-generato
├── contexts/      ContactDrawer, ActiveOperator
└── config/        Configurazione varia

supabase/functions/   65+ edge functions
Database:             72 tabelle con RLS abilitato
```

### Cosa esiste già di buono nella v1 (riutilizzabile come riferimento)

- `ApiError` tipizzato con codici espliciti (`src/lib/api/apiError.ts`)
- Logger strutturato JSON con sink (`src/lib/log.ts`)
- DAL centralizzato in `src/data/` (49 moduli)
- `lazyRetry` per chunk recovery
- Sistema whitelist auth (`authorized_users` + `check_whitelist`)
- `ProtectedRoute`, `GlobalErrorBoundary`, `FeatureErrorBoundary`
- 72 tabelle DB con RLS, 65+ edge functions funzionanti

### Cosa manca per la v2

- **Zero** directory `src/v2/` — non esiste ancora nulla
- **Zero** tipi strict brandizzati (TypeScript strict non enforced)
- **Zero** Result monad, error factory categorizzata
- **Zero** event bus tipizzato
- **Zero** bridge layer
- **Zero** Zod validation schemas
- **Zero** test automatici (Vitest configurato ma vuoto per dominio)
- **Zero** design system tipizzato (usa shadcn/ui raw)
- **Zero** separazione core/io/bridge
- `tsconfig.app.json` ha `strict: true` ma `any` usati ovunque (1489 soppressioni)

---

## Struttura Target v2

```text
src/v2/
├── core/                          # Logica pura — ZERO import di Supabase/React
│   ├── domain/
│   │   ├── entities.ts            # Tipi brandizzati: Partner, Contact, Agent, Activity...
│   │   ├── errors.ts              # Error factory (3 categorie: Domain, IO, Infra)
│   │   ├── events.ts              # Event types per l'event bus
│   │   ├── result.ts              # Result<T, E> monad
│   │   ├── validators.ts          # Validazioni pure di dominio (no IO)
│   │   └── rules/
│   │       ├── partner-rules.ts
│   │       ├── contact-rules.ts
│   │       ├── campaign-rules.ts
│   │       ├── agent-rules.ts
│   │       └── outreach-rules.ts
│   ├── mappers/
│   │   ├── partner-mapper.ts      # DB row → Domain entity
│   │   ├── contact-mapper.ts
│   │   ├── agent-mapper.ts
│   │   ├── activity-mapper.ts
│   │   └── campaign-mapper.ts
│   └── glossary.ts                # SSOT: nomi variabili approvati (JSON Schema ref)
│
├── io/                            # Unico punto di contatto con l'esterno
│   ├── supabase/
│   │   ├── queries/
│   │   │   ├── partners.ts
│   │   │   ├── contacts.ts
│   │   │   ├── agents.ts
│   │   │   ├── activities.ts
│   │   │   ├── campaigns.ts
│   │   │   ├── kb-entries.ts
│   │   │   └── app-settings.ts
│   │   ├── mutations/
│   │   │   ├── partners.ts
│   │   │   ├── contacts.ts
│   │   │   ├── agents.ts
│   │   │   ├── activities.ts
│   │   │   └── campaigns.ts
│   │   └── schemas/               # Zod schemas per validazione response
│   │       ├── partner-schema.ts
│   │       ├── contact-schema.ts
│   │       └── agent-schema.ts
│   ├── edge/
│   │   ├── client.ts              # invokeEdge v2 con Result<T>
│   │   └── schemas.ts             # Zod per risposte edge function
│   └── external/
│       └── wca-api.ts             # wcaAppApi v2 con Result<T>
│
├── bridge/                        # Orchestrazione core ↔ io
│   ├── event-bus.ts               # Event bus tipizzato con dead letter queue
│   ├── circuit-breaker.ts         # 3 fail → open → 60s → half-open
│   ├── retry.ts                   # Retry con backoff esponenziale
│   ├── health.ts                  # Health check registry
│   └── handlers/
│       ├── partner-bridge.ts
│       ├── contact-bridge.ts
│       ├── agent-bridge.ts
│       └── campaign-bridge.ts
│
├── hooks/                         # React hooks v2 — stato + side effects
│   ├── useAuthV2.ts
│   ├── useRequireAuth.ts
│   ├── useRequireRole.ts
│   ├── usePartnersV2.ts
│   ├── useContactsV2.ts
│   ├── useAgentsV2.ts
│   ├── useCampaignsV2.ts
│   ├── useEventBus.ts
│   ├── useHealthCheck.ts
│   └── useModalManager.ts
│
├── ui/                            # Componenti React — ZERO logica business
│   ├── atoms/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Badge.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── DataCell.tsx
│   │   ├── EmptyState.tsx
│   │   └── ErrorMessage.tsx
│   ├── molecules/
│   │   ├── FormField.tsx
│   │   ├── SearchBar.tsx
│   │   ├── ActionToolbar.tsx
│   │   ├── StatCard.tsx
│   │   └── ConfirmDialog.tsx
│   ├── organisms/
│   │   ├── DataTable.tsx          # Generico, tipizzato, sort/filter/pagination
│   │   ├── FormSection.tsx
│   │   ├── PartnerTable.tsx
│   │   ├── ContactTable.tsx
│   │   └── AgentCard.tsx
│   ├── templates/
│   │   ├── AuthenticatedLayout.tsx
│   │   ├── PublicLayout.tsx
│   │   └── DashboardLayout.tsx
│   └── pages/
│       ├── LoginPage.tsx
│       ├── ResetPasswordPage.tsx
│       ├── DashboardPage.tsx
│       ├── NetworkPage.tsx
│       ├── CRMPage.tsx
│       ├── OutreachPage.tsx
│       ├── AgentCockpitPage.tsx
│       ├── CampaignsPage.tsx
│       ├── SettingsPage.tsx
│       └── DiagnosticsPage.tsx
│
├── lib/
│   ├── logger.ts                  # Logger v2 strutturato (wrap di log.ts)
│   ├── feature-flags.ts           # Feature flag registry
│   └── action-registry.ts         # Registro azioni tipizzato
│
├── test/
│   ├── core/
│   │   ├── result.test.ts
│   │   ├── errors.test.ts
│   │   ├── events.test.ts
│   │   ├── validators.test.ts
│   │   └── mappers/
│   │       ├── partner-mapper.test.ts
│   │       └── contact-mapper.test.ts
│   ├── bridge/
│   │   ├── event-bus.test.ts
│   │   ├── circuit-breaker.test.ts
│   │   └── retry.test.ts
│   ├── io/
│   │   └── schemas.test.ts
│   └── hooks/
│       └── useAuthV2.test.ts
│
└── routes.tsx                     # Routing v2 lazy-loaded, separato da v1
```

---

## Piano di Esecuzione (10 Step)

---

### STEP 1 — Fondazioni TypeScript e Infrastruttura Core

**Obiettivo:** Creare lo scheletro `src/v2/` con tutti i mattoni fondamentali che ogni modulo successivo userà. Nessuna UI, nessun DB, solo TypeScript puro.

**Deliverable:**

1. Creare la directory `src/v2/` con tutte le sottocartelle (`core/`, `io/`, `bridge/`, `hooks/`, `ui/atoms/`, `ui/molecules/`, `ui/organisms/`, `ui/templates/`, `ui/pages/`, `lib/`, `test/`)

2. `src/v2/core/domain/entities.ts` — Tipi brandizzati per tutte le entità principali derivate dalle 72 tabelle DB:
   - `PartnerId`, `ContactId`, `AgentId`, `ActivityId`, `CampaignId` (branded string types)
   - `Partner`, `Contact`, `Agent`, `Activity`, `Campaign`, `KbEntry`, `AiMemory`, `EmailTemplate`, `DownloadJob` (interfacce complete, readonly, nessun `any`)
   - Derivati dal database schema attuale ma con tipi strict

3. `src/v2/core/domain/errors.ts` — Error factory con 3 categorie:
   - `DomainError` (validazione, business rules violate)
   - `IOError` (database, network, API esterne)
   - `InfraError` (event bus, circuit breaker, configurazione)
   - Ogni errore ha: `code`, `message`, `category`, `context`, `recoveryStrategy` (`retry | fallback | escalate | ignore`)

4. `src/v2/core/domain/events.ts` — Tipi per tutti gli eventi del sistema:
   - `PartnerCreated`, `PartnerUpdated`, `ContactCreated`, `EmailSent`, `AgentTaskCompleted`, etc.
   - Ogni evento: `type`, `payload`, `timestamp`, `source`, `correlationId`

5. `src/v2/core/domain/result.ts` — Result monad:
   - `Result<T, E = AppError>` = `Ok<T> | Err<E>`
   - Helper: `ok()`, `err()`, `isOk()`, `isErr()`, `map()`, `flatMap()`, `unwrapOr()`
   - MAI throw in codice v2 — tutto ritorna Result

6. `src/v2/core/glossary.ts` — SSOT dei nomi approvati:
   - Mappa ogni termine di dominio al suo tipo, descrizione, tabella di origine
   - Nessun nome generico (`data`, `temp`, `result`, `info`) permesso

7. `src/v2/bridge/event-bus.ts` — Event bus tipizzato:
   - `subscribe<T>(eventType, handler)`, `publish<T>(event)`, `unsubscribe()`
   - Dead Letter Queue: eventi falliti vanno in DLQ con conteggio tentativi
   - Max 3 retry per handler, poi DLQ
   - Logging strutturato di ogni evento emesso/ricevuto

8. `src/v2/bridge/circuit-breaker.ts` — Circuit Breaker:
   - 3 stati: `closed` (normale), `open` (bloccato), `half-open` (test)
   - Dopo 3 fallimenti consecutivi → open per 60s → half-open (1 tentativo)
   - Se half-open riesce → closed; se fallisce → open di nuovo
   - Ogni transizione loggata

9. `src/v2/bridge/retry.ts` — Retry con backoff esponenziale:
   - `withRetry<T>(fn, options)` → `Result<T>`
   - Options: `maxAttempts`, `baseDelay`, `maxDelay`, `shouldRetry` (predicate)

10. `src/v2/bridge/health.ts` — Health check registry:
    - Registra check per: DB, edge functions, WCA API, event bus
    - `checkAll()` → `HealthReport` con stato per servizio

11. `src/v2/lib/logger.ts` — Logger v2 (wrapper del `log.ts` v1 con API v2)

12. `src/v2/lib/feature-flags.ts` — Feature flag registry per abilitare/disabilitare moduli

13. Installare `zod` come dipendenza per validazione contratti IO

**Test (Vitest):**
- `result.test.ts` — ok/err/map/flatMap/unwrapOr
- `errors.test.ts` — factory produce errori corretti per categoria
- `events.test.ts` — tipi e serializzazione
- `event-bus.test.ts` — pub/sub, DLQ, max retry
- `circuit-breaker.test.ts` — transizioni di stato
- `retry.test.ts` — backoff, max attempts

**Quality gate:** Build green, tutti i test green, zero `any` in `src/v2/`, zero warning lint.

---

### STEP 2 — IO Layer: Supabase Query/Mutation + Zod Schemas

**Obiettivo:** Creare il layer IO completo che wrappa ogni interazione con Supabase in `Result<T>`, validando le risposte con Zod.

**Deliverable:**

1. `src/v2/io/supabase/schemas/` — Zod schemas per ogni entità principale:
   - `partner-schema.ts` — `PartnerRowSchema`, `PartnerListResponseSchema`
   - `contact-schema.ts` — `ContactRowSchema`
   - `agent-schema.ts` — `AgentRowSchema`
   - `activity-schema.ts` — `ActivityRowSchema`
   - `campaign-schema.ts` — `CampaignRowSchema`, `CampaignJobSchema`
   - Ogni schema derivato dalla struttura reale delle 72 tabelle

2. `src/v2/core/mappers/` — Mapper DB→Domain per ogni entità:
   - `partner-mapper.ts` — `mapPartnerRow(row) → Result<Partner>`
   - `contact-mapper.ts` — `mapContactRow(row) → Result<Contact>`
   - `agent-mapper.ts`, `activity-mapper.ts`, `campaign-mapper.ts`
   - Ogni mapper valida con Zod, poi converte in tipo domain

3. `src/v2/io/supabase/queries/` — Query tipizzate (read-only):
   - Ogni funzione ritorna `Promise<Result<T>>`
   - Nessun `throw` — errori wrappati in `Err(IOError(...))`
   - `partners.ts` — `fetchPartners(filters)`, `fetchPartnerById(id)`, `fetchPartnersByCountry(code)`
   - `contacts.ts` — `fetchContacts(filters)`, `fetchContactById(id)`
   - `agents.ts`, `activities.ts`, `campaigns.ts`, `kb-entries.ts`, `app-settings.ts`

4. `src/v2/io/supabase/mutations/` — Mutazioni tipizzate:
   - Ogni funzione ritorna `Promise<Result<T>>`
   - `partners.ts` — `createPartner(data)`, `updatePartner(id, data)`, `deletePartner(id)`
   - `contacts.ts`, `agents.ts`, `activities.ts`, `campaigns.ts`

5. `src/v2/io/edge/client.ts` — `invokeEdgeV2<TReq, TRes>(name, payload, schema)`:
   - Wrappa `invokeEdge` v1 in Result
   - Valida response con Zod schema passato
   - Circuit breaker integrato per endpoint

6. `src/v2/io/external/wca-api.ts` — WCA API client v2 con Result

7. `src/v2/core/domain/validators.ts` — Validazioni pure di dominio:
   - `validatePartnerData(data) → Result<ValidPartner>`
   - `validateContactEmail(email) → Result<string>`
   - `validateCampaignDates(start, end) → Result<DateRange>`
   - Pure functions, no IO, testabili in isolamento

**Test:**
- `schemas.test.ts` — Zod parse/reject con dati reali e invalidi
- `partner-mapper.test.ts`, `contact-mapper.test.ts`
- `validators.test.ts` — regole di business

**Quality gate:** Tutti i mapper convertono correttamente le righe DB reali. Zod reject dati malformati. Zero `any`.

---

### STEP 3 — Auth Completo + Profili + Ruoli

**Obiettivo:** Sistema di autenticazione v2 completo, con profili, ruoli DB, Google OAuth, guard per route protette.

**Migrazioni DB:**

1. Tabella `user_roles`:
   ```sql
   CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
   CREATE TABLE public.user_roles (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
     role app_role NOT NULL,
     UNIQUE (user_id, role)
   );
   ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
   ```

2. Funzione `has_role` (SECURITY DEFINER):
   ```sql
   CREATE FUNCTION public.has_role(_user_id UUID, _role app_role)
   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path = public AS $$
     SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
   $$;
   ```

3. RLS policies su `user_roles`:
   - Users can read own roles
   - Only admins can insert/update/delete roles

4. Aggiornare trigger `handle_new_user` per assegnare ruolo default `'user'`

**Nota:** La tabella `profiles` esiste già con trigger auto-creazione. La tabella `authorized_users` con whitelist esiste già. Si integrano.

**Codice v2:**

1. `src/v2/hooks/useAuthV2.ts` — Hook auth completo:
   - Login email/password + Google OAuth (via `lovable.auth.signInWithOAuth`)
   - Carica profilo e ruoli dopo login
   - Controlla whitelist (`is_email_authorized`)
   - Registra login (`record_user_login`)
   - Gestisce sessione con `onAuthStateChange`

2. `src/v2/hooks/useRequireAuth.ts` — Redirect a `/v2/login` se non autenticato

3. `src/v2/hooks/useRequireRole.ts` — Controlla ruolo con fallback (es. solo admin vede Settings)

4. `src/v2/ui/pages/LoginPage.tsx` — Form login con email/password + Google + loading state resiliente (timer fallback 5s come v1)

5. `src/v2/ui/pages/ResetPasswordPage.tsx` — Reset password con `updateUser`

6. `src/v2/ui/templates/AuthenticatedLayout.tsx` — Layout con guard auth, navbar, sidebar

7. `src/v2/ui/templates/PublicLayout.tsx` — Layout per login/reset

**Test:** Auth hook, profile loading, role check, whitelist rejection

**Quality gate:** Login/signup/logout/Google funzionanti. Profilo creato. Ruoli assegnabili. Email non in whitelist → logout immediato. Password reset funzionante.

---

### STEP 4 — Design System v2 + Layout

**Obiettivo:** Libreria componenti tipizzati, tutti sotto 100 LOC, props readonly, zero logica business.

**Deliverable:**

1. **Atomi** (wrappano shadcn/ui con contratti strict):
   - `Button`, `Input`, `Select`, `Badge`, `StatusBadge`, `DataCell`, `EmptyState`, `ErrorMessage`
   - Ogni atomo: interfaccia props readonly, max 80 LOC, documentazione inline

2. **Molecole:**
   - `FormField` — label + input + errore
   - `SearchBar` — input + debounce + clear
   - `ActionToolbar` — barra azioni contestuale
   - `StatCard` — card con numero + label + trend
   - `ConfirmDialog` — modale conferma con azione

3. **Organismi:**
   - `DataTable<T>` — tabella generica tipizzata con sort, filter, pagination, selezione multipla
   - `FormSection` — sezione form con titolo + griglia campi

4. **Template:**
   - `DashboardLayout` — sidebar modulare + header con user info + breadcrumb
   - Sidebar: navigazione per moduli attivi, badge conteggi

5. `src/v2/hooks/useModalManager.ts` — Gestione modale tipizzata con event bus

6. `src/v2/lib/action-registry.ts` — Registro azioni tipizzato (action → handler)

7. `src/v2/ui/pages/DashboardPage.tsx` — Dashboard reale con card navigabili per modulo

**Quality gate:** Tutti i componenti < 100 LOC. Zero `any`. Props readonly. Nessuna logica business in UI.

---

### STEP 5 — Bridge Layer + Handlers

**Obiettivo:** Collegare core e io tramite event bus. Ogni operazione di dominio passa per il bridge.

**Deliverable:**

1. `src/v2/bridge/handlers/partner-bridge.ts`:
   - Ascolta `PartnerCreateRequested` → valida con domain rules → chiama io mutation → emette `PartnerCreated` o `PartnerCreateFailed`
   - Circuit breaker su ogni chiamata IO
   - Logging strutturato

2. `src/v2/bridge/handlers/contact-bridge.ts` — stesso pattern per contatti

3. `src/v2/bridge/handlers/agent-bridge.ts` — stesso pattern per agenti

4. `src/v2/bridge/handlers/campaign-bridge.ts` — stesso pattern per campagne

5. Ogni bridge handler:
   - Sottoscrive eventi dal bus
   - Valida con `core/domain/validators`
   - Chiama `io/supabase/mutations`
   - Emette evento risultato
   - Max 50 LOC per handler

**Test:**
- Bridge integration tests con event bus mock
- Verifica che ogni operazione emetta l'evento corretto
- Verifica circuit breaker trip su errori IO

**Quality gate:** Nessuna funzione IO chiamata direttamente dai hook/UI. Tutto passa per bridge.

---

### STEP 6 — Modulo Network/Partners (primo modulo verticale completo)

**Obiettivo:** Primo modulo funzionale end-to-end seguendo la Perfection Matrix.

**Checklist Perfection Matrix:**

| Fase | Output | Criterio |
|------|--------|----------|
| Definizione | Zod schema partner completo | Nessun campo opzionale senza default |
| Architettura | Grafo dipendenze partner-bridge | Nessun ciclo |
| Logica | Domain rules partner | Testati in isolamento |
| Implementazione | UI < 300 LOC per file | Nessuna query diretta |

**Deliverable:**

1. `src/v2/core/domain/rules/partner-rules.ts` — Regole business:
   - Validazione WCA ID, country code, email, company name
   - Score di completezza partner
   - Regole enrichment

2. Hook: `usePartnersV2`, `usePartnerDetail`, `usePartnerFilters`

3. UI organisms: `PartnerTable` (usa `DataTable<Partner>`), `PartnerDetailDrawer`, `PartnerFiltersPanel`

4. UI page: `NetworkPage.tsx` — lista partner con filtri, ricerca, paginazione, drawer dettaglio

5. Integrazione con bridge: tutte le operazioni CRUD passano per `partner-bridge`

**Test:** Domain rules, hook, filtri, paginazione

**Quality gate:** CRUD partner funzionante. RLS rispettato. Nessuna query diretta in UI. < 300 LOC per file.

---

### STEP 7 — Modulo CRM/Contatti

**Obiettivo:** Secondo modulo verticale — gestione contatti con gruppi, tag, score.

**Deliverable:**

1. `src/v2/core/domain/rules/contact-rules.ts` — Validazione, score completezza, match WCA

2. Hook: `useContactsV2`, `useContactDetail`, `useContactGroups`

3. UI: `ContactTable`, `ContactDetailDrawer`, `ContactGroupsPanel`

4. Page: `CRMPage.tsx`

5. Bridge: `contact-bridge` gestisce CRUD + match WCA + score update

**Quality gate:** Come Step 6 ma per contatti.

---

### STEP 8 — Moduli Outreach + Campagne + Agenti

**Obiettivo:** Tre moduli in un blocco perché interconnessi.

**Deliverable:**

1. **Outreach:** Composer email AI, coda invio, template — `OutreachPage.tsx`
2. **Campagne:** Campaign builder, job queue, pause/resume — `CampaignsPage.tsx`
3. **Agenti:** Cockpit, missioni, chat, 3 fonti conoscenza — `AgentCockpitPage.tsx`

Per ognuno: domain rules, io queries/mutations, bridge handler, hooks, UI organisms, page.

**Quality gate:** Ogni modulo < 300 LOC per file, tutti i flussi end-to-end funzionanti.

---

### STEP 9 — Moduli Secondari + Routing Completo

**Obiettivo:** Completare tutti i moduli rimanenti e il routing v2.

**Deliverable:**

1. `SettingsPage.tsx` — Configurazioni SMTP, LinkedIn, AI, connessioni
2. `DiagnosticsPage.tsx` — Test connessioni + health check registry
3. `ImportPage.tsx` — CSV/Excel wizard
4. `StaffPage.tsx` — Briefing AI + dashboard (placeholder per v2.1)
5. `GlobePage.tsx` — 3D globe (lazy loaded, placeholder per v2.1)

6. `src/v2/routes.tsx` — Routing v2 completo:
   - Tutte le pagine lazy-loaded
   - Guard auth su ogni pagina protetta
   - Guard ruolo su Settings/Admin
   - Breadcrumb e navigazione gerarchica
   - Route `/v2/*` separata da v1

7. Aggiornare `App.tsx`:
   - Aggiungere route `/v2/*` che monta il router v2
   - v1 resta su `/` invariata
   - Feature flag per switchare default

**Quality gate:** Navigazione completa, nessuna pagina raggiungibile senza auth, routing lazy-loaded.

---

### STEP 10 — Audit Finale + Hardening + Documentazione

**Obiettivo:** Portare tutto a quality 100/100.

**Deliverable:**

1. **Lint pass completo** su `src/v2/` — zero warning, zero `any`, zero errori
2. **Build green** con chunk splitting ottimizzato per v2
3. **Test green** — tutti i moduli (core, io, bridge, hooks)
4. **Security scan** su nuove tabelle (`user_roles`)
5. **Chaos testing:** simulare fallimenti IO e verificare circuit breaker + DLQ
6. **Documentazione inline** su ogni file v2
7. **ADR (Architecture Decision Records):** documento con le decisioni architetturali prese
8. Aggiornare `docs/metodo/README.md` con stato reale v2
9. Aggiornare `.lovable/plan.md` con manifesto v2 completato

**Quality gate finale:**
- Zero `any` in tutto `src/v2/`
- Zero `.catch(() => {})` — ogni errore tipizzato e loggato
- Max 300 LOC per file, max 20 righe per funzione
- Ogni operazione IO wrappata in `Result<T>`
- Ogni operazione passa per bridge/event bus
- Tutti i test green
- Security scan clean

---

## Dettagli Tecnici Trasversali

### TypeScript Strict

Non modifichiamo `tsconfig.app.json` per non rompere la v1. Soluzione: **runtime discipline** — ogni file in `src/v2/` rispetta strict rules, enforced tramite:
- ESLint rule `@typescript-eslint/no-explicit-any` su `src/v2/**`
- Review manuale ad ogni step
- Test di integrità che scanna `src/v2/` per occorrenze di `any`

### Pattern IO

Ogni query/mutation ritorna `Result<T>`, MAI throw. Zod schema per validare risposte DB e edge function. Se Zod reject → `Err(IOError({ code: 'SCHEMA_MISMATCH', ... }))`.

### Pattern UI

Componenti < 100 LOC (atomi/molecole) o < 300 LOC (organismi/pagine). Props sempre readonly. Nessuna logica business in UI. Stato negli hook, presentazione nei componenti.

### Naming

Nessun `data`, `temp`, `result`, `info`, `item`, `stuff` come nome variabile. Nomi di dominio sempre: `partner`, `contact`, `campaign`, `agent`, `activity`.

### Ordine DB Migrations

`user_roles` → `has_role function` → aggiornamento trigger `handle_new_user` → RLS policies.

### Coesistenza v1/v2

- v1 resta su `/` — invariata, freeze confermato
- v2 su `/v2/*` — completamente separata
- Condividono solo: Supabase client, database, edge functions
- Quando v2 è completa e testata → v1 deprecata

### Come procederemo

Ogni step viene presentato come blocco completo. Tu approvi, io costruisco tutto il blocco senza fermarmi. Se c'è un'ambiguità architettonica seria, chiedo — altrimenti procedo fino al completamento dello step.

**Primo passo concreto:** Approvato questo piano, parto con lo STEP 1 — Fondazioni TypeScript e Infrastruttura Core.

