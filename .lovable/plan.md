

# WCA Network Navigator — Audit Completo & Piano di Risanamento

## Diagnosi Quantitativa

```text
METRICA                              VALORE        GIUDIZIO
──────────────────────────────────────────────────────────────
Tabelle DB                           72            Troppo — almeno 15 sono ridondanti
Edge Functions                       69            Troppo — 13 già proxificate, ~20 consolidabili
Hook (files)                         ~80           Troppo — 5 sopra 500 LOC
.from() call-sites                   687           Critico — query sparse ovunque
  └─ partners                        76 file       Nessun layer di accesso
  └─ imported_contacts               46 file       Nessun layer di accesso
  └─ download_jobs                   42 file       Nessun layer di accesso
invokeEdge call-sites                124           Sparsi, non centralizzati per dominio
as any                               217           Alto — era 71, cresciuto con nuove feature
invalidateQueries                    216           Cache refresh non governato
app_settings come key-value bag      16 chiavi     Mischia credenziali, config AI, preferenze UI
Fonti KB/prompt concorrenti          7 diverse     Drift garantito
Hook con 3+ dipendenze da altri hook 8             Grafo intrecciato
File UI con query dirette al DB      15+           Business logic nel rendering
Coupling browser-extension           23 file       Troppo profondo
```

## I 5 Problemi Strutturali (ordinati per gravità)

### 1. Nessun Data Access Layer — Query ovunque
`partners` è letta da **76 file diversi**. Ogni hook, componente e pagina fa la propria query con i propri filtri, le proprie invalidazioni cache, e le proprie assunzioni sui campi. Questo è il problema #1 perché genera tutti gli altri: cache incoerente, logica duplicata, impossibilità di refactoring.

### 2. 7 Fonti di Verità per la Conoscenza AI
- `kb_entries` (atomiche + embeddings)
- `operative_prompts` (procedurali)
- `ai_memory` (episodica)
- `ai_sales_knowledge_base` in `app_settings` (monolitica)
- File TypeScript statici (`_shared/prompts/index.ts`)
- Seed nelle migrazioni SQL
- Prompt hardcoded nelle edge functions

L'AI riceve istruzioni diverse a seconda del punto di ingresso (Email Composer vs Cockpit vs Agent). Non c'è audit possibile.

### 3. Hook Giganti che fanno troppo
`useAcquisitionPipeline` (748 LOC, 20 query, 5 dipendenze hook), `useImportLogs` (619), `useLinkedInFlow` (596) — sono mini-applicazioni dentro un hook. Mescolano orchestrazione, query, stato locale, side-effect e logica di business.

### 4. Business Logic nel Layer Sbagliato
15+ componenti UI fanno query dirette al DB. `AddContactDialog`, `ContactListPanel`, `EmailComposer` contengono logica che dovrebbe essere in hook o service. Le edge functions contengono logica di presentazione (HTML formatting). I prompt contengono regole di business.

### 5. app_settings come Contenitore Universale
Credenziali SMTP, password LinkedIn, configurazione RA, preferenze UI — tutto nello stesso key-value store senza validazione, senza tipizzazione, senza separazione di contesto. Modifiche non atomiche.

---

## Piano di Risanamento — 6 Fasi

### Fase 1: Data Access Layer (DAL)
**Obiettivo**: Eliminare le 687 query sparse. Ogni tabella di dominio ha UN SOLO file di accesso.

```text
src/data/
  partners.ts        → findPartners(), getPartner(), updatePartner()
  contacts.ts        → findContacts(), getContact(), upsertContact()
  activities.ts      → findActivities(), createActivity()
  downloadJobs.ts    → findJobs(), createJob(), updateJob()
  messages.ts        → findMessages(), markRead()
  agents.ts          → findAgents(), updateAgent()
```

- Tutti i `.from("partners")` nei 76 file vengono sostituiti con import da `@/data/partners`
- Le invalidazioni cache diventano centralizzate nel DAL
- I filtri comuni diventano funzioni composabili
- Hook come `usePartners()` diventano thin wrapper attorno a `useQuery(queryKeys.partners, () => findPartners(filters))`

### Fase 2: Consolidamento Conoscenza AI → 3 fonti
**Obiettivo**: Da 7 fonti a 3, con contratti chiari.

