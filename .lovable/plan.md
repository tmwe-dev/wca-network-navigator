

# Piano di Correzione Bug — Multi-Step

## Stato attuale
La precedente sessione ha gia completato:
- `deduct_credits` DB function (atomica)
- `generate-email` auth + SSRF protection
- `consume-credits` usa `deduct_credits` RPC
- `sanitizeSearchTerm` creato e applicato a `useContacts.ts`

## Fase 1 — Critici rimanenti (4 fix)

### 1A. deep-search-partner: auth obbligatoria
File: `supabase/functions/deep-search-partner/index.ts`
- `getUserId` restituisce null se manca auth ma l'esecuzione continua (riga 165-166)
- Fix: se `userId` e null, restituire 401 immediatamente
- Sostituire `consumeCredits` non-atomico (righe 28-49) con chiamata a `deduct_credits` RPC

### 1B. contacts-assistant + ai-assistant + import-assistant: RLS bypass + race condition crediti
Files: 3 edge functions con `supabase = createClient(URL, SERVICE_ROLE_KEY)` a livello di modulo (riga 10-13 in tutte)
- Fix: creare il client service-role solo per operazioni admin specifiche. Per le query dati, creare un client scoped con il JWT dell'utente.
- Sostituire il SELECT+UPDATE crediti con `supabase.rpc("deduct_credits", {...})`
- `import-assistant`: aggiungere consumo crediti (attualmente non ne consuma)

### 1C. SQL injection in ProspectListPanel
File: `src/components/prospects/ProspectListPanel.tsx:65`
- `quickSearch` interpolato in `.or()` senza sanitizzazione
- Fix: applicare `sanitizeSearchTerm()` gia esistente
- Anche `usePartners.ts:62` ha lo stesso problema su `filters.search`

### 1D. HTML injection email
File: `src/components/workspace/EmailCanvas.tsx:114`
- `displayBody.replace(/\n/g, "<br>")` inviato come HTML raw
- Fix: sanitizzare con DOMPurify (gia installato nel progetto) prima dell'invio

## Fase 2 — Bug funzionali Alti (6 fix)

### 2A. AssignActivityDialog: "none" salvato come stringa + resetForm incompleto
File: `src/components/partners/AssignActivityDialog.tsx`
- Riga 94: `assignedTo || null` non cattura "none" perche "none" e truthy
- Fix: `assignedTo === "none" || !assignedTo ? null : assignedTo`
- Riga 120: `resetForm` non resetta `assignedTo` — aggiungere `setAssignedTo("")`

### 2B. Toast successo con 0 email
File: `src/pages/Workspace.tsx:141-150`
- Il catch ignora gli errori, il toast dice "0 email generate con successo"
- Fix: contare solo i successi reali, mostrare toast differenziato (successi/fallimenti)

### 2C. sent_count sovrascritta
File: `supabase/functions/process-email-queue/index.ts:194-196`
- `sent_count: sentCount` sovrascrive il totale cumulativo
- Fix: usare `sent_count = sent_count + sentCount` (SQL increment) o leggere il valore corrente

### 2D. Race condition interaction_count
File: `src/hooks/useContacts.ts:215-226`
- SELECT + UPDATE non atomico
- Fix: creare una DB function `increment_interaction_count` o usare `.rpc()` con un update atomico SQL

### 2E. import-assistant non consuma crediti
File: `supabase/functions/import-assistant/index.ts`
- Aggiungere chiamata a `deduct_credits` RPC dopo la risposta AI

### 2F. useCampaignJobs senza guard
File: `src/hooks/useCampaignJobs.ts:28-43`
- Se `batchId` e null/undefined, recupera TUTTI i campaign jobs
- Fix: aggiungere `enabled: !!batchId`

## Fase 3 — Bug Medi (8 fix)

### 3A. Null crashes (4 punti)
- `ProspectListPanel.tsx:94-95`: `p.company_name.toLowerCase()` — aggiungere `?.`
- `ContactDetailPanel.tsx:183`: `new Date(c.created_at)` — guard con `c.created_at &&`
- `JobCanvas.tsx:117`: `job.city, job.country_name` — usare `job.city || ""` / fallback

### 3B. setState durante render
File: `src/components/campaigns/JobCanvas.tsx:31-35`
- `setNotes/setNotesLoaded/setSelectedTemplates` chiamati durante render
- Fix: spostare in `useEffect`

### 3C. Field nasconde valore 0
File: `src/components/prospects/ProspectListPanel.tsx:293` (o simile)
- `if (!value)` tratta 0 come falsy
- Fix: `if (value == null || value === "")` 

### 3D. Filtri partner mai applicati
File: `src/hooks/usePartners.ts:37-44 vs 49-81`
- `services`, `certifications`, `networks`, `minRating`, `minYearsMember`, `expiresWithinMonths` ignorati
- Fix: aggiungere filtri server-side dove possibile, client-side post-filter per relazioni

### 3E. Tight loop senza delay
File: `src/hooks/useEmailCampaignQueue.ts:134-160`
- Il while loop chiama `invoke` senza delay
- Fix: aggiungere `await new Promise(r => setTimeout(r, 2000))` tra iterazioni

### 3F. retry_count null
File: `supabase/functions/process-email-queue/index.ts:188`
- `item.retry_count + 1` — NaN se null
- Fix: `(item.retry_count || 0) + 1`

### 3G. Supabase .in() senza batching
File: `src/hooks/useActivities.ts:189`
- Array grandi possono superare limiti URL
- Fix: batch in chunks di 100

### 3H. Sanitizzazione search in usePartners
File: `src/hooks/usePartners.ts:62`
- Applicare `sanitizeSearchTerm()` al filtro search

## Fase 4 — Code Quality (rapida)

- Rimuovere import inutilizzati (`parse`, `useDeleteActivities`, `qc` non usato)
- `Portal target` in Campaigns.tsx: aggiungere guard con `document.getElementById` check
- `handleConfirmMapping` in Import.tsx: aggiungere `groupName` alle dipendenze useCallback
- Aggiungere delay tra iterazioni nel processing loop

## Riepilogo esecuzione

| Fase | Fix | Priorita |
|------|-----|----------|
| 1 | 4 critici (auth, RLS, injection) | Immediata |
| 2 | 6 alti (bug funzionali) | Alta |
| 3 | 8 medi (null safety, performance) | Media |
| 4 | 4 code quality | Bassa |

Totale: ~22 fix su ~15 file, piu 1 migrazione DB per `increment_interaction_count`.

