

# Analisi profonda — Apertura pagine lenta (5–10s)

## Diagnosi: 8 colli di bottiglia identificati

### 🔴 Critici (causano i 5-10s percepiti)

**1. Triplo lazy/Suspense annidato per ogni pagina**
Il rendering di `/v2/network` attraversa:
```text
App.tsx Suspense
  └─ V2Routes Suspense
      └─ guardedPage Suspense (PageSkeleton)
          └─ NetworkPage.tsx [V2 wrapper] → Suspense (spinner)
              └─ Network.tsx [V1 wrapper] → Suspense (TabFallback)
                  └─ Operations.tsx (vero contenuto, 329 righe)
```
4 RTT in serie per scaricare i chunk JS. Lo spinner cambia 3 volte = "white screen" lungo. Stesso problema su Dashboard, CRM, Outreach, Contacts.

**2. `queryClient.invalidateQueries()` GLOBALE in `AuthenticatedLayout.tsx:76`**
Senza `queryKey` → invalida TUTTE le query in cache ogni volta che `sessionReady` toggla. Dopo navigazione/refresh si scatena un refetch a cascata di 30+ query. È il "tutto si ricarica da zero".

**3. AnimatePresence `mode="wait"` sull'Outlet** (`AuthenticatedLayout.tsx:336`)
Aspetta che l'animazione exit (150ms) finisca PRIMA di iniziare a montare la nuova pagina → blocca anche lo Suspense fallback. +300ms a ogni navigazione.

**4. Hook globali bloccanti al mount del layout**
`useJobHealthMonitor`, `useWcaSync`, `useOptimusBridgeListener`, `useAiExtractBridgeListener`, `useOutreachQueue`, `useGlobalAutoSync`, `useWcaSession` → tutti partono in parallelo. `useGlobalAutoSync` legge `app_settings`, `useEmailAutoSync` parte un setInterval, `useOutreachQueue` istanzia bridge WA+LI con relativi `chrome.runtime` polling.

**5. Dashboard `useDashboardData` fa 12 query Supabase in parallelo**
Promise.all su 12 `.from(...).count()`. La query più lenta determina TTFB. Una sola lenta a 2s blocca tutta la dashboard.

### 🟡 Secondari

**6. Prefetch ferma al wrapper, non al contenuto vero**
`prefetchRoute("/v2/network")` carica solo `NetworkPage.tsx` (25 righe wrapper), NON `Network.tsx` né `Operations.tsx`. Il prefetch attuale è quasi inutile.

**7. Bundle splitting non ottimale**
`vendor-three-core` + `vendor-three-fiber` + `vendor-three-drei` = 3 chunk in serie per la Dashboard 3D. `framer-motion` separato ma usato sempre.

**8. `motion.div key={pathname}` rimonta tutto ad ogni route**
Forza React a smontare l'intero sub-tree → effetti riavviati anche con cache hit.

---

## Piano di intervento (ordine d'impatto)

### FASE 1 — Quick wins (rischio basso, ~70% del beneficio)

1. **Rimuovere `queryClient.invalidateQueries()` globale** in `AuthenticatedLayout.tsx:76`. Sostituire con invalidate mirato solo all'evento `SIGNED_IN` (non al toggle di sessionReady).

2. **Collassare il triplo wrapper V2→V1→Operations**:
   - Pagine V2 wrapper (`NetworkPage`, `CRMPage`, `OutreachPage`, `DashboardPage`, `ContactsPage`, ecc.) → rimuovere lo Suspense interno; resta solo quello di `guardedPage`.
   - Pagine V1 di passaggio (`Network.tsx → Operations`) → far importare `Operations` direttamente nel routes V2.
   - Risultato: 1 solo Suspense per pagina invece di 3-4.

3. **Estendere `prefetchRoutes.ts` ai contenuti reali**: hover su "Network" → prefetch in catena `NetworkPage` + `Network` + `Operations`. Aggiungere prefetch automatico al primo `requestIdleCallback` per le 4 pagine top: Dashboard, Network, CRM, Outreach.

4. **Rimuovere `mode="wait"` dall'AnimatePresence** sul main outlet. Risparmio 150-300ms per navigazione.

### FASE 2 — Hook background (~15%)

5. **Defer hook background**: avviare `useOutreachQueue`, `useGlobalAutoSync`, `useJobHealthMonitor` in `requestIdleCallback` (1.5s dopo first paint).

6. **Lazy-mount bridge listeners** (`useOptimusBridgeListener`, `useAiExtractBridgeListener`) solo quando il pannello estensioni è aperto.

### FASE 3 — Dashboard (~10%)

7. **1 RPC `get_dashboard_snapshot`** che restituisce JSON unico al posto delle 12 query parallele. 12 RTT → 1.

8. **Lazy-load widget pesanti**: `OperativeMetricsGrid`, `SmartActions`, `AgentStatusPanel` (oggi caricati subito).

### FASE 4 — Bundle (~5%, rischio medio)

9. Unire `vendor-three-*` in un unico chunk (caricato solo dalla dashboard 3D).
10. Spostare `framer-motion` in `vendor-react`.
11. Lazy-import `recharts` solo dentro i widget chart.

---

## Stima impatto cumulativo

| Fix | Risparmio TTI |
|---|---|
| Rimuovi invalidate globale | -1.5s |
| Collassa triplo Suspense | -1.0s |
| Prefetch reale dei contenuti | -0.8s |
| Rimuovi `mode="wait"` | -0.3s |
| Defer hook background | -0.4s |
| RPC dashboard unica | -0.5s |
| **Totale** | **da 5-10s → 0.5-1.5s** |

---

## Domande prima di partire

**A. Scope** — su quali fasi procedere?
- (a) **Solo Fase 1** — quick wins, rischio minimo, ~70% del beneficio. Consigliato come primo step.
- (b) **Fasi 1+2** — aggiunge defer degli hook, ~85%, rischio basso.
- (c) **Fasi 1+2+3** — include nuova RPC Postgres `get_dashboard_snapshot`, ~95%, richiede migration.
- (d) **Tutte le 4 fasi** — massimo impatto, include riorganizzazione bundle (rischio regressione visiva minimo).

**B. Animazione transizione pagine** — preferisci:
- Rimuoverla del tutto (sensazione "app nativa", massima velocità)
- Mantenerla ma senza `mode="wait"` (fade leggero, -150ms)
- Lascio decidere a me (consiglio: rimuovere `mode="wait"`, mantenere fade entry)

Rispondi A+B (es. "a + nativa") e procedo end-to-end.