| Fonte | Ruolo | Chi la legge |
|-------|-------|-------------|
| `kb_entries` | Dottrina, tecniche, regole (RAG) | Tutti gli assistenti via `match_kb_entries` |
| `operative_prompts` | Procedure operative strutturate | `generate-content`, `agent-execute` |
| `ai_memory` | Fatti appresi, preferenze | `unified-assistant` via RAG |

**Eliminare**:
- `ai_sales_knowledge_base` da `app_settings` → migrare contenuti a `kb_entries`
- Prompt TypeScript statici in `_shared/prompts/index.ts` → migrare a `operative_prompts`
- Prompt hardcoded nelle edge functions → estrarre in `operative_prompts`
- Seed SQL → one-time, già migrati

### Fase 3: Decomposizione Hook Giganti
**Obiettivo**: Nessun hook sopra 300 LOC.

| Hook attuale | LOC | Decomposizione |
|---|---|---|
| `useAcquisitionPipeline` | 748 | → `useAcquisitionJobs` + `useAcquisitionStats` + `useAcquisitionActions` |
| `useImportLogs` | 619 | → `useImportLogsList` + `useImportLogActions` |
| `useLinkedInFlow` | 596 | → `useLinkedInJobState` + `useLinkedInActions` + `useLinkedInSync` |
| `useKbEntries` | 574 | → `useKbList` + `useKbMutations` + `useKbSearch` |
| `useDeepSearchLocal` | 548 | → `useDeepSearchState` + `useDeepSearchRunner` |

### Fase 4: Separazione app_settings
**Obiettivo**: Tipizzazione forte, separazione contesti.

```text
app_settings (attuale, 16+ chiavi miste)
  ↓ split in:
  
user_credentials    → smtp_*, linkedin_*, ra_*, whatsapp_*  (encrypted)
ai_config           → tone, style, temperature, model prefs
ui_preferences      → theme, layout, default views
```

Migrazione SQL per spostare le chiavi nelle nuove tabelle. `useAppSettings` diventa 3 hook tipizzati.

### Fase 5: Riduzione Edge Functions 69 → ~35
**Obiettivo**: Ogni dominio ha al massimo 2-3 funzioni.

```text
DOMINIO          ATTUALE                          → TARGET
─────────────────────────────────────────────────────────────
AI Assistants    6 proxy + 3 macro                → 3 macro (rimuovi proxy)
Content Gen      4 proxy + 1 macro                → 1 macro (rimuovi proxy)
AI Utility       3 proxy + 1 macro                → 1 macro (rimuovi proxy)
Email            7 (send, sync, cron, queue...)   → 3 (send, sync, queue)
WCA/Scraping     8 (scrape, login, sync, count..) → 3 (scrape, sync, auth)
LinkedIn         5 (flow, extract, profile...)    → 2 (actions, extract)
Download/Import  5                                → 2 (process, analyze)
Deep Search      3                                → 1 (deep-search)
Agent            2                                → 2 (invariati)
Misc             ~15                              → ~8
```

### Fase 6: Type Safety & CI Gate
- Ridurre `as any` da 217 a < 30 (usando `untypedFrom` + interfacce per le tabelle RA)
- Aggiungere un CI gate: `grep "as any" src/ | wc -l` deve restare sotto soglia
- Test threshold: ogni nuovo DAL file deve avere test unitari
- Lint rule: vietare `.from(` fuori da `src/data/`

---

## Priorità di Esecuzione

```text
FASE    IMPATTO    RISCHIO    EFFORT    ORDINE
──────────────────────────────────────────────
1 DAL      ████████    ██         ████████    ← PRIMO (sblocca tutto)
2 KB       ██████      ███        ██████      ← SECONDO (elimina drift)
3 Hook     ██████      ██         ████        ← TERZO
4 Settings ████        ██         ██          ← QUARTO
5 Edge Fn  ████        ████       ██████      ← QUINTO
6 Types/CI ████        █          ████        ← SESTO
```

**Fase 1 è la chiave**. Senza un DAL, ogni altra modifica continuerà a creare query sparse. Il DAL è il prerequisito per poter potare tutto il resto.

Vuoi che parta dalla Fase 1 (Data Access Layer)?

