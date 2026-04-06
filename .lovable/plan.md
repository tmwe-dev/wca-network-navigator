

# Allineare struttura CRM a Network: gruppi nella sidebar, lista piatta al centro

## Situazione attuale

```text
NETWORK (come deve essere)              CRM (come è ora)
──────────────────────────              ──────────────────────────
Sidebar SX: lista paesi con checkbox   Sidebar SX: paesi + filtri ✓ (già fatto)
Centro: lista piatta partner           Centro: gruppi come righe espandibili (accordion)
Destra: dettaglio partner              Destra: dettaglio contatto ✓
```

Il CRM mostra i gruppi (SCONOSCIUTA, WCA OLD, HUBSPOT, ecc.) come righe accordion espandibili nel pannello centrale. L'utente deve cliccare su un gruppo, poi sul contatto. Nel Network invece la lista è piatta e filtrata dalla sidebar.

## Piano

### 1. Spostare la selezione dei gruppi (origini) nella sidebar

Nel `FiltersDrawer` → sezione CRM (`CRMFiltersSection`), aggiungere una lista di **origini** (come quella dei paesi) con checkbox, conteggi e ricerca. I dati vengono dal hook `useContactGroupCounts` che già restituisce i gruppi per tipo "origin". L'utente seleziona una o più origini dalla sidebar e la lista centrale si filtra.

Aggiungere in `GlobalFiltersContext`:
- `crmSelectedOrigins: Set<string>` (se non esiste già come `crmOrigin`)

### 2. Trasformare ContactListPanel da accordion a lista piatta

Eliminare il pattern "GroupStrip + ExpandedGroupContent" e sostituirlo con una **lista piatta di contatti** (come `PartnerVirtualList` nel Network):

- Quando nessun filtro è attivo → mostra tutti i contatti paginati
- Quando paesi/origini selezionati nella sidebar → filtra di conseguenza
- I tab orizzontali in alto restano per segmentare per paese (come già implementato)
- Ogni riga contatto mostra: checkbox, flag, azienda, nome contatto, email/phone icons, badge origine
- Click sulla riga → apre dettaglio a destra (già funziona)

La query usa `useContacts()` con i filtri dal `GlobalFiltersContext` (country, origin, search, holdingPattern).

### 3. Applicare lo stesso pattern a BusinessCardsHub

Il BusinessCardsHub ha già una lista di card, ma deve usare la sidebar per i filtri (evento, match status, paese) invece di averli inline. La struttura diventa:
- Sidebar SX: filtri per evento, match status, paese
- Centro: lista piatta biglietti
- Destra: dettaglio biglietto (già esiste)

### 4. Layout Contacts.tsx → identico a Operations.tsx

```text
┌──────────────────────────────────────────────┐
│  [Contatti] [Biglietti]  [AI Match]          │  ← tab bar (CRM.tsx, invariato)
├──────────────────────────────────────────────┤
│                    │                          │
│   Lista contatti   │   Dettaglio contatto     │
│   (piatta, flat)   │   (pannello destro)      │
│                    │                          │
└──────────────────────────────────────────────┘
```

La sidebar SX è il `FiltersDrawer` globale (già presente), non un pannello resizable separato.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/contacts/ContactListPanel.tsx` | Rimuovere accordion (GroupStrip/ExpandedGroupContent), sostituire con lista piatta di contatti usando `useContacts()` filtrato |
| `src/pages/Contacts.tsx` | Semplificare layout: rimuovere logica filterGroupKey, usare struttura 2-colonne come Operations |
| `src/components/global/FiltersDrawer.tsx` | Sezione CRM: aggiungere lista origini con checkbox (come i paesi) |
| `src/components/contacts/BusinessCardsHub.tsx` | Spostare filtri inline nella sidebar, mantenere lista piatta + dettaglio |

Nessuna migrazione DB. Il dettaglio a destra (template) resta invariato.

