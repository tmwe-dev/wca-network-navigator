---
name: P4 WCA Bridge Consolidation
description: Consolidamento wca-app bridge — SSOT cookie store, checkpoint gate sugli endpoint user-facing, refresh proattivo
type: feature
---

## P4 — 2026-04-28

### P4.1 — Bridge SSOT
- Verificato: solo `src/lib/api/wcaAppApi.ts` esiste. Nessun `wcaAppBridge.ts` o `wca-app-bridge.ts` legacy.

### P4.2 — Cookie SSOT
- `wcaAppApi.getOrRefreshCookie` ora delega a `wcaCookieStore.getWcaCookie/setWcaCookie`.
- Eliminata duplicazione `localStorage.getItem("wca_session_cookie")` con cache locale separata.
- Memoria + localStorage gestiti unicamente da `wcaCookieStore`.

### P4.3 — Checkpoint Gate
- Nuovo helper `gateAndMark(context)` in `wcaAppApi.ts`: aspetta green-zone (≥20s) e marca la richiesta.
- Applicato a: `wcaDiscover`, `wcaScrape`, `wcaEnrich`, `wcaVerify`.
- ESCLUSI: `wcaJobStart/Pause/Resume/Cancel/Status`, `wcaWorkerTrigger`, `wcaPartners`, `wcaCountryCounts`, `wcaSave`, `wcaCheckIds` (background o non-WCA).
- Esportato `resetCheckpoint()` in `wcaCheckpoint.ts` per test.

### P4.4 — Pre-refresh cookie
- `wcaCookieStore`: aggiunto `REFRESH_MARGIN_MS = 60s`. `EFFECTIVE_TTL_MS = TTL_MS - REFRESH_MARGIN_MS = 7m`.
- `getWcaCookie()` ritorna null se < 1 min al cutoff → caller fa login automatico via `getOrRefreshCookie`.

### Test
- 19/19 verdi (`wcaAppApi.test.ts` + `wca-app-api.test.ts`).
- Aggiunti `resetCheckpoint()` + `clearWcaCookie()/setWcaCookie()` in beforeEach per evitare cross-contamination.

### Constraint
- NO modifica a `useWcaSession.ts` (interfaccia stabile usata da UI).
- NO delete fisica codice (Code Lifecycle Governance).
