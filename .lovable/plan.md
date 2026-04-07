

# Analisi Gap: Network vs CRM (Contatti + Biglietti da Visita)

## Panoramica

Ho analizzato in profondità le tre sezioni — **Network** (PartnerListPanel + BusinessCardsView), **CRM Contatti** (ContactListPanel) e **CRM Biglietti** (BusinessCardsHub) — confrontando le funzionalità disponibili.

---

## Matrice Funzionalità: cosa c'è e cosa manca

```text
Funzionalità                    Network/Partners  Network/BCA  CRM/Contatti  CRM/Biglietti
──────────────────────────────  ────────────────  ───────────  ────────────  ─────────────
Deep Search (bulk)                   ✅              ✅            ✅            ❌
Deep Search (singolo)                ✅              ✅            ✅            ❌
Ricerca Google Logo                  ✅              ✅            ❌            ✅ (solo detail)
LinkedIn Lookup (bulk)               ❌              ❌            ✅            ❌
Invio Cockpit (bulk)                 ✅              ✅            ✅ (via Job)   ✅
Invio Workspace (bulk)               ✅              ❌            ✅            ❌
Email (singolo/bulk)                 ✅              ✅            ✅            ✅
WhatsApp (singolo/bulk)              ❌              ✅            ❌            ✅
Campagna (bulk)                      ❌              ❌            ✅            ❌
Elimina (bulk)                       ❌              ❌            ✅            ✅ (tramite Hub)
Deduplicazione/Consolidamento        ✅ (Edge Fn)    ❌            ❌            ❌
AI Match (BCA → Partner)             ❌              ❌            ✅ (dialog)   ❌
Generazione Alias (bulk)             ✅              ❌            ❌            ❌
Filtro Holding Pattern               ✅              ✅            ✅            ✅
Filtro per Paese (sidebar)           ✅ (mappa)      ✅ (sidebar)  ✅ (drawer)   ✅ (drawer)
Sync WCA                             ❌              ✅            ❌            ✅
Vista multipla (compact/card/exp)    ❌              ✅            ❌            ✅
```

---

## Gap critici identificati

### 1. Consolidamento/Deduplicazione — ASSENTE nel CRM
- **Network** ha una Edge Function `deduplicate-partners` che raggruppa per `company_name + country_code`, assegna punteggi di completezza e fonde i record duplicati spostando relazioni
- **CRM Contatti e Biglietti**: nessuna funzione di consolidamento. Se hai "ARGUS GLOBAL LOGISTICS" due volte con dati diversi, non puoi fonderli

### 2. Deep Search — ASSENTE nei Biglietti CRM
- **Network/BCA** ha Deep Search tramite `useDeepSearch` che opera sui `partner_id` matchati
- **CRM Contatti** ha Deep Search nella bulk action bar (max 20)
- **CRM Biglietti (Hub)** non ha alcun pulsante Deep Search — né singolo né bulk

### 3. Ricerca Google Logo — ASSENTE nei Contatti CRM
- **Network** e **Biglietti** hanno `googleLogoSearchUrl` per cercare il logo
- **Contatti CRM**: nessun pulsante per cercare il logo dell'azienda

### 4. LinkedIn Lookup — SOLO nei Contatti CRM
- Solo `ContactListPanel` integra `useLinkedInLookup` per la ricerca batch dei profili LinkedIn
- Non disponibile in Network, né in Biglietti

### 5. WhatsApp bulk — SOLO nei Biglietti
- Il bulk WhatsApp è nel BCA Hub e nel BusinessCardsView, ma non nei Contatti CRM né in Network/Partners

### 6. Workspace bulk — ASSENTE nei Biglietti CRM
- Network/Partners ha "Workspace" nella barra bulk
- CRM Contatti ha "Workspace" nella barra bulk
- CRM Biglietti ha solo Cockpit, Email, WhatsApp, Elimina — manca Workspace

### 7. Campagna — SOLO nei Contatti CRM
- Solo `ContactListPanel` ha il pulsante "Campagna" nella bulk bar

---

## Piano di Intervento proposto

### Step 1: Componente Bulk Action Bar unificato
Creare un **unico componente `UnifiedBulkActionBar`** che riceve:
- Il tipo di sorgente (`partner` | `contact` | `business_card`)
- Le azioni disponibili in base al contesto
- I dati dei record selezionati

Tutte le sezioni lo usano. Azioni standardizzate:
- **Cockpit** — sempre disponibile
- **Workspace** — sempre disponibile
- **Email** — se almeno un record ha email
- **WhatsApp** — se almeno un record ha telefono
- **Deep Search** — sempre (opera su partner_id per BCA, su contact_id per contatti)
- **LinkedIn Lookup** — se estensione disponibile
- **Google Logo** — se almeno un record ha company_name
- **Campagna** — sempre disponibile
- **Elimina** — sempre disponibile (con conferma)

### Step 2: Consolidamento AI per Contatti CRM
Riutilizzare la logica di `deduplicate-partners` in una nuova **Edge Function `deduplicate-contacts`**:
- Raggruppa per `company_name` normalizzato (lowercase, trim)
- Punteggio di completezza (email, telefono, LinkedIn, enrichment)
- Mantiene il record più ricco, sposta le interazioni e fonde i dati
- UI: pulsante "Consolida duplicati" nella bulk bar quando 2+ selezionati hanno lo stesso nome azienda, oppure un pulsante globale "Trova duplicati" nell'header

### Step 3: Deep Search nei Biglietti CRM
Aggiungere `useDeepSearch` al BusinessCardsHub:
- Per i biglietti matchati: opera sul `partner_id`
- Per i non matchati: prima tenta il match, poi opera
- Pulsante nella bulk bar + pulsante nel detail panel

### Step 4: Google Logo nei Contatti CRM
Aggiungere il pulsante "Cerca logo Google" nel detail panel dei contatti e nella bulk bar

### Step 5: LinkedIn Lookup ovunque
Estendere `useLinkedInLookup` a Network/Partners e ai Biglietti

---

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/shared/UnifiedBulkActionBar.tsx` | **Nuovo** — Componente bulk bar standardizzato |
| `src/components/contacts/ContactListPanel.tsx` | Sostituire bulk bar con `UnifiedBulkActionBar`, aggiungere Google Logo |
| `src/components/contacts/BusinessCardsHub.tsx` | Sostituire `BCABulkActionBar` con `UnifiedBulkActionBar`, aggiungere Deep Search + Workspace + LinkedIn + Campagna |
| `src/components/operations/PartnerListPanel.tsx` | Sostituire selezione bar con `UnifiedBulkActionBar`, aggiungere LinkedIn + WhatsApp + Campagna |
| `src/components/operations/BusinessCardsView.tsx` | Aggiungere Workspace + LinkedIn + Campagna nella bulk bar |
| `supabase/functions/deduplicate-contacts/index.ts` | **Nuovo** — Edge Function consolidamento contatti |
| `src/components/contacts/ContactDetailPanel.tsx` | Aggiungere pulsante Google Logo |

Migration SQL per `deduplicate-contacts` — nessuna nuova tabella, opera su `imported_contacts` esistente.

