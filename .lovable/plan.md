

# Analisi completa: Gestione Contatti, Partner Hub e Sincronizzazione Workspace

## 1. Stato attuale della sincronizzazione

### Flusso dati per origine

```text
ORIGINE              TABELLA SORGENTE        → activities           → Workspace           → generate-email
─────────────────────────────────────────────────────────────────────────────────────────────────────────
WCA (Partner Hub)    partners +               partner_id=UUID       source_type=partner   Legge partners +
                     partner_contacts         source_type=partner   JOIN su partners.*    partner_contacts ✅
                                              source_id=partner.id

Contatti (CSV)       imported_contacts        partner_id=NULL       source_type=contact   Legge imported_
                                              source_type=contact   Fallback su title     contacts ✅
                                              source_id=contact.id

Prospect (RA)        prospects +              ❌ NESSUN PUNTO       source_type=prospect  Legge prospects +
                     prospect_contacts        DI INGRESSO           (codice pronto ma     prospect_contacts ✅
                                                                    nessuna activity
                                                                    viene mai creata)
```

### Problemi identificati

**A. Prospect: pipeline morta**
- Il Workspace filtra per `source_type === "prospect"` (linea 59 di Workspace.tsx), ma **nessuna pagina crea activities con `source_type: 'prospect'`**.
- ProspectCenter (`src/pages/ProspectCenter.tsx`) non ha un AssignActivityDialog.
- Il codice nel generate-email (linee 136-184) per prospect e' pronto ma inutilizzato.

**B. Workspace ContactListPanel: hardcoded su partner data**
- Linee 94-99: la ricerca cerca solo in `a.partners?.company_name`, `a.partners?.city`, ecc.
- Linee 117-118: il raggruppamento usa `a.partners?.country_code || "??"` — per source_type=contact questo restituisce sempre "??" perche' `partners` e' null.
- Linee 200-206: il display usa `activity.partners?.company_alias`, `activity.partners?.enriched_at`, `activity.partners?.website` — tutti null per contatti importati.
- Linea 87: `linkedinMap` cerca solo in `partner_social_links` con `partner_id` — non funziona per contatti.

**C. EmailCanvas: dati mancanti per non-partner**
- Linea 64-66: `partnerId = activity?.partner_id` → null per contatti, quindi `useSocialLinks(null)` non restituisce nulla.
- Linea 241: `partner?.country_code`, `partner?.city`, `partner?.country_name` — tutti null per contatti importati, mostrando "🏳 , ".
- Il fallback a linea 214 (`activity?.title`) funziona parzialmente ma non mostra company/contact info strutturata.

**D. Deep Search nel Workspace: rotto per non-partner**
- Linea 114: `handleDeepSearch` prende `a.partner_id` — null per contatti, quindi la deep search non parte.

### Dimensione file (candidati refactoring)

| File | Righe | Stato |
|------|-------|-------|
| `src/pages/PartnerHub.tsx` | **692** | Troppo grande — mescola lista, filtri, dettaglio, workbench |
| `src/components/contacts/ContactListPanel.tsx` | **620** | Troppo grande — contiene card, group strip, expanded content, AI commands, export logic |
| `supabase/functions/generate-email/index.ts` | **477** | Grande ma coerente — potrebbe splittare prompt building |
| `src/components/contacts/ContactFiltersBar.tsx` | **339** | Moderato — gestibile |
| `src/components/workspace/ContactListPanel.tsx` | **308** | Moderato ma hardcoded su partner |
| `src/pages/Workspace.tsx` | **305** | Moderato — OK |
| `src/components/workspace/EmailCanvas.tsx` | **300** | Moderato — OK |
| `src/components/contacts/ContactDetailPanel.tsx` | **259** | OK |
| `src/pages/HubOperativo.tsx` | **230** | OK |
| `src/hooks/useActivities.ts` | **~170** | OK |

## 2. Piano di refactoring proposto

### Fase 1 — Fix sincronizzazione Workspace per contatti importati

Correggere il `workspace/ContactListPanel.tsx` per leggere i dati corretti in base a `source_type`:
- **Ricerca**: cercare anche in `activity.title` e `activity.description` quando `partners` e' null
- **Raggruppamento**: usare il country dall'`imported_contacts` (memorizzato in description o fetchato da source_id)
- **Display**: mostrare nome/azienda dal title dell'activity con fallback strutturato
- **Deep Search**: disabilitare per source_type !== "partner" (non applicabile)

### Fase 2 — Aggiungere AssignActivityDialog per Prospect

Creare un punto di ingresso nel ProspectCenter per selezionare prospect e creare activities con `source_type: 'prospect'`, completando la pipeline.

### Fase 3 — Refactoring file grandi

**`ContactListPanel.tsx` (620 righe) → 4 file:**
- `ContactCard.tsx` (~80 righe) — componente singola card
- `GroupStrip.tsx` (~80 righe) — header gruppo espandibile
- `ExpandedGroupContent.tsx` (~60 righe) — contenuto gruppo paginato
- `ContactListPanel.tsx` (~400 righe) — logica principale, filtri, AI commands

**`PartnerHub.tsx` (692 righe) → 3 file:**
- `PartnerListSidebar.tsx` (~250 righe) — lista laterale con filtri e cards
- `PartnerCard.tsx` (gia' esiste ma sottoutilizzato)
- `PartnerHub.tsx` (~300 righe) — layout, routing livelli, dettaglio

### Fase 4 — Arricchire activity con metadati sorgente

Aggiungere alla tabella `activities` un campo opzionale `source_meta JSONB` per cacheare i dati essenziali della sorgente (company_name, country, email, city) al momento della creazione. Questo elimina la necessita' di join polimorfici nel Workspace e rende il display immediato.

```sql
ALTER TABLE activities ADD COLUMN source_meta jsonb DEFAULT '{}'::jsonb;
```

Al momento della creazione dell'activity, salvare:
```json
{
  "company_name": "...",
  "contact_name": "...", 
  "email": "...",
  "country": "...",
  "city": "..."
}
```

Questo risolve tutti i problemi di display nel Workspace senza query aggiuntive.

### Ordine di implementazione consigliato

1. **Fase 4** (source_meta) — risolve la radice del problema
2. **Fase 1** (fix Workspace) — usa source_meta per display corretto
3. **Fase 3** (refactoring file) — pulizia codice
4. **Fase 2** (Prospect assign) — completa la pipeline

