

## Analisi Performance — Apertura `/v2` e maschere principali

### Cosa succede quando apri `/v2` (Dashboard) — sequenza reale

```text
1. App.tsx mount
   └─ AuthProvider → getSession() locale (~5ms) → status="authenticated"
2. V2Routes → V2AuthGate → AuthenticatedLayout mount
3. AuthenticatedLayout monta in cascata:
   ├─ 6 Provider annidati (QueryClient, Tooltip, ActiveOperator,
   │  ContactDrawer, DeepSearch, GlobalFilters, Mission) — ~50ms
   ├─ useAuthV2 (secondo hook auth, parallelo a useAuth)
   ├─ useWcaSession (heartbeat WCA)
   ├─ useAiBridgeListener
   ├─ useQuery onboarding.completed → SELECT profiles (~150ms)
   ├─ scheduleIdlePrefetch → precarica 4 chunk (Network, CRM, Outreach, Dashboard)
   └─ BackgroundServices (ritardato a requestIdleCallback ~16ms-2s):
       ├─ useJobHealthMonitor → useDownloadJobs → SELECT download_jobs LIMIT 50
       │  └─ + canale Realtime "download-jobs-realtime-singleton"
       ├─ useWcaSync
       ├─ useOptimusBridgeListener
       ├─ useAiExtractBridgeListener
       ├─ useOutreachQueue
       └─ useGlobalAutoSync:
           ├─ useAutoConnect
           ├─ SELECT app_settings (work hours)
           ├─ setInterval 60s notturno
           └─ useEmailAutoSync (auto-sync IMAP periodico)

4. DashboardPage → SuperHome3D mount, lancia in parallelo:
   ├─ useDashboardData → RPC get_dashboard_snapshot (1 call, ~300-800ms)
   ├─ useDownloadJobs → SELECT download_jobs (duplicata con #3)
   ├─ useDailyBriefing → invokeEdge("daily-briefing")
   │  └─ Edge function → 3-5 secondi (LLM call interna) ⚠️
   └─ Lazy-load 5 widget pesanti:
       ├─ SmartActions
       ├─ OperativeMetricsGrid
       ├─ AgentStatusPanel
       ├─ DashboardCharts → 4 useQuery aggiuntive:
       │  ├─ SELECT activities (ultimi 30gg)
       │  ├─ SELECT activities LIMIT 1000
       │  ├─ SELECT response_patterns
       │  └─ SELECT imported_contacts (lead_score)
       └─ ResponseRateCard → 1 useQuery
   + Recharts (~80kb gzip) caricato a runtime

5. HomeAIPrompt:
   └─ useAppSettings → SELECT app_settings (terza volta in pagina)
```

### Cosa rallenta davvero (in ordine d'impatto)

**🔴 Critico — TTI percepito**

| # | Causa | Costo |
|---|---|---|
| 1 | `useDailyBriefing` invoca edge `daily-briefing` che internamente chiama un LLM. Bloccante per il widget Briefing AI ma il `useQuery` parte subito al mount → satura connessioni e produce loading di 2-5s | **+2000-5000ms** |
| 2 | `DashboardCharts` lancia **4 query separate** invece di una RPC; `activities` LIMIT 1000 senza indice mirato; bundle Recharts ~80kb caricato eagerly nella stessa schermata | **+400-1200ms + 80kb JS** |
| 3 | Onboarding wizard gate: `onboardingLoading` blocca il render dell'Outlet finché `profiles.onboarding_completed` non risponde (anche con cache infinita, primo hit netto) | **+150-400ms** |
| 4 | Doppio sistema auth: `useAuth()` (centrale) + `useAuthV2()` (legacy) montati insieme = 2 listener `onAuthStateChange` + doppia logica di status | **+50-150ms + flicker** |

**🟠 Alto — overhead costante**

