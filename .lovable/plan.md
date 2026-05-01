## Obiettivo

Unificare le tre maschere di dettaglio (BCA, WCA Partner, CRM Contatti) usando come **standard l'esperienza già rifatta nei Biglietti da Visita (BCA)**, e rimuovere i due accessi duplicati ai Biglietti, lasciandone uno solo.

---

## Diagnosi attuale

Oggi le tre aree mostrano lo stesso oggetto (azienda + contatti) con tre layout completamente diversi:

| Area | Pannello dettaglio | Tool disponibili | Bulk | Drag & Drop |
|---|---|---|---|---|
| **CRM › Contatti** (`ContactDetailPanel`) | Compatto, header + stato + 0 interazioni + timeline | Solo Email / WhatsApp / Telefono / Genera Alias | No | No |
| **Network › WCA Partner** (`PartnerDetailCompact`) | Header con bandiera, "X anni WCA", lista contatti del team, Deep | Solo bottone "Deep" + azioni di contatto per riga | No | No |
| **CRM › Biglietti** (`BCAUnifiedDetailPanel` + `BCASmartActions` + `BCABulkActionsPanel` + `BCADragDropOverlay`) | Header ricco, blocco Comunicazione (Email / WA / Chiama / Workspace), blocco AI (Cockpit / Deep Search / LinkedIn / Campagna), timeline, dati Deep Search estesi, drag & drop overlay durante il trascinamento, pannello Bulk dedicato | 8 azioni + Deep Search esteso + Genera Alias | Sì (≥2) | Sì (overlay) |

Inoltre i Biglietti sono raggiungibili da **tre punti**:
1. Tab "Biglietti" nel menu pinnato (`navConfig.tsx` → `nav.business_cards` → `/v2/pipeline/biglietti`)
2. Tab dentro **CRM › Pipeline** (`PipelineSection.tsx`, voce "Biglietti")
3. Toggle **Partner / BCA** dentro **Network** (`OperationsView.tsx` `HeaderBarPortal`, montaggio di `BusinessCardsView`)

---

## Decisioni di design

1. **Unica maschera dettaglio condivisa** (`UnifiedEntityDetailPanel`) basata sul layout già usato in BCA, riusata identica in BCA / Partner / Contatto CRM.
2. **Stessi tool ovunque**, con disabilitazione contestuale solo se mancano i dati (es. WhatsApp grigio se non c'è numero, LinkedIn grigio se non c'è URL):
   - **Comunicazione**: Email · WhatsApp · Chiama · Workspace
   - **AI**: Cockpit · Deep Search · LinkedIn (lookup) · Campagna
