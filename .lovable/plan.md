

# Pulizia Header e Barra — Rimuovere Doppioni, Spostare Elementi

## Situazione attuale

### Header globale (AppLayout)
- **Destra**: 3 icone doppione (Workspace, Email, Agenda) + icona Bot AI → le prime 3 vanno eliminate
- **Centro**: ConnectionStatusBar (barra azzurra con stato connessioni, globo, outreach queue)
- **Sinistra**: Hamburger menu + switch area (CRM/Network)

### Barra interna Operations (Network)
- **Destra**: Bot AI (doppione dell'header) + Sun/Moon (toggle tema, doppione del sidebar)

### Bottom
- **Destra**: Sparkles (IntelliFlow) — resta
- **Sinistra**: ClaudeBadge — resta

## Piano

### 1. Rimuovere i 3 pulsanti doppione dall'header globale
**File**: `src/components/layout/AppLayout.tsx`
- Eliminare i 3 `<Button>` per Workspace, Email, Agenda (righe 149-151)
- Mantenere solo il pulsante Bot AI (riga 152)

### 2. Spostare contenuti della ConnectionStatusBar nell'header
**File**: `src/components/layout/AppLayout.tsx`
- La ConnectionStatusBar (barra azzurra con i 4 pallini di stato connessioni + coda outreach) viene integrata direttamente nell'header, vicino al pulsante AI, guadagnando spazio ora che le 3 icone sono state rimosse
- Lo stile diventa più compatto, inline con l'header, senza barra separata

### 3. Rimuovere toggle tema e Bot dalla barra interna Operations
**File**: `src/pages/Operations.tsx`
- Eliminare il pulsante Sun/Moon (riga 187-189) — il toggle tema è già nel sidebar hamburger
- Eliminare il pulsante Bot AI (riga 184-186) — c'è già nell'header globale

### 4. Trasformare "Cerca paese" in icona + popup
**File**: `src/components/download/CountryGrid.tsx`
- Il campo di ricerca testuale per i paesi diventa un'icona Search
- Click sull'icona → apre un popover/dialog con l'elenco paesi selezionabile
- Libera spazio verticale nella colonna sinistra

## File modificati

| File | Modifica |
|------|----------|
| `src/components/layout/AppLayout.tsx` | Rimuovere 3 icone doppione, integrare ConnectionStatusBar nell'header |
| `src/pages/Operations.tsx` | Rimuovere Bot AI e toggle tema dalla barra interna |
| `src/components/download/CountryGrid.tsx` | Cerca paese → icona + popover |

## Risultato

Header pulito con solo: hamburger, switch area, stato connessioni compatto, pulsante AI. Nessun doppione. Cerca paese compatto come icona.

