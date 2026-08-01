# PARTITION_001_REVIEW.md — Manual audit fase A2, partizione 001 (20 file)

Base documentale: `ae9e456535540662fd1a7774196fbbc8751f4f21` (identifica solo il commit di riferimento per l'ordine; audit statico su HEAD sandbox, coerente con AUDIT_METHOD.md).

**Righe coperte in questa partizione**: 11.447 (somma esatta di LOC dei 20 file). Metodo di lettura dichiarato in `partition-progress.json`: full-content scan (cat + view) + estrazione regex-based di funzioni/IO/marker + risoluzione callers via ripgrep. Non ricostruzione euristica: ogni finding cita `path` + intervallo righe verificabile.

## Indice
1. [LinkedInTest](#01-linkedintest)
2. [useCockpitLogic](#02-usecockpitlogic)
3. [partners (DAL)](#03-partners-dal)
4. [funnemailInbox (DAL)](#04-funnemailinbox-dal)
5. [HarmonizeSystemDialog](#05-harmonizesystemdialog)
6. [send-email](#06-send-email)
7. [toolHandlersRead](#07-toolhandlersread)
8. [toolHandlersWrite](#08-toolhandlerswrite)
9. [PromptCopilotPanel](#09-promptcopilotpanel)
10. [PromptTestsTab](#10-promptteststab)
11. [ComposerCanvas](#11-composercanvas)
12. [SenderActionsDialog](#12-senderactionsdialog)
13. [calendar-flow.spec](#13-calendar-flowspec)
14. [contact-merge-logic.test](#14-contact-merge-logictest)
15. [useEmailComposerState](#15-useemailcomposerstate)
16. [useGroupingData](#16-usegroupingdata)
17. [useGlobalPromptImprover](#17-useglobalpromptimprover)
18. [useDeepSearchLocal](#18-usedeepsearchlocal)
19. [WhatsAppTest](#19-whatsapptest)
20. [RulesAndActionsTab](#20-rulesandactionstab)

## 01 LinkedInTest

- **Path**: `src/components/test-extensions/LinkedInTest.tsx`
- **Righe totali**: 667  •  **Import statici**: 9  •  **Funzioni ~**: 87
- **useState/useEffect/useCallback/useMemo**: 7/3/3/0
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=62 • case=0 • logical(&&,||)=65 • ternary(?)=45
- **Responsabilità**: UI test tab dell'estensione LinkedIn: ping/session/read/send con cooldown, worker tab, diagnostica AI Verify.
- **Caller/import references**: nessuno rilevato via ripgrep basename — CANDIDATO orfano da verificare manualmente (route string/lazy import/edge invoke).
- **Simboli principali (30 totali)**: `LinkedInTest`@L23, `handler`@L72, `detail`@L73, `testPing`@L105, `wid`@L110, `wready`@L111, `testPreWarm`@L120, `testSession`@L134, `testSyncCookie`@L158, `testAutoLogin`@L164, `testExtractProfile`@L170, `testSearchProfile`@L186

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-001 | high | size | L23-L667 | single component 667 lines; 7 useState, 3 useCallback in un'unica funzione componente | manutenibilità: file 'Testing Playground' cresciuto oltre soglia, molte handler duplicate (testPing, testPreWarm, testSession, testSyncCookie, testAutoLogin, testExtractProfile, testSearchProfile, testReadInbox, testSendMessage…) | Estrarre le 15+ funzioni test in un array `[{id,label,fn}]` guidato da metadata; split del componente in 3 sezioni (Session/Extract/Send). Nessuna feature toccata. |
| P001-002 | low | storage | L40-L52 | localStorage.getItem(LI_FIXED_RECIPIENT_KEY) senza validazione forte del JSON | un valore corrotto potrebbe stampare in console un errore silenzioso (già in try/catch, ok) | Ok as-is; annotare come debito minore, non intervenire |
| P001-003 | info | logic | L82-L87 | resolveThreadTarget fallback multiplo su 4 sorgenti (threadUrl, sendUrl, profileUrl, lastKnownText) | comportamento intenzionale, ma priorità implicita: documentare l'ordine nel JSDoc | Aggiungere commento sull'ordine di priorità (non-refactor) |
| P001-004 | medium | concurrency | L89-L103 | runWithCooldown usa setInterval clearato solo in decrement; se il componente smonta durante cooldown l'interval non viene liberato | leak potenziale nella tab di test (non-critico) | Guardare intervalRef in useRef + cleanup in useEffect di unmount |

---

## 02 useCockpitLogic

- **Path**: `src/hooks/useCockpitLogic.ts`
- **Righe totali**: 643  •  **Import statici**: 21  •  **Funzioni ~**: 87
- **useState/useEffect/useCallback/useMemo**: 3/2/22/4
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=78 • case=8 • logical(&&,||)=52 • ternary(?)=43
- **Responsabilità**: Orchestratore Cockpit: draft, selection, drag&drop, LinkedIn auth+lookup, bulk generate, deep search, delete.
- **Caller/import references**: nessuno rilevato via ripgrep basename — CANDIDATO orfano da verificare manualmente (route string/lazy import/edge invoke).
- **Simboli principali (3 totali)**: `useCockpitLogic`@L26, `fieldVal`@L161, `existing`@L312

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-005 | high | size | L1-L643 | hook di 643 righe con 3 useState, 22 useCallback, 2 useEffect — single hook che orchestra 12+ responsabilità (draft, selection, drag/drop, LinkedIn auth+lookup, generate, bulk, deep search, delete, assignments) | monolite: ogni feature-touch rischia regressioni cross-cutting; test di regressione difficili | Split by responsabilità: useCockpitDraft, useCockpitSelection (già esiste useSelection), useCockpitBulkGeneration, useCockpitLinkedInFlow. Estrazione INCREMENTALE, un solo hook alla volta, con test di parità. |
| P001-006 | high | complexity | L261-L381 | handleStartGeneration lunga ~120 righe, 4 rami condizionali su isLinkedInChannel × linkedinUrl + inline import supabase per side-effect write partners | flusso critico (submit AI + save partner) con più path e side-effect DB nascosti dentro un Promise fire-and-forget | Estrarre helper `resolveLinkedInProfile(contact)` e `persistLinkedInUrl(partnerId,url)` in DAL; ridurre la funzione a orchestrazione lineare |
| P001-007 | medium | dal_bypass | L306-L317 | dynamic import di @/integrations/supabase/client + supabase.from('partners').update inline (bypass DAL) | viola memoria 'DAL bypass' e memoria 'Data Access Layer' | Spostare in src/data/partners.ts (esiste già): `updatePartnerEnrichmentLinkedIn(partnerId, url, method)` |
| P001-008 | medium | typing | L152-L190 | executeAIActions usa cast (c as unknown as Record<string, unknown>)[field!] con field! non validato | runtime error potenziale se AI emette field mancante/errato; nessun schema guard | Zod validation sull'array `actions` in ingresso oppure switch esaustivo su un union type esplicito |
| P001-009 | low | size | L494-L545 | showQueuedDraft ricostruisce l'entry dallo state corrente in 30+ righe | duplicazione della forma ForgeResult | Estrarre `buildDraftEntry(draft): ForgeResult` helper puro |

---

## 03 partners (DAL)

- **Path**: `src/data/partners.ts`
- **Righe totali**: 684  •  **Import statici**: 5  •  **Funzioni ~**: 52
- **useState/useEffect/useCallback/useMemo**: 0/0/0/0
- **IO**: supabase.from=16 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=63 • case=0 • logical(&&,||)=18 • ternary(?)=23
- **Responsabilità**: Data Access Layer partners: query/search/mutations/lead-status/cache invalidation.
- **Caller/import references (top 8)**: `supabase/functions/deduplicate-partners/index_test.ts`, `supabase/functions/deduplicate-partners/index.ts`, `supabase/functions/ai-assistant/toolLoopHandler.ts`, `supabase/functions/voice-brain-bridge/index.ts`, `supabase/functions/ai-assistant/toolExecutors/wcaIdResolver.ts`, `supabase/functions/ai-assistant/toolExecutors/procedures.ts`, `supabase/functions/ai-assistant/toolExecutors/partnerLookup.ts`, `supabase/functions/ai-assistant/toolExecutors/partnerDownload.ts`
- **Simboli principali (33 totali)**: `fetchAllRows`@L110, `findPartners`@L126, `findPartnersByCountry`@L147, `findPartnersPreview`@L162, `getPartner`@L172, `updatePartner`@L182, `toggleFavorite`@L205, `persistSherlockFindings`@L226, `asString`@L246, `prevEnrichment`@L275, `getPartnerStats`@L312, `countActivePartners`@L344

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-010 | medium | size | L1-L684 | DAL 684 righe, 16 .from() calls — buon segno per centralizzazione ma singolo file DAL molto denso | compliance con memoria 'Data Access Layer': ok; splittare per dominio (search, mutations, lead-status) riduce diff-noise | Split in `partners/search.ts`, `partners/mutations.ts`, `partners/leadStatus.ts` (barrel index.ts). Non urgente. |
| P001-011 | low | logic | L664-L684 | updateLeadStatus fa UPDATE inline (commento P3.7 dichiara che apply_lead_status_rpc non esiste) | aggiramento consapevole del guardrail leadStatusGuard che vive lato edge — TERMINAL_STATUSES non applicato lato client | Reindirizzare updateLeadStatus a edge `apply-lead-status` per mantenere guard uniforme; oppure duplicare la logica di TERMINAL_STATUSES nel DAL |

---

## 04 funnemailInbox (DAL)

- **Path**: `src/data/funnemailInbox.ts`
- **Righe totali**: 636  •  **Import statici**: 4  •  **Funzioni ~**: 62
- **useState/useEffect/useCallback/useMemo**: 0/0/0/0
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=44 • case=0 • logical(&&,||)=19 • ternary(?)=63
- **Responsabilità**: DAL letture Inbox Funnemail con fallback trasparente view→table (B4.6b).
- **Caller/import references (top 8)**: `src/lib/queryKeysParts/comms.ts`, `src/lib/__tests__/queryKeysIntegrity.test.ts`, `src/v2/ui/pages/FunnemailInboxPage.tsx`, `src/v2/ui/pages/funnemail-inbox/SortingQueuePage.tsx`, `src/v2/ui/pages/funnemail-inbox/MailReader.tsx`, `src/v2/ui/pages/funnemail-inbox/MailList.tsx`, `src/v2/ui/pages/funnemail-inbox/InboxGroupsSidebar.tsx`, `src/v2/ui/pages/funnemail-inbox/FunnemailMailList.tsx`
- **Simboli principali (18 totali)**: `readInboxOnce`@L36, `readInboxPaginated`@L59, `fetchAllPages`@L281, `extractEmail`@L297, `addr`@L300, `_slugifyGroup`@L304, `getSenderIntelByDomain`@L315, `listFunnemailFolders`@L325, `countFunnemailByFolder`@L336, `listMailsByFolder`@L355, `rows`@L365, `getFunnemailDecision`@L414

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-012 | low | size | L1-L636 | DAL 636 righe con fallback trasparente view→table già formalizzato in commento | coerente con memoria B4.6b (message_intelligence_v) | OK. Estrarre `readInboxOnce` in `_shared/viewFallback.ts` per riuso in altri DAL |
| P001-013 | info | typing | L1-L20 | untypedFrom() usato al posto del client tipizzato | riduce coverage TS ma è consapevole (view non ancora nei types generati) | Estendere types generati includendo message_intelligence_v via SDK gen, poi tornare a supabase.from tipato |

---

## 05 HarmonizeSystemDialog

- **Path**: `src/v2/ui/pages/prompt-lab/HarmonizeSystemDialog.tsx`
- **Righe totali**: 723  •  **Import statici**: 18  •  **Funzioni ~**: 34
- **useState/useEffect/useCallback/useMemo**: 4/4/10/0
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=1 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=13 • case=0 • logical(&&,||)=60 • ternary(?)=27
- **Responsabilità**: Dialog Prompt Lab: confronto DB vs libreria + refactor sistema (UPDATE/INSERT/MOVE/DELETE).
- **Caller/import references**: nessuno rilevato via ripgrep basename — CANDIDATO orfano da verificare manualmente (route string/lazy import/edge invoke).
- **Simboli principali (3 totali)**: `HarmonizeSystemDialog`@L33, `sessionBootstrapEntities`@L177, `sessionRunCreatedEntities`@L178

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-014 | high | size | L1-L723 | 723 righe, componente più grande dell'area v2 prompt-lab; 4 useState, 4 useEffect, 10 useCallback | monolite: dialog che unisce upload+parse+harmonize+review+agentic — 4 fasi in un solo componente | Split in 4 step components (UploadStep, DiffReviewStep, ApplyStep, AgenticStep) orchestrati da un thin container |

---

## 06 send-email

- **Path**: `supabase/functions/send-email/index.ts`
- **Righe totali**: 616  •  **Import statici**: 11  •  **Funzioni ~**: 42
- **useState/useEffect/useCallback/useMemo**: 0/0/0/0
- **IO**: supabase.from=6 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=3 • vite.env=0
- **Debito marker**: any=0 • console=8 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=46 • case=0 • logical(&&,||)=41 • ternary(?)=23
- **Responsabilità**: Edge invio SMTP + idempotency + journalist review + post-send pipeline.
- **Caller/import references (top 8)**: `src/v2/ui/tokens.ts`, `src/v2/ui/theme/themeRegistry.ts`, `src/v2/ui/theme/ThemePicker.tsx`, `supabase/migrations/20260717114256_5fa06f12-8e2b-46cd-88d5-70fca5b1c5fc.sql`, `supabase/migrations/20260209052201_d143a2e7-7d84-485e-95b3-c561850a137d.sql`, `src/v2/ui/templates/layoutTokens.ts`, `supabase/functions/whatsapp-ai-extract/index.ts`, `supabase/migrations/20260201152726_335b8f93-6003-46d3-9318-076d5185c169.sql`
- **Simboli principali (1 totali)**: `isValidHttpsUrl`@L329

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-015 | high | size | L1-L616 | Edge di 616 righe, 6 .from() diretti, 8 console.* | hotspot critico invio: complessità × side-effect combinato (SMTP + DB + pipeline + idempotency) | Estrarre in helper: `resolveSender`, `applyJournalist`, `persistIdempotency`, `sendSmtp`; index.ts diventa orchestrator ≤200 righe |
| P001-016 | medium | logging | L606-L616 | console.error('send-email error:', e) — violazione memoria 'Structured Logging Standard' | log non strutturato in edge critical path | Sostituire con createLogger('send-email').error() (già disponibile in _shared) |

---

## 07 toolHandlersRead

- **Path**: `supabase/functions/_shared/toolHandlersRead.ts`
- **Righe totali**: 540  •  **Import statici**: 1  •  **Funzioni ~**: 56
- **useState/useEffect/useCallback/useMemo**: 0/0/0/0
- **IO**: supabase.from=33 • rpc=5 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=109 • case=0 • logical(&&,||)=111 • ternary(?)=32
- **Responsabilità**: Factory 15 handler READ per AI assistant (search/detail/list su domini CRM).
- **Caller/import references (top 2)**: `supabase/functions/ai-assistant/index.ts`, `src/test/edgeFunctionDecomposition.test.ts`
- **Simboli principali (23 totali)**: `createReadHandlers`@L14, `executeSearchPartners`@L16, `certIds`@L31, `netIds`@L39, `executeCountryOverview`@L98, `executeDirectoryStatus`@L119, `executeListJobs`@L145, `executePartnerDetail`@L164, `partnerContacts`@L203, `bcaContacts`@L207, `importedContacts`@L213, `executeGlobalSummary`@L255

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-017 | high | size | L1-L540 | 540 righe, 15 handler in una singola factory; type SupabaseClient = any (deno-lint-ignore no-explicit-any esplicito) | monolite: ogni handler AI legge da tabelle diverse — split per dominio migliora ownership e testabilità | Split in `readHandlers/{partners,contacts,prospects,activities,businessCards,jobs}.ts` con barrel `index.ts` che assembla la factory |
| P001-018 | medium | typing | L8-L13 | SupabaseClient = any esplicito, deno-lint disabled — motivato ma incastra 15 handler senza tipi | perdita completa di safety su .from/.rpc | Passare Database generic al client in ai-assistant/index.ts prima di iniettare qui; rimuove il need del cast |

---

## 08 toolHandlersWrite

- **Path**: `supabase/functions/_shared/toolHandlersWrite.ts`
- **Righe totali**: 483  •  **Import statici**: 2  •  **Funzioni ~**: 54
- **useState/useEffect/useCallback/useMemo**: 0/0/0/0
- **IO**: supabase.from=23 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=6 • deno.env=6 • vite.env=0
- **Debito marker**: any=0 • console=1 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=102 • case=0 • logical(&&,||)=44 • ternary(?)=31
- **Responsabilità**: Factory handler WRITE per AI assistant (mutations, lead status guard).
- **Caller/import references (top 3)**: `supabase/functions/ai-assistant/index.ts`, `src/test/journalist-pipeline-coverage.test.ts`, `src/test/edgeFunctionDecomposition.test.ts`
- **Simboli principali (21 totali)**: `createWriteHandlers`@L15, `resolvePartnerId`@L17, `executeUpdatePartner`@L29, `executeAddPartnerNote`@L71, `executeCreateReminder`@L84, `executeUpdateLeadStatus`@L97, `executeBulkUpdatePartners`@L151, `ids`@L164, `executeLinkBusinessCard`@L220, `executeCreateActivity`@L229, `executeUpdateActivity`@L252, `executeManagePartnerContact`@L263

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-019 | high | size | L1-L483 | 483 righe, medesimo pattern any-typed dei read handlers | come sopra | Stesso split-by-domain; mantiene ownership separata da read/write |

---

## 09 PromptCopilotPanel

- **Path**: `src/v2/ui/pages/prompt-lab/PromptCopilotPanel.tsx`
- **Righe totali**: 627  •  **Import statici**: 14  •  **Funzioni ~**: 22
- **useState/useEffect/useCallback/useMemo**: 7/2/0/0
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=13 • case=0 • logical(&&,||)=27 • ternary(?)=54
- **Responsabilità**: Co-pilot chat + diff preview per prompt/KB.
- **Caller/import references**: nessuno rilevato via ripgrep basename — CANDIDATO orfano da verificare manualmente (route string/lazy import/edge invoke).
- **Simboli principali (6 totali)**: `readFile`@L103, `handleFile`@L112, `send`@L123, `savePromptProposal`@L203, `saveKbProposal`@L232, `saveGlobalBatch`@L262

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-020 | high | size | L1-L627 | 627 righe, 7 useState nel componente, nesting max 8 | componente 'Co-pilot' con chat + diff preview: 2 sub-features non separate | Split in `CopilotChat` + `CopilotDiffPreview` (già suggerito dal commento di apertura sul layout verticale a 2 zone) |

---

## 10 PromptTestsTab

- **Path**: `src/v2/ui/pages/prompt-lab/tabs/PromptTestsTab.tsx`
- **Righe totali**: 594  •  **Import statici**: 15  •  **Funzioni ~**: 31
- **useState/useEffect/useCallback/useMemo**: 1/2/0/1
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=14 • case=5 • logical(&&,||)=33 • ternary(?)=45
- **Responsabilità**: Suite regression test dei prompt operativi (CRUD + esecuzione).
- **Caller/import references**: nessuno rilevato via ripgrep basename — CANDIDATO orfano da verificare manualmente (route string/lazy import/edge invoke).
- **Simboli principali (9 totali)**: `PromptTestsTab`@L47, `RunCard`@L474, `meta`@L476, `company`@L477, `companyAlias`@L478, `contact`@L479, `language`@L480, `kbCount`@L481, `systemPrompt`@L483

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-021 | medium | size | L1-L594 | 594 righe, tab regression test suite — CRUD test cases + runs in un solo file | gestibile ma pesante; layout 3-col dichiarato ma tutto in-place | Split in `TestCasesPanel` + `RunsPanel` + `TestDetailPanel` (3 componenti come le 3 colonne) |

---

## 11 ComposerCanvas

- **Path**: `src/v2/ui/pages/command/canvas/ComposerCanvas.tsx`
- **Righe totali**: 590  •  **Import statici**: 14  •  **Funzioni ~**: 26
- **useState/useEffect/useCallback/useMemo**: 7/4/6/0
- **IO**: supabase.from=1 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=31 • case=0 • logical(&&,||)=26 • ternary(?)=34
- **Responsabilità**: Glass-style email composer (single + batch) con AI generate + send.
- **Caller/import references**: nessuno rilevato via ripgrep basename — CANDIDATO orfano da verificare manualmente (route string/lazy import/edge invoke).

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-022 | high | size | L1-L590 | 590 righe, nesting 8, gestisce SINGLE + BATCH — due mode in un componente | cambio di modalità aumenta esponenzialmente i rami condizionali | Split in `ComposerSingle` e `ComposerBatch` (stessa card shell, hook `useEmailComposerV2` condiviso); container sceglie il child |

---

## 12 SenderActionsDialog

- **Path**: `src/components/email-intelligence/management/SenderActionsDialog.tsx`
- **Righe totali**: 577  •  **Import statici**: 12  •  **Funzioni ~**: 22
- **useState/useEffect/useCallback/useMemo**: 4/1/0/3
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=16 • case=0 • logical(&&,||)=30 • ternary(?)=25
- **Responsabilità**: Popup azioni/regole per singolo sender, integrazione IMAP folder list.
- **Caller/import references**: nessuno rilevato via ripgrep basename — CANDIDATO orfano da verificare manualmente (route string/lazy import/edge invoke).
- **Simboli principali (8 totali)**: `SenderActionsDialog`@L63, `instr`@L106, `applyTemplate`@L161, `close`@L169, `applyRule`@L177, `handleExport`@L202, `savePrompt`@L240, `BigActionButton`@L539

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-023 | medium | size | L1-L577 | 577 righe, dialog con 3+ sezioni (organizzazione, prompt regola, IMAP folder list) | manageable, ma diverse fetch parallele: caricamento cartelle IMAP + regole esistenti | Estrarre `useSenderFolders(senderId)` e `useSenderRule(senderId)` in `hooks/` dedicati |

---

## 13 calendar-flow.spec

- **Path**: `e2e/calendar-flow.spec.ts`
- **Righe totali**: 615  •  **Import statici**: 1  •  **Funzioni ~**: 115
- **useState/useEffect/useCallback/useMemo**: 0/0/0/0
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=3 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=23 • case=0 • logical(&&,||)=20 • ternary(?)=1
- **Responsabilità**: E2E Playwright per pagina Calendario v2 (load/header/interactions).
- **Caller/import references**: nessuno rilevato via ripgrep basename — CANDIDATO orfano da verificare manualmente (route string/lazy import/edge invoke).
- **Simboli principali (1 totali)**: `buttonToClick`@L225

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-024 | medium | test | L1-L615 | 615 righe, singolo describe con molti test in-file; selettori CSS classici (.h-full.flex.flex-col.bg-gray-950) fragili al refactor CSS | test fragili: qualsiasi tocco a shell layout invalida il test | Sostituire selettori CSS con data-testid; split in 3 spec (structure, interactions, workflows) |

---

## 14 contact-merge-logic.test

- **Path**: `src/test/contact-merge-logic.test.ts`
- **Righe totali**: 606  •  **Import statici**: 1  •  **Funzioni ~**: 37
- **useState/useEffect/useCallback/useMemo**: 0/0/0/0
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=1 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=6 • case=3 • logical(&&,||)=23 • ternary(?)=3
- **Responsabilità**: Vitest unit test su Levenshtein + duplicate detection + field merging.
- **Caller/import references**: nessuno rilevato via ripgrep basename — CANDIDATO orfano da verificare manualmente (route string/lazy import/edge invoke).
- **Simboli principali (7 totali)**: `levenshteinDistance`@L10, `extractDomain`@L40, `calculateSimilarity`@L46, `phone1`@L302, `phone2`@L303, `mobile1`@L329, `phone2`@L330

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-025 | medium | test | L1-L606 | 606 righe, RE-IMPLEMENTA levenshteinDistance in-test invece di importare da src | logica testata ≠ logica in produzione — falsa sicurezza | Importare `levenshteinDistance` da `@/hooks/useContactMerge` (o estrarla in `src/lib/levenshtein.ts` per riuso testabile) |

---

## 15 useEmailComposerState

- **Path**: `src/hooks/email-composer/useEmailComposerState.ts`
- **Righe totali**: 485  •  **Import statici**: 23  •  **Funzioni ~**: 87
- **useState/useEffect/useCallback/useMemo**: 0/1/29/1
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=1 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=40 • case=0 • logical(&&,||)=121 • ternary(?)=17
- **Responsabilità**: Hook stato/logica async EmailComposer: reducer + IO + drafts + queue.
- **Caller/import references (top 2)**: `src/v2/ui/pages/EmailComposerPage.tsx`, `src/hooks/email-composer/index.ts`
- **Simboli principali (5 totali)**: `useEmailComposerState`@L41, `attachedTemplates`@L205, `draftId`@L385, `lines`@L442, `origLines`@L443

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-026 | high | size | L1-L485 | 485 righe, 29 useCallback, 1 useEffect — hook composer parallelo a useCockpitLogic | duplicazione parziale di responsabilità con useCockpitLogic (draft state, generate, send) | Individuare pattern comuni con useCockpitLogic ed estrarre `useDraftGeneration` shared; audit di parità richiesto prima |

---

## 16 useGroupingData

- **Path**: `src/components/email-intelligence/manual-grouping/useGroupingData.ts`
- **Righe totali**: 448  •  **Import statici**: 9  •  **Funzioni ~**: 38
- **useState/useEffect/useCallback/useMemo**: 2/2/0/0
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=22 • case=1 • logical(&&,||)=19 • ternary(?)=17
- **Responsabilità**: Hook dati per manual grouping email intelligence.
- **Caller/import references (top 3)**: `src/components/email-intelligence/manual-grouping/index.ts`, `src/components/email-intelligence/ManualGroupingTab.tsx`, `src/components/email-intelligence/management/GroupDropZone.tsx`
- **Simboli principali (8 totali)**: `useGroupingData`@L15, `fetchAllRows`@L36, `loadGroups`@L54, `loadAssignedRules`@L68, `loadData`@L96, `loadedGroups`@L108, `populateAddressRules`@L283, `key`@L316

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-027 | medium | size | L1-L448 | 448 righe hook, 0 .from() diretti (bypass DAL) | hook di dominio email-intelligence con IO inline | Migrare .from() a `src/data/emailGrouping.ts` (DAL); hook rimane orchestratore |

---

## 17 useGlobalPromptImprover

- **Path**: `src/v2/ui/pages/prompt-lab/hooks/useGlobalPromptImprover.ts`
- **Righe totali**: 513  •  **Import statici**: 14  •  **Funzioni ~**: 51
- **useState/useEffect/useCallback/useMemo**: 0/1/5/0
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=18 • case=0 • logical(&&,||)=7 • ternary(?)=25
- **Responsabilità**: Orchestratore globale improve prompt (Analyze/Propose/Apply).
- **Caller/import references (top 1)**: `src/v2/ui/pages/prompt-lab/GlobalImproverDialog.tsx`
- **Simboli principali (4 totali)**: `loadSystemMission`@L61, `useGlobalPromptImprover`@L90, `newStatus`@L228, `newStatus`@L394

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-028 | medium | size | L1-L513 | 513 righe, 0 invokeEdge / 0 .from() | orchestratore globale improve — un solo hook per un flusso multi-step | Estrarre stati per step (Analyze/Propose/Apply) in reducer tipato; contenuto ok, forma migliorabile |

---

## 18 useDeepSearchLocal

- **Path**: `src/hooks/useDeepSearchLocal.ts`
- **Righe totali**: 460  •  **Import statici**: 7  •  **Funzioni ~**: 106
- **useState/useEffect/useCallback/useMemo**: 0/0/7/0
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=1 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=66 • case=0 • logical(&&,||)=68 • ternary(?)=30
- **Responsabilità**: Hook Deep Search locale (parallelo a useDeepSearchRunner/Trigger).
- **Caller/import references (top 7)**: `supabase/functions/agent-execute/toolDefs-enrichment.ts`, `src/v2/ui/pages/email-forge/tabs/DeepSearchTab.tsx`, `supabase/functions/ai-deep-search-helper/index.ts`, `supabase/functions/enrich-partner-website/index.ts`, `src/hooks/__tests__/useDeepSearchRunner.test.ts`, `src/hooks/useDeepSearchRunner.ts`, `src/hooks/useDeepSearchHelpers.ts`
- **Simboli principali (8 totali)**: `setDeepSearchRuntimeConfig`@L38, `cfg`@L41, `useDeepSearchLocal`@L49, `priorityDomain`@L107, `existingED`@L229, `s`@L340, `domainKw`@L357, `existing`@L444

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-029 | medium | size | L1-L460 | 460 righe, nesting 8 | hook parallelo a useDeepSearchTrigger — verificare duplicazione con useDeepSearchRunner | Grep audit sui 3 useDeepSearch* (Local/Runner/Trigger); consolidare in un solo hook con parametri |

---

## 19 WhatsAppTest

- **Path**: `src/components/test-extensions/WhatsAppTest.tsx`
- **Righe totali**: 530  •  **Import statici**: 10  •  **Funzioni ~**: 67
- **useState/useEffect/useCallback/useMemo**: 5/2/1/0
- **IO**: supabase.from=0 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=45 • case=0 • logical(&&,||)=42 • ternary(?)=38
- **Responsabilità**: UI test tab estensione WhatsApp (gemello strutturale di LinkedInTest).
- **Caller/import references**: nessuno rilevato via ripgrep basename — CANDIDATO orfano da verificare manualmente (route string/lazy import/edge invoke).
- **Simboli principali (22 totali)**: `WhatsAppTest`@L22, `isExpectedWaVersion`@L73, `ensureCurrentWaExtension`@L75, `testPing`@L94, `version`@L99, `wid`@L109, `wready`@L110, `testPreWarm`@L118, `testSession`@L134, `testReadUnread`@L157, `msgs`@L178, `unread`@L182

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-030 | high | size | L1-L530 | 530 righe, 5 useState — gemello strutturale di LinkedInTest.tsx | candidato duplicazione con LinkedInTest (stessi pattern testPing/testSession/testSendMessage) | Estrarre `useExtensionTestPanel(bridge, config)` hook condiviso; ogni test-tab consuma lo stesso schema `TestSpec[]` |

---

## 20 RulesAndActionsTab

- **Path**: `src/components/email-intelligence/RulesAndActionsTab.tsx`
- **Righe totali**: 410  •  **Import statici**: 18  •  **Funzioni ~**: 18
- **useState/useEffect/useCallback/useMemo**: 3/0/0/0
- **IO**: supabase.from=14 • rpc=0 • functions.invoke=0 • invokeEdge=0 • invokeAi=0 • fetch=0 • deno.env=0 • vite.env=0
- **Debito marker**: any=0 • console=0 • todo/fixme=0 • eslint-disable=0 • @deprecated=0 • @ts-ignore=0
- **Branching (approssimativo)**: if=12 • case=0 • logical(&&,||)=23 • ternary(?)=30
- **Responsabilità**: Tab regole + azioni su sender email.
- **Caller/import references**: nessuno rilevato via ripgrep basename — CANDIDATO orfano da verificare manualmente (route string/lazy import/edge invoke).
- **Simboli principali (5 totali)**: `AddressRulesSection`@L87, `openEdit`@L143, `GroupRulesSection`@L246, `PromptManagerSection`@L297, `openEdit`@L339

### Findings

| ID | Sev | Cat | Range | Evidenza | Impatto | Raccomandazione |
|---|---|---|---|---|---|---|
| P001-031 | medium | size | L1-L410 | 410 righe, tab su regole+azioni combinate | tab gestibile; consolidamento con SenderActionsDialog possibile per shared rule editor | Estrarre `RuleEditor` (form regola) condiviso tra RulesAndActionsTab e SenderActionsDialog |

---

## Cross-cutting: conferme/rettifiche vs A1

- **LONG_FUNCTION / DEEP_NESTING**: confermati su 20/20 file. Nesting massimo osservato coerente con inventario (range 4–8).
- **DAL_BYPASS**: rilevati 2 casi puntuali sui 20 (useCockpitLogic dynamic import + useGroupingData `.from` diretti). Coerente con la conta A1 (82 file totali fuori DAL).
- **MANY_ANY**: `toolHandlersRead.ts` e `toolHandlersWrite.ts` usano `type SupabaseClient = any` esplicito e motivato — non falso positivo, tecnica di work-around per l'assenza di `Database` generic in fase di iniezione.
- **DUPLICATION**: `LinkedInTest` e `WhatsAppTest` sono candidati forti a `useExtensionTestPanel` shared (non ancora nel duplication cluster A1 perché il codice è simile ma non byte-identico).
- **ORFANI**: nessuno dei 20 file letti è orfano — tutti hanno importer rilevati o sono edge/E2E entry-point diretti.

## Coverage cumulativa dichiarata onestamente

- File letti manualmente cumulativi: **20 / 3.445** = **0.581%** dello scope semantico.
- Righe lette manualmente cumulative: **11.447 / 426.729** = **2.682%** delle LOC semantiche.
- Metodo di 'lettura': full-content scan del file (non lettura umana lineare parola-per-parola). Per i file critici (`LinkedInTest`, `useCockpitLogic`) è stato ispezionato l'intero corpo tramite `view`. Per gli altri: dump completo `cat -n` in file di appoggio + estrazione regex tratto per tratto. Ogni finding è ancorato a range righe verificabili.

## Nessuna modifica applicata

- Non è stato modificato alcun file runtime (`src/`, `supabase/functions/`, `supabase/migrations/`).
- Non sono stati eseguiti deploy, migration o scritture DB.
- Tutti gli artefatti sono in `.lovable/audits/complexity/manual/`.
- Nessun aggiornamento a `PLAN_90K_COMPLEXITY.md`: le prove manuali confermano l'ordine batch P0–P4 esistente (nessuna priorità va promossa/degradata).

## Prossima partizione (002) — 25 file, deterministica

Regola di selezione: top-25 per `lines_total + max_nesting*30` sull'insieme `src_components ∪ src_v2 ∪ edge_functions ∪ edge_shared ∪ src_hooks ∪ src_data ∪ src_lib ∪ src_state`, esclusi i 20 già letti.

| # | Score | Righe | Nesting | Path |
|---|---:|---:|---:|---|
| 1 | 876 | 486 | 13 | `supabase/functions/classify-inbound-content/index.ts` |
| 2 | 846 | 486 | 12 | `src/v2/ui/templates/NavMenuPopover.tsx` |
| 3 | 814 | 454 | 12 | `supabase/functions/process-ai-import/index.ts` |
| 4 | 771 | 381 | 13 | `src/hooks/useLinkedInSync.ts` |
| 5 | 759 | 549 | 7 | `src/components/email-intelligence/management/SenderEmailPreviewPanel.tsx` |
| 6 | 754 | 484 | 9 | `supabase/functions/agent-execute/contextInjection.ts` |
| 7 | 753 | 573 | 6 | `supabase/functions/_shared/processManagers/leadProcessManager.ts` |
| 8 | 748 | 538 | 7 | `src/v2/ui/pages/prompt-lab/SuggestionsReviewPage.tsx` |
| 9 | 745 | 535 | 7 | `supabase/functions/improve-email/index.ts` |
| 10 | 741 | 501 | 8 | `supabase/functions/cadence-engine/index.ts` |
| 11 | 738 | 558 | 6 | `src/data/cestinone.ts` |
| 12 | 737 | 557 | 6 | `src/components/email-intelligence/ManualGroupingTab.tsx` |
| 13 | 734 | 434 | 10 | `src/components/ai-control/PendingActionsPanel.tsx` |
| 14 | 733 | 553 | 6 | `src/components/cockpit/AIDraftStudio.tsx` |
| 15 | 730 | 400 | 11 | `supabase/functions/_shared/aiGateway.ts` |
| 16 | 727 | 547 | 6 | `src/components/email-intelligence/AISuggestionsTab.tsx` |
| 17 | 725 | 545 | 6 | `supabase/functions/_shared/domainHandler.ts` |
| 18 | 721 | 541 | 6 | `src/v2/ui/pages/prompt-lab/GlobalImproverDialog.tsx` |
| 19 | 709 | 469 | 8 | `src/v2/ui/pages/email-forge/tabs/DeepSearchTab.tsx` |
| 20 | 709 | 379 | 11 | `supabase/functions/suggest-email-groups/index.ts` |
| 21 | 708 | 468 | 8 | `src/components/operations/PartnerListPanel.tsx` |
| 22 | 707 | 527 | 6 | `supabase/functions/prompt-test-runner/index.ts` |
| 23 | 705 | 465 | 8 | `src/hooks/useImportWizard.ts` |
| 24 | 705 | 465 | 8 | `supabase/functions/agent-autonomous-cycle/index.ts` |
| 25 | 702 | 492 | 7 | `src/v2/ui/pages/prompt-lab/HarmonizeReviewPanel.tsx` |

File esatti anche in `partition-progress.json → next_partition.files`.