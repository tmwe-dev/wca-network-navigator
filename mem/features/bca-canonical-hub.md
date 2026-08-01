---
name: BCA Canonical Hub
description: BCAUnifiedHub è la vista ufficiale dei biglietti da visita; CRM legacy hub e upload UI rimossi
type: feature
---

## BCAUnifiedHub = vista canonica
- Path: `/v2/pipeline/biglietti` (componente `src/components/contacts/bca/BCAUnifiedHub.tsx`)
- Detail panel: `BCAUnifiedDetailPanel` = `BusinessCardDetailPanel` + hero grid 4 azioni intelligenti (Cockpit · Deep Search · LinkedIn · Campagna) come drop target indipendenti.

## Capabilities ufficiali
- Bulk Delete (via `deleteBusinessCards` DAL, intercetta soft-delete trigger).
- Filtro Evento dentro la sidebar globale (`BcaCountrySidebar` → `BCAFiltersRailContent`), pilotato da `useBcaGrouping.eventFilter / setEventFilter / events`.
- Quality Dashboard, Timeline evento, Sync WCA, viste compatta/card/espansa, gruppi per azienda.

## Rimosso definitivamente
- `src/components/contacts/BusinessCardsHub.tsx` (CRM legacy).
- `src/components/contacts/bca/BCAUpload.tsx` (DropZone + useUploadAndParse + dialog evento upload).
- Tab "Biglietti" del CRM (`src/v2/ui/pages/CRMPage.tsx`) — ora redirect a `/v2/pipeline/biglietti` se qualcuno apre `?tab=biglietti`.

## Note
- L'upload manuale di biglietti dall'UI non esiste più. La sincronizzazione avviene tramite `sync-business-cards` edge function (pulsante "Sincronizza" nell'hub). L'edge function `parse-business-card` resta disponibile per altre integrazioni.
- `BusinessCardsView` (Operations) e `BusinessCardsViewV2` (Network) NON sono stati toccati in questo consolidamento.
