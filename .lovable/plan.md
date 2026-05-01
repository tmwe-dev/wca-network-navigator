# Riprogettazione pannello dettaglio BCA

## Problema attuale
Il pannello destro del dettaglio biglietto presenta **due problemi noti**:

1. **Duplicazione azioni**: i 4 bottoni Cockpit / Deep Search / LinkedIn / Campagna compaiono **due volte**:
   - In alto come griglia grande 2×2 (drop-target per drag & drop)
   - Più in basso come griglia piccola di soli click (sezione "Azioni intelligenti")
2. **Spazio sprecato**: la HERO grid drop-target occupa ~40% del pannello anche quando l'utente non sta trascinando nulla, schiacciando in fondo le info utili (azienda matchata, contatti, timeline) che richiedono scroll.

## Soluzione

### 1. Drop-zone come overlay popup (solo durante drag)
- Eliminare la HERO grid sempre visibile in cima al pannello.
- Quando l'utente **inizia a trascinare** un biglietto dalla lista, comparirà un **overlay fullscreen semi-trasparente** con i 4 grandi target (Cockpit / Deep Search / LinkedIn / Campagna) ben centrati e leggibili.
- L'overlay svanisce automaticamente al rilascio o all'annullamento del drag (Esc o drop fuori target).
- Vantaggio: zero spazio sprecato quando non serve, drop-target enormi e impossibili da sbagliare quando serve.

### 2. Pannello dettaglio riorganizzato (singolo biglietto)
Dall'alto in basso, senza scroll per le info essenziali:

```text
┌─ Header biglietto (nome, ruolo, chip email/tel) ────────┐
├─ COMUNICAZIONE ─────────────────────────────────────────┤
│  [Email]  [WhatsApp]  [Chiama]  [Workspace]            │  ← compatti, una riga
├─ AZIONI AI ────────────────────────────────────────────┤
│  [Cockpit]  [Deep Search]  [LinkedIn]  [Campagna]      │  ← compatti, una riga
├─ AZIENDA MATCHATA ─────────────────────────────────────┤
│  Logo + nome + badge WCA · contatti collegati          │
├─ DETTAGLI BIGLIETTO ───────────────────────────────────┤
│  Evento · Data · OCR confidence · note pulite          │
├─ TIMELINE EVENTI ──────────────────────────────────────┤
│  Ultimi touch (email, WA, deep search, ecc.)           │
└─────────────────────────────────────────────────────────┘
```

I due gruppi **Comunicazione** e **AI** restano visivamente separati ma compatti (righe da 4 bottoni con icona + label, h-8). La griglia HERO viene **rimossa dal layout statico**.

### 3. Pannello dedicato Bulk Actions
Quando l'utente seleziona ≥2 biglietti dalla lista, il pannello destro **cambia layout** e mostra:

```text
┌─ N biglietti selezionati · M aziende uniche ──────────┐
│  [Pulisci selezione]                                   │
├─ AZIONI BULK ─────────────────────────────────────────┤
│  • Aggiungi tutti al Cockpit         [N items]        │
│  • Deep Search batch (solo matchati)  [K eligible]    │
│  • Crea campagna multi-destinatario   [J con email]   │
│  • Esporta CSV                                         │
│  • Elimina selezionati (soft-delete)                  │
├─ ANTEPRIMA SELEZIONE ─────────────────────────────────┤
│  Lista compatta dei biglietti scelti con remove (×)   │
└────────────────────────────────────────────────────────┘
```

Ogni azione mostra un contatore di quanti biglietti ne sono effettivamente eleggibili (es. la Deep Search vale solo per i matchati WCA, la campagna solo per chi ha email).

## Dettagli tecnici (per chi legge il codice)

- **File da modificare**:
  - `src/components/contacts/bca/BCAUnifiedDetailPanel.tsx` — rimuovere la HERO grid, mantenere solo il wrapper.
  - `src/components/contacts/bca/BCADetailPanel.tsx` — riordinare le sezioni nell'ordine sopra; integrare gruppo "Comunicazione".
  - `src/components/contacts/bca/BCASmartActions.tsx` — diventa il **gruppo "AI"** della nuova sezione azioni; nessuna duplicazione.
- **File nuovi**:
  - `BCADragDropOverlay.tsx` — overlay fullscreen attivato dal `dragstart` globale BCA, ascolta `BCA_DRAG_MIME`, renderizza i 4 grandi target con le stesse azioni di `runAction`. Smonta su `dragend`/`drop`.
  - `BCABulkActionsPanel.tsx` — sostituisce il dettaglio quando `selectedBca.size >= 2`.
- **Hook drag globale**: `useBcaDragOverlay()` — listener su `window` per `dragstart`/`dragend` con filtro su `dataTransfer.types.includes(BCA_DRAG_MIME)`.
- **In `BCAUnifiedHub.tsx`**: switch condizionato `selectedBca.size >= 2 ? <BCABulkActionsPanel/> : <BCAUnifiedDetailPanel/>`.
- **Nessuna modifica a logica dati o DAL** — solo riarrangiamento UI e wiring di handler già esistenti.
- **Compatibilità drag & drop esistente**: preservato il contratto `BCA_DRAG_MIME` per non rompere altri consumer.

## Cosa NON viene toccato in questo round
- Logica di matching partner, OCR, timeline backend.
- Lista biglietti a sinistra (compact/grid/expanded).
- Filtri laterali e raggruppamento per azienda.
