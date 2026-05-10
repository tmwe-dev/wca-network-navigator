# Ripristino selezione partner in Network (allineata a CRM)

## Cosa è rotto oggi

Quando in `/v2/explore/network` apri "Cerca partner" nella sidebar e clicchi un risultato (es. **Transport Management srl**, Italy):

- A destra si apre correttamente il dettaglio.
- Nella sidebar viene impostato il paese del partner (Italy 229 ✓).
- Ma **la riga al centro non compare**: l'elenco resta vuoto con "Seleziona un paese dalla sidebar per vedere i partner".

## Causa identificata

Confrontando con la maschera CRM (che funziona):

- **CRM** (`CRMFiltersSection.tsx`, click su risultato di ricerca): si limita a fare `dispatchEvent("crm-select-contact", { contactId })` e a chiudere il drawer. **Non tocca i filtri**. La lista resta sincronizzata con quello che l'utente ha già scelto.
- **Network** (`NetworkFiltersSection.tsx`, attuale): oltre al `dispatchEvent("network-select-partner", ...)` esegue anche `batchUpdate({ networkSearch: p.company_name, networkSelectedCountries: new Set([p.country_code]) })`.

Il problema è che `EntityListWithDetail` applica un **filtro locale "Holding pattern" con default `exclude`**. Transport Management ha `lead_status = "holding"` (badge "In attesa" visibile nello screenshot), quindi anche se la query DAL la restituisce, il filtro locale la nasconde → lista vuota → la riga non appare.

Stesso pattern romperà ogni partner in holding pattern aperto via ricerca.

## Cosa ripristinare

Riportare il flusso allo stesso modello del CRM, garantendo i tre punti che l'utente chiede ("riga in elenco · dettaglio a destra · filtro in sidebar"):

1. **Click su risultato Cerca partner** in `NetworkFiltersSection.tsx`:
   - Mantiene il `dispatchEvent("network-select-partner", { partnerId })` (apre dettaglio).
   - Mantiene `dispatchEvent("filters-drawer-close")`.
   - Imposta il **paese** del partner come filtro attivo (così la lista mostra quel paese, in linea col comportamento storico).
   - **Rimuove** l'override di `networkSearch` (era la cosa che restringeva la lista al solo nome). Questo evita di "intrappolare" l'utente in una ricerca testuale che non ha digitato.
   - Se il partner è in `holding`, sblocca temporaneamente la lista impostando il filtro holding locale a `include` per quella sessione, così la riga appare. Questo si fa con un piccolo evento `network-list-show-holding` ascoltato da `EntityListWithDetail`.

2. **`EntityListWithDetail.tsx`**:
   - Aggiunge un listener `network-list-show-holding` che, quando ricevuto, forza `holdingFilter = "include"` (senza persisterlo, così la prossima sessione torna al default `exclude`).
   - Nessun'altra modifica di logica.

3. **Nessuna modifica** a:
   - `useWcaPartnersAsCompanies.ts` (DAL e mapping restano invariati).
   - `src/data/partners.ts` (la query `.or(company_name | company_alias | email)` resta).
   - `OperationalContextSelector.tsx`, `AutoPageTitle.tsx`, `BCAUnifiedHub.tsx`, `navConfig.tsx`, `registry.ts` (le modifiche già applicate non sono in causa per questa regressione).

## Risultato atteso

- Cliccando un partner dalla ricerca sidebar:
  - Il **dettaglio** a destra si apre.
  - Il **paese** del partner viene selezionato nei filtri (sidebar mostra il chip Italy ✓).
  - La **riga del partner appare nell'elenco** anche se è in holding pattern.
- Il comportamento è identico a quello che la pagina aveva prima del fix di stamattina.
- Nessuna modifica al backend, agli hook AI, all'auth o ad altri nodi critici (CLASSE: STANDARD).

## File toccati

- `src/components/global/filters-drawer/NetworkFiltersSection.tsx` (rimuovo `networkSearch` dall'override + emetto `network-list-show-holding` se il partner è in holding).
- `src/v2/ui/organisms/EntityListWithDetail.tsx` (aggiungo listener globale che setta `holdingFilter = "include"` senza persistenza).

## Rollback

Reverso entrambi i file via History/revert: due hunk localizzati, nessun effetto irreversibile, nessuna migrazione DB.
