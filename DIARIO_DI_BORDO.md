# Diario di Bordo — Claude x Lovable

> Registro delle modifiche fatte da Claude sul repo condiviso.
> Lovable: consulta questo file per sapere dove Claude ha operato.

---

## Sessione #1 — 24 Marzo 2026

### File creati (tutti NUOVI):

| File | Scopo |
|------|-------|
| `src/lib/wca-app-bridge.ts` | Client API verso le API Vercel di wca-app (login, discover, scrape, save) |
| `src/lib/localDirectory.ts` | Directory locale in localStorage per confronto istantaneo zero-query |
| `src/hooks/useWcaAppDownload.ts` | Hook React per download WCA con ripresa, delay pattern, jobs sospesi |
| `src/components/system/ClaudeBadge.tsx` | Badge visivo "Claude Engine" fisso in basso a sinistra |

### File modificati:

| File | Modifica |
|------|----------|
| `src/components/layout/AppLayout.tsx` | Aggiunto import e render di `<ClaudeBadge />` |

---

## Sessione #2 — 24 Marzo 2026

### File modificati:

| File | Modifica |
|------|----------|
| `src/hooks/useDownloadEngine.ts` | RISCRITTO V7->V8: usa wca-app Vercel API al posto delle Edge Functions Supabase |

---

## Sessione #3 — 24 Marzo 2026

### File modificati:

| File | Modifica |
|------|----------|
| `src/hooks/useDownloadEngine.ts` | Login semplificato: wca-app.vercel.app/api/login con body vuoto (credenziali server-side) |

---

## Sessione #4 — 24 Marzo 2026

### Operazione: Deprecazione sistema download legacy

| File | Azione |
|------|--------|
| `src/hooks/useWcaSession.ts` | Riscritto: non usa piu estensione Chrome, testa via wca-app |
| `src/hooks/useWcaAppFallback.ts` | Deprecato: redirect a useWcaAppDownload |
| `src/lib/api/wcaAppBridge.ts` | Deprecato: redirect a lib/wca-app-bridge.ts |
| `src/lib/wcaCredentials.ts` | Deprecato: mantenuto backward compat |
| `src/components/download/WcaSessionIndicator.tsx` | Aggiornato tooltip |

---

## Sessione #5 — 24 Marzo 2026

### INTEGRAZIONE COMPLETA Claude Engine V8

Analisi approfondita di tutto il codebase (220+ componenti, 57 hooks, 45 tabelle DB) e implementazione integrazione completa.

### File RISCRITTI:

| File | Modifica |
|------|----------|
| `src/hooks/useDownloadEngine.ts` | FIX CRITICO: getWcaCookie() ora usa login diretto wca-app (rimosso fetchWcaCredentials) |
| `src/lib/api/wcaScraper.ts` | MIGRATO: tutte le funzioni (scrapeWcaPartnerById, previewWcaProfile, scrapeWcaDirectory) ora usano wca-app bridge invece di Edge Functions Supabase |
| `src/components/download/ActiveJobBar.tsx` | Rimosso warning "Estensione mancante", aggiunto badge "Claude V8" |
| `src/components/settings/ConnectionsSettings.tsx` | Rimossi campi username/password WCA manuali, sostituiti con stato login automatico |
| `src/components/onboarding/StepWCA.tsx` | Rimossi campi credenziali, sostituiti con verifica connessione automatica |
| `src/pages/Diagnostics.tsx` | Aggiunta sezione "Claude Engine V8" (test bridge, login, cookie locale) |
| `src/components/layout/AppLayout.tsx` | Handler AI: aggiunto case "start_download_job" per notificare utente e navigare a Network |
| `src/data/agentTemplates.ts` | Aggiornato prompt agente Download con riferimenti a Claude Engine V8 e wca-app |
| `src/components/system/ClaudeBadge.tsx` | Aggiornato con lista completa moduli V8 attivi |

### Architettura download DEFINITIVA:

```
TUTTO IL DOWNLOAD USA:
  wca-app.vercel.app/api/login   → Login SSO (credenziali server-side)
  wca-app.vercel.app/api/discover → Scan directory per paese
  wca-app.vercel.app/api/scrape  → Profilo singolo
  wca-app.vercel.app/api/save    → Salvataggio su Supabase

NON SI USA PIU:
  - Edge Function scrape-wca-partners     (sostituita da wca-app/api/scrape)
  - Edge Function scrape-wca-directory    (sostituita da wca-app/api/discover)
  - Edge Function get-wca-credentials     (credenziali server-side)
  - Estensione Chrome per WCA             (opzionale, non necessaria)
  - Campi username/password WCA nei Settings
```

### Flusso download completo:

1. UI ActionPanel seleziona paese -> scrapeWcaDirectory (ora via bridge)
2. Crea job Supabase con IDs trovati
3. useDownloadEngine.startJob() -> getWcaCookie() -> login wca-app
4. Loop: wcaScrape(id) -> wcaSave(partner) con delay pattern
5. Directory locale aggiornata, circuit breaker attivo
6. UI Lovable mostra progress via download_job_events (invariato)

### AI Agents:

- Tutti gli agenti hanno tool `create_download_job`, `download_single_partner`
- Agente Download ha prompt aggiornato con riferimenti V8
- AppLayout handler gestisce `start_download_job` dall'AI -> notifica + navigazione
- Il job creato dall'AI viene processato dallo stesso engine V8

### File NON toccati (confermato sicuro):

- useDownloadJobs.ts, jobState.ts, jobUpdater.ts (Supabase job tracking)
- useExtensionBridge.ts (usato per LinkedIn e RA, NON per WCA download)
- useLinkedInExtensionBridge.ts, useRAExtensionBridge.ts
- useDeepSearchRunner.ts, useEmailCampaignQueue.ts, useSortingJobs.ts
- Tutti i componenti campaigns/, cockpit/, intelliflow/, agents/
- Tutto src/components/ui/ (shadcn)
- Tutto src/data/ (costanti)
- Nessun file auto-generato Supabase

---