| # | Causa | Note |
|---|---|---|
| 5 | `useDownloadJobs` montato **2 volte** (in `BackgroundServices > useJobHealthMonitor` e in `SuperHome3D` direttamente). Il singleton evita il doppio canale Realtime ma la `useQuery` resta duplicata se le `queryKey` divergono | Da verificare |
| 6 | `useAppSettings` chiamato in 3+ punti (HomeAIPrompt, GlobalAutoSync, altri) → 3 SELECT app_settings al primo paint | |
| 7 | `scheduleIdlePrefetch` carica subito 4 grossi chunk (Network/CRM/Outreach/Dashboard inclusi `Operations`, `CRM`, `Outreach` V1) → **+~500-900kb JS** scaricati anche se l'utente non naviga | |
| 8 | 6 Provider innestati + `GlobalFiltersContext` con reducer da 33 filtri → ogni cambio rotta riconcilia tutto | |
| 9 | `setInterval` 60s in `useGlobalAutoSync` per night-pause + `useEmailAutoSync` periodico | Costo basso ma costante |

**🟡 Medio — pagine secondarie (Network/CRM/Outreach)**

- `NetworkPage` → monta `Operations` (329 righe) che usa `useGlobalFilters`, `useDeepSearch`, `useCountryStats`, `usePartner`, `rpcGetDirectoryCounts`, `BusinessCardsView`, `PartnerListPanel`. Al primo accesso: chunk ~200kb + 2-3 query parallele per le country counts.
- `CRMPage` → monta `CRM` (117 righe) lazy-load `AIMatchDialog` + Kanban; `useUrlState` reidrata filtri da URL (sync onMount).
- Entrambe **non hanno Suspense interno** (delegato a `guardedPage`) → durante la transizione l'utente vede `<PageSkeleton />` finché non è pronto **tutto** il chunk + le query del `useEffect` iniziale.
- `useTrackPage("network")` aggiunge una insert in tabella telemetria a ogni navigazione.

### Diagnosi riassuntiva

L'apertura di `/v2` è **lenta principalmente per 3 motivi**:

1. **La Dashboard fa lavoro che non serve subito**: 4 grafici Recharts + briefing AI partono al mount, anche se l'utente molto probabilmente naviga via.
2. **Il prefetch idle è troppo aggressivo**: scarica preventivamente 4 grosse rotte V1 (~500-900kb), competendo con le query attive.
3. **Edge function `daily-briefing` lenta**: un LLM call sincrono dietro `useQuery` con `staleTime` 15min — il primo hit di giornata è devastante.

Le pagine secondarie (Network/CRM/Outreach) sono lente al **primo** accesso perché caricano grossi chunk V1 senza skeleton parziali; dal secondo accesso sono cache-hit.

### Piano d'azione consigliato (in ordine di ROI)

1. **Defer Briefing AI**: spostare `useDailyBriefing` dietro l'apertura del `<Collapsible>` "Briefing AI" (oggi `briefingOpen` esiste ma la query parte comunque). Stima: **-2000ms TTI**.
2. **Defer DashboardCharts + ResponseRateCard**: Intersection Observer / "Mostra grafici" on-demand, oppure `requestIdleCallback`. Stima: **-400ms + -80kb JS iniziali**.
3. **Consolidare le 4 query charts** in un'unica RPC `get_dashboard_charts_snapshot` (pattern già usato per `get_dashboard_snapshot`). Stima: 4 RTT → 1.
4. **Limitare `scheduleIdlePrefetch` a 1-2 rotte** (solo `/v2/network` come hot-path); rimuovere CRM/Outreach dal prefetch globale, lasciandoli all'hover.
5. **Deduplicare auth**: deprecare `useAuthV2` ovunque non serve la `profile.displayName` async; usare solo `useAuth` da `AuthProvider`.
6. **Cache `app_settings` lato client**: una sola `useQuery` con chiave globale, invalidata su update.
7. **Skeleton parziali in NetworkPage/CRMPage**: mostrare grid/header subito, lazy-load i pannelli pesanti (BusinessCardsView, Kanban) con Suspense interno.
8. **`useTrackPage`**: batch + flush su requestIdleCallback invece di insert sincrona.

### Stima impatto cumulato

- **TTI Dashboard**: da ~3-5s percepiti a ~800-1200ms (-70%).
- **JS iniziale**: -80-150kb gzip.
- **Query al primo paint**: da ~12 a ~5.
- **Navigazione tra pagine già visitate**: invariata (già ottimizzata via React Query cache).