3. **Bulk panel condiviso** (`UnifiedBulkActionsPanel`) per selezione ≥2 in tutte e tre le aree.
4. **Drag & drop overlay condiviso** (`UnifiedDragDropOverlay`) attivo durante il trascinamento di una entità verso Cockpit / Deep / LinkedIn / Campagna in tutte e tre le liste.
5. **Accesso Biglietti unico**: rimanere solo il tab pinnato del menu principale. Rimossi:
   - Il tab "Biglietti" dentro `PipelineSection` (rimosso dall'array `TABS` e dalla rotta interna).
   - Il toggle Partner / BCA in Network: la pagina mostra solo i Partner. La rotta `/v2/pipeline/biglietti` resta canonica e usata dal menu.

---

## Architettura tecnica

### Nuovi componenti condivisi (cartella `src/components/shared/entity-panel/`)

- `UnifiedEntityDetailPanel.tsx` — generalizzazione di `BCAUnifiedDetailPanel`. Riceve un adapter `entity` con shape uniforme:
  ```ts
  type UnifiedEntity = {
    kind: "bca" | "partner" | "contact";
    id: string;
    title: string;          // ragione sociale o nome contatto
    subtitle?: string;      // contatto principale o ruolo
    country?: { code: string; city?: string };
    badges?: Array<{ label: string; tone: "info" | "warn" | "success" }>;
    contacts: Array<{ name?: string; role?: string; email?: string; phone?: string; whatsapp?: string; linkedin?: string }>;
    deepSearch?: { ranAt?: string; summary?: string; sources?: string[] };
    timeline?: TimelineEvent[];
    raw: unknown;           // payload originale per le mutation
  };
  ```
- `UnifiedSmartActions.tsx` — i due gruppi (Comunicazione + AI), con stato disabled in base ai dati.
- `UnifiedBulkActionsPanel.tsx` — generalizzazione di `BCABulkActionsPanel`.
- `UnifiedDragDropOverlay.tsx` — generalizzazione di `BCADragDropOverlay` (MIME type per kind).
- `useUnifiedEntityActions.ts` — hook che mappa `kind` → handler corretti (riusa hook già esistenti: `useDirectContactActions`, `useLogAction`, `useDeepSearchRunner`, mutation Cockpit/Campagna).

### Adapter (cartella `src/components/shared/entity-panel/adapters/`)

- `bcaAdapter.ts` — da `BusinessCard` a `UnifiedEntity`.
- `partnerAdapter.ts` — da `Partner` (+ contatti del team) a `UnifiedEntity`.
- `contactAdapter.ts` — da `ContactDetail` a `UnifiedEntity`.

### Wiring sui tre detail container

- `BCAUnifiedDetailPanel.tsx` → diventa thin wrapper che chiama `bcaAdapter` + `<UnifiedEntityDetailPanel/>`.
- `PartnerDetailCompact.tsx` (usato da `OperationsView` quando `networkView === "partners"`) → sostituito dal nuovo wrapper Partner. `PartnerDetailFull.tsx` resta ma viene allineato ad usare lo stesso pannello in versione `dense`.
- `ContactDetailPanel.tsx` → sostituito dal wrapper Contact (mantiene la tab Pipeline/timeline esistente).

### Pulizia accessi Biglietti (3 → 1)

- **`src/v2/ui/pages/sections/PipelineSection.tsx`**:
  - Rimuovere `{ key: "biglietti", … }` dall'array `TABS`.
  - Rimuovere la `<Route path="biglietti" …>` interna.
  - Lasciare solo la redirect a livello router (`/v2/pipeline/biglietti` punta direttamente a `BCAUnifiedHub` in standalone, NON dentro le tab Pipeline).
- **`src/v2/routes.tsx`**: aggiungere `<Route path="pipeline/biglietti" element={guardedPage(BCAUnifiedHub, "BCA")} />` fuori dal `PipelineSection`, così il menu pinnato continua a funzionare e viene mostrato come pagina top-level (con il proprio `GoldenHeaderBar`).
- **`src/components/operations/OperationsView.tsx`**:
  - Rimuovere il toggle Partner/BCA dal `HeaderBarPortal`.
  - Rimuovere il branch `<BusinessCardsView />` e il prop `activeView`.
  - `NetworkPage` resta solo "Partners view".
- Aggiornare i test (`src/v2/test/...`) e `breadcrumbConfig.ts` se referenziano la sotto-tab biglietti.

---

## File toccati

**Nuovi**
- `src/components/shared/entity-panel/UnifiedEntityDetailPanel.tsx`
- `src/components/shared/entity-panel/UnifiedSmartActions.tsx`
- `src/components/shared/entity-panel/UnifiedBulkActionsPanel.tsx`
- `src/components/shared/entity-panel/UnifiedDragDropOverlay.tsx`
- `src/components/shared/entity-panel/useUnifiedEntityActions.ts`
- `src/components/shared/entity-panel/adapters/{bca,partner,contact}Adapter.ts`

**Modificati**
- `src/components/contacts/bca/BCAUnifiedDetailPanel.tsx` (thin wrapper)
- `src/components/contacts/bca/BCASmartActions.tsx` (delega a Unified)
- `src/components/contacts/bca/BCABulkActionsPanel.tsx` (delega a Unified)
- `src/components/contacts/bca/BCADragDropOverlay.tsx` (delega a Unified)
- `src/components/contacts/bca/BCAUnifiedHub.tsx` (usa nuovo wrapper)
- `src/components/partners/PartnerDetailCompact.tsx` (delega a Unified)
- `src/components/partners/PartnerDetailFull.tsx` (densità "full" su Unified)
- `src/components/contacts/ContactDetailPanel.tsx` (delega a Unified)
- `src/components/operations/OperationsView.tsx` (rimosso toggle Partner/BCA)
- `src/v2/ui/pages/sections/PipelineSection.tsx` (rimosso tab Biglietti)
- `src/v2/routes.tsx` (montato `/v2/pipeline/biglietti` standalone)
- `src/v2/ui/templates/breadcrumbConfig.ts` (allineamento label)

---

## Cosa NON viene toccato

- Logica di business (mutation Cockpit, Deep Search, Campagna, soft-delete, holding pattern, lead status guard) — rimane invariata.
- Schema DB e edge function.
- Rotte di redirect legacy verso `/v2/pipeline/biglietti` — continuano a funzionare.
- Filtri rail e contesto globale.

---

## Validazione

1. Build TS pulita.
2. Smoke check delle tre rotte:
   - `/v2/pipeline/biglietti` (menu) → pannello unificato + drag/bulk.
   - `/v2/pipeline/contacts` → pannello unificato con stessi tool, niente tab Biglietti nelle sub-tab.
   - `/v2/explore/network` → solo Partner, niente toggle BCA, dettaglio Partner con stesso layout dei Biglietti.
3. Verifica che disabilitazioni siano corrette (WhatsApp/LinkedIn grigi se assenti).