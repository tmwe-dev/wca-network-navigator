# 🤖 Diario di Bordo — Claude Engine V8

## Architettura API Centralizzata

Tutto il sistema WCA ora passa per **un unico file API**: `src/lib/api/wcaAppApi.ts`

### File creati/aggiornati:

| File | Ruolo |
|------|-------|
| `src/lib/api/wcaAppApi.ts` | **CLIENT CENTRALIZZATO** — tutte le chiamate a wca-app.vercel.app |
| `src/hooks/useWcaAppDownload.ts` | Download client-side (discover→scrape→save) + supporto job server-side |
| `src/hooks/useWcaJobs.ts` | **NUOVO** — Job server-side: start/pause/resume/cancel/status/worker |
| `src/hooks/useWcaEnrich.ts` | **NUOVO** — Enrichment cross-network (17 network WCA) |
| `src/hooks/useWcaVerify.ts` | **NUOVO** — Verifica membro su network specifico |
| `src/hooks/useWcaPartners.ts` | **NUOVO** — Query DB partners + country counts + check IDs server-side |
| `src/lib/api/wcaScraper.ts` | Facade compatibilità (WcaBrowser, ResyncConfigure) — ora importa da wcaAppApi |

---

## API Endpoints disponibili via wcaAppApi.ts

### Base
- `wcaLogin()` → cookie WCA (auto-cache 8min)
- `wcaDiscover(country, page, options?)` → membri per paese
- `wcaDiscoverAll(country, onProgress?)` → TUTTI i membri (tutte le pagine)
- `wcaScrape(wcaIds[])` → scrape profili (SSO auto server-side)
- `wcaSave(profile)` → salva su Supabase

### Job System (server-side worker)
- `wcaJobStart(countries[], options?)` → avvia job download server-side
- `wcaJobPause(jobId)` → pausa
- `wcaJobResume(jobId)` → riprendi
- `wcaJobCancel(jobId)` → cancella
- `wcaJobStatus(jobId?)` → stato (ultimo se omesso)
- `wcaWorkerTrigger(jobId?)` → trigger manuale worker

### Enrichment & Verify
- `wcaEnrich(companyName, networkDomain, options?)` → enrichment cross-network
- `wcaVerify(wcaId, network)` → verifica su network specifico

### Partners DB
- `wcaPartners(options?)` → query DB con filtri
- `wcaCountryCounts()` → conteggi per paese
- `wcaCheckIds(ids[], country?)` → confronto server-side IDs

---

## Come usare i nuovi hook

### useWcaJobs — Download server-side
```tsx
const { job, startJob, pauseJob, resumeJob, cancelJob } = useWcaJobs();

// Avvia download server-side per Italia e Germania
const jobId = await startJob([
  { code: "IT", name: "Italy" },
  { code: "DE", name: "Germany" },
]);

// Il worker gira su Vercel, polling automatico ogni 5s
// job.status → "pending" | "discovering" | "downloading" | "completed" | ...
// job.totalMembers, job.totalScraped, job.currentCountry
```

### useWcaEnrich — Enrichment cross-network
```tsx
const { enrichPartner, enrichSingle } = useWcaEnrich();

// Cerca "ABC Logistics" su TUTTI i 17 network
const results = await enrichPartner("ABC Logistics", 12345);
// results = [{ enriched: true, profile: {...}, foundName: "..." }, ...]

// Oppure su un singolo network
const result = await enrichSingle("ABC Logistics", "lognetglobal.com");
```

### useWcaVerify — Verifica membro
```tsx
const { verify, verifyAll } = useWcaVerify();

// Verifica se ID 12345 esiste su "WCA Projects"
const result = await verify(12345, "WCA Projects");

// Verifica su tutti i network
const results = await verifyAll(12345, ["WCA Projects", "Lognet Global", ...]);
```

### useWcaPartners — Query DB
```tsx
const { searchPartners, loadCountryCounts, checkMissing } = useWcaPartners();

// Cerca partners italiani
const page = await searchPartners({ country: "IT", page: 1 });

// Conteggi per paese (per la mappa)
const counts = await loadCountryCounts();

// Confronto IDs server-side
const { missing, found } = await checkMissing([1001, 1002, 1003], "IT");
```

---

## Nota: Nessun bridge, nessuna Edge Function

Tutte le chiamate vanno direttamente a `https://wca-app.vercel.app/api/`.
Il login SSO è gestito automaticamente dal server. Zero credenziali nel frontend.
