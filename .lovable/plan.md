## Obiettivo

Trasformare l'header della sezione **Esplora** in un'unica barra superiore che mostri SEMPRE, in modo dinamico, il contesto della tab attiva (icona/GIF + nome + contatore), eliminando la riga ridondante "Home › Esplora › …" e il menu a tab statico. La navigazione tra WCA Partner, Contatti CRM, Biglietti, Mappa e Sherlock avverrà cliccando direttamente sul titolo (ciclo) o tramite un piccolo cycler a chevron.

Inoltre rinominare la pagina **Deep Search → Sherlock** in tutti i punti di navigazione (breadcrumb e label di pagina), mantenendo il termine tecnico `deep_search` nelle funzionalità di arricchimento (che è cosa diversa).

## Stato attuale

```text
┌─ LayoutHeader (h-11) ─────────────────────────────────────────────┐
│ ☰  StatusPill                          🔔  Operatore  ⋯  ✨        │
└────────────────────────────────────────────────────────────────────┘
┌─ GoldenHeaderBar (h-8)  ← da rimuovere in Esplora ────────────────┐
│ Home › Esplora › Network                                           │
└────────────────────────────────────────────────────────────────────┘
┌─ SectionTabs (h-9)  ← da sostituire con header contestuale ───────┐
│ WCA Partner | Contatti CRM | Biglietti | Mappa | Sherlock          │
└────────────────────────────────────────────────────────────────────┘
┌─ Header interno OperationsView (solo Network) ────────────────────┐
│ 🌐 Network · Partner WCA   👥 12286 partner                         │
└────────────────────────────────────────────────────────────────────┘
```

Solo la pagina Network ha il proprio header con icona + titolo + count. ContactsPage, Biglietti, Mappa, Sherlock NON hanno nulla in alto: il titolo "sparisce" e il breadcrumb "Esplora › Contatti CRM" è ridondante.

## Stato target

```text
┌─ LayoutHeader (h-11) ─────────────────────────────────────────────┐
│ ☰  StatusPill                          🔔  Operatore  ⋯  ✨        │
└────────────────────────────────────────────────────────────────────┘
┌─ ExploreContextHeader (h-10) ← UNICA riga, dinamica ──────────────┐
│ ‹ 🌐 WCA Partner · 12.286 partner ›    [actions slot della pagina] │
└────────────────────────────────────────────────────────────────────┘
```

- Il blocco centrale (icona + titolo + counter) è cliccabile: click avanza alla tab successiva nel ciclo. Le frecce `‹ ›` permettono navigazione esplicita avanti/indietro. Tooltip mostra le tab disponibili.
- Counter dinamico per ogni tab: WCA Partner=#partner, Contatti CRM=#contatti, Biglietti=#biglietti, Mappa=#paesi attivi, Sherlock=nessun counter (mostra livello selezionato).
- Niente più `GoldenHeaderBar` (breadcrumb) né `SectionTabs` in Esplora. Le altre sezioni (Pipeline, Comunica, ecc.) restano invariate per ora.

## Cambiamenti tecnici

### 1. Nuovo componente `ExploreContextHeader.tsx`
Path: `src/v2/ui/templates/explore/ExploreContextHeader.tsx`
- Definisce internamente l'array TABS (key, label, icon, route, useCounter hook).
- Determina la tab attiva da `useLocation()`.
- Espone uno slot `actions` (a destra) usato dalle pagine via React Portal opzionale (id `explore-header-actions`) — pattern già usato per `campaign-header-controls`.
- Click sul titolo → naviga alla tab successiva. Frecce `‹ ›` → prev/next esplicito.
- Counter caricati da hook leggeri esistenti:
  - `useCountryStats()` → totalPartners (già usato in OperationsView)
  - `useContactsCount()` o select count su `contacts` (verifico DAL esistente)
  - Biglietti: query count su `business_cards`
  - Mappa: stesso `useCountryStats`
  - Sherlock: nessun counter

### 2. Modificare `ExploreSection.tsx`
- Rimuovere `<GoldenHeaderBar />` e `<SectionTabs>` per la sezione Esplora.
- Sostituire con `<ExploreContextHeader />` + `<Routes>` diretto.

### 3. Rimuovere header duplicato in `OperationsView.tsx`
- Rimuovere il blocco riga 50-70 (`<Globe /> Network · Partner WCA · {count} partner`) ora che il titolo+count vivono nell'`ExploreContextHeader`.
- Mantenere il bottone Deep Search/Mission in uno slot actions portato sull'header.

### 4. Rinomina "Deep Search" → "Sherlock" nei punti di navigazione
- `src/v2/ui/templates/breadcrumbConfig.ts` riga 52: `"deep-search": "Sherlock"`.
- Verificare eventuali label di tab/sidebar che riferiscono ancora la pagina (non le funzionalità di arricchimento). Lasciare invariate le occorrenze in:
  - `MissionDrawer`, `OracleContextPanel`, `ContextSummary`, `ContactInteractionTimeline`, ecc. (riferiscono l'azione tecnica `deep_search` di arricchimento, non la pagina Sherlock).

### 5. Counter hook condiviso
Path: `src/v2/hooks/useExploreTabCounters.ts`
- Restituisce `{ network, contacts, biglietti, map }` con valori già formattati (`it-IT`).
- Usa React Query con `staleTime: 60_000` per non hammerare il DB.

## Fuori scopo

- Non si tocca la sidebar globale (rail filtri) né le altre sezioni (Pipeline/Comunica/Intelligence).
- Non si modifica la `UnifiedListToolbar` introdotta nelle iterazioni precedenti per le viste lista (filtri/chip).
- Non si rinomina la funzione tecnica `deep_search` di arricchimento partner.

## Rischi & verifiche

- **Counter**: la query count su 12k+ contatti deve essere `head: true, count: 'exact'` per evitare di scaricare righe.
- **Mobile**: header deve restare leggibile <640px → nascondere counter, mostrare solo icona+nome.
- **Persistenza tab**: il "click sul titolo per ciclare" può confondere se la pagina è lenta a caricare → animazione leggera + aria-label esplicito ("Vai a tab successiva: Contatti CRM").
