

# Audit Performance Apertura Pagine — Risultati e Piano

## Problemi identificati

### 🔴 Collo di bottiglia critico: Dashboard (SuperHome3D)
La Dashboard lancia **~25 query parallele** al mount, molte delle quali ridondanti:

| Hook | Query DB | Note |
|------|----------|------|
| `useCount("partners")` | 1 count | **Duplicata** — già in `fetchOperativeMetrics` |
| `useDailyBriefing` | 1 edge function | Lenta (AI generation, ~2-5s) |
| `useDashboardOperativeMetrics` | **14 count queries parallele** | Pesante ma necessario |
| `useSmartSuggestions` | **6 count queries parallele** | **4 su 6 sono duplicate** rispetto a operativeMetrics |
| `useCockpitContacts` | 5-8 query sequenziali a cascata | **Waterfall**: queue → contacts → partners → social links → activities |
| `useAllActivities` | 1 select all | Carica TUTTE le attività |
| `useDownloadJobs` | 1 select + realtime | OK |
| `useProspectStats` | 1 count | OK |
| `fetchAgentTaskBreakdowns` | 2 query (agents + tasks) | OK ma refetch ogni 60s |
| Onboarding check | `getUser()` network call | **Duplicata** — già fatta in AuthenticatedLayout |

**Totale: ~35 query al primo caricamento della dashboard**

### 🔴 AuthenticatedLayout: doppia verifica auth
- `useAuthV2` chiama internamente `getUser()` (network call ~200ms)
- `useAuth` (AuthProvider) ha già la sessione
- Il check onboarding fa un altro `getUser()` → **3 chiamate auth ridondanti**

### 🟡 `useCockpitContacts`: waterfall seriale
Fa 5 fetch sequenziali (queue → contacts per tipo → partners → social links → activities). Ogni step aspetta il precedente → latenza cumulativa ~1-2s.

### 🟡 `useSmartSuggestions`: query duplicate
4 delle 6 query (agent_tasks proposed, mission_actions proposed, outreach_schedules pending, email_drafts draft) sono **identiche** a quelle già fatte da `fetchOperativeMetrics`.

### 🟡 `useAllActivities`: carica tutto
Carica TUTTE le attività senza filtro, quando la dashboard usa solo il count.

### 🟢 Pages secondarie: OK
Le altre pagine (Network, CRM, Outreach, etc.) sono lazy-loaded e fanno query mirate. Nessun problema strutturale.

---

## Piano di ottimizzazione

### 1. Creare `useDashboardData` — query aggregate
Un unico hook che consolida le 3 fonti dati ridondanti (operativeMetrics + smartSuggestions + counts) in **una singola funzione** con `Promise.all` di tutte le count queries. Elimina ~15 query duplicate.

### 2. Eliminare `getUser()` ridondanti
- Il check onboarding in AuthenticatedLayout già ha accesso al user dalla sessione locale — usare `supabase.auth.getSession()` (locale, 0ms) invece di `getUser()` (network, 200ms)
- `useCount` nella dashboard usa la stessa tabella di operativeMetrics — eliminare

### 3. Lazy-load `useCockpitContacts` nella Dashboard
Il cockpit data è usato solo per il conteggio `readyContacts`. Sostituire con un semplice count query invece di caricare tutti i contatti con waterfall.

### 4. Lazy-load `useAllActivities`  
Usato solo per contare le attività aperte → sostituire con count query `head: true`.

### 5. Defer `useDailyBriefing`
Il briefing è collassato di default (`briefingOpen = false`). Ritardare il fetch fino a quando l'utente apre la sezione, risparmiando ~2-5s di edge function call al load iniziale.

### File modificati

| File | Modifica |
|------|----------|
| `src/v2/hooks/useDashboardData.ts` | **Nuovo** — hook consolidato per Dashboard |
| `src/pages/SuperHome3D.tsx` | Sostituire 5 hook con `useDashboardData`, defer briefing |
| `src/v2/ui/templates/AuthenticatedLayout.tsx` | `getSession()` locale invece di `getUser()` |
| `src/v2/hooks/useSmartSuggestions.ts` | Accettare dati pre-calcolati da `useDashboardData` |

### Risultato atteso
- **Da ~35 a ~16 query** al mount della dashboard
- **Eliminazione waterfall** cockpit (da 5 step seriali a 1 count)
- **-400ms** dall'eliminazione di `getUser()` duplicati
- **-2-5s** dal defer del briefing AI
- Tempo apertura dashboard stimato: da ~4-6s a ~1-2s

