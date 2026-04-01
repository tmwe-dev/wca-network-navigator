

# Ristrutturazione Header e Cockpit — Pulizia Totale

## Problemi dallo screenshot

1. **Header duplicati**: il pulsante `SlidersHorizontal` nell'header (riga 128) duplica la linguetta lilla a sinistra (riga 99-108). Il pulsante `Target` nell'header (riga 148) duplica la linguetta lilla a destra (riga 109-118).
2. **CreditCounter** occupa spazio prezioso nell'header con dati non utili (372 crediti, 228 consumati) — da rimuovere dall'header.
3. **Icone header senza tooltip**: Workspace, Email, Agenda, Bot, Search — nessuna spiega cosa fa al hover.
4. **Search ⌘K in alto a destra** si confonde con la barra AI del Cockpit e il "Cerca contatto" nella ContactStream — 3 campi di ricerca visibili contemporaneamente.
5. **Doppio livello di tab**: il Cockpit ha le tab di navigazione (Cockpit/In Uscita/Attività/Circuito) PIÙ le source tab (Tutti/WCA/Prospect/Contatti/BCA) PIÙ la barra AI — troppi livelli orizzontali.
6. **Linguette sidebar** si sovrappongono agli elementi del contenuto per mancanza di margini.
7. **Card contatto troppo piccola** per la quantità di informazioni che contiene.

## Piano di intervento

### 1. `AppLayout.tsx` — Pulizia header

**Rimuovere**:
- `CreditCounter` dall'header (riga 147) — i crediti restano accessibili solo nelle Impostazioni
- Pulsante `SlidersHorizontal` duplicato dall'header (riga 128) — c'è già la linguetta lilla
- Pulsante `Target` duplicato dall'header (riga 148) — c'è già la linguetta lilla

**Aggiungere tooltip** a tutte le icone rimaste nell'header (Workspace, Email, Agenda, Bot) con testo chiaro in italiano.

**Linguette lilla**: aggiungere `mt-2` o spostare `top-16` → `top-[4.5rem]` per creare margine con l'header ed evitare sovrapposizioni.

### 2. `TopCommandBar.tsx` — Compattare la barra comandi

- **Rimuovere** la barra `Search…` ⌘K dall'header — l'unica search sarà il campo "Cerca contatto" nella ContactStream, e il comando AI nella TopCommandBar
- **Unificare**: le source tab (Tutti/WCA/Prospect etc.) e i controlli vista (card/list) sulla stessa riga, così si risparmia un livello verticale
- **Rimuovere** il pulsante "Test LI" (debug) dalla produzione
- Compattare il layout: source tab a sinistra, toggle vista a destra, barra AI sotto — totale 2 righe invece di 3

### 3. `ContactStream.tsx` — Pulizia barra filtri/selezione

- Compattare la barra di selezione e i pulsanti bulk: quando selectionCount > 0, i pulsanti si mostrano su una riga con wrap, ma con dimensioni uniformi e senza overflow
- Rimuovere il campo "Cerca contatto, azienda..." — la ricerca avviene già nella TopCommandBar (campo AI) che filtra i contatti

### 4. `CockpitContactCard.tsx` — Card più grande e leggibile

- Aumentare padding da `p-3` a `p-4`
- Nome contatto con `text-sm font-semibold` invece di `text-xs`
- Azienda e ruolo con `text-xs` invece di `text-[10px]`
- Icone canali con `w-4 h-4` invece di `w-3.5 h-3.5`
- Dare più spazio verticale tra le righe di informazioni

### 5. `main.css / contenuto` — Margini per linguette sidebar

- Il contenitore `main` ha `mx-[14px]` — verificare che sia sufficiente per non sovrapporsi alle linguette lilla (w-8 = 32px). Aumentare a `mx-[36px]` per garantire clearance.

## File modificati

| File | Cosa |
|------|------|
| `src/components/layout/AppLayout.tsx` | Rimuovere CreditCounter, duplicati sidebar, aggiungere tooltip, fix margini linguette |
| `src/components/cockpit/TopCommandBar.tsx` | Compattare su 2 righe, rimuovere Test LI |
| `src/components/cockpit/ContactStream.tsx` | Rimuovere campo cerca duplicato, compattare bulk actions |
| `src/components/cockpit/CockpitContactCard.tsx` | Card più grande con testo e icone leggibili |

## Risultato

- Header pulito: hamburger + area switch + indicatore processi + status connessioni + 4 icone con tooltip
- Cockpit: 2 righe di controllo (tab + vista | barra AI) invece di 4
- Un solo campo di ricerca visibile (nella barra AI)
- Card contatto più grande e leggibile
- Nessuna sovrapposizione tra linguette e contenuto

