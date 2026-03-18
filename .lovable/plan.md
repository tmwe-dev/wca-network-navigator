

## Unificazione Action Bar — Barra Contestuale Unica

### Concetto

Sostituire le due barre azioni separate (BulkActionBar a sinistra + action bar nel dettaglio a destra) con una **singola barra fissa** posizionata nella parte alta della pagina, sopra i due pannelli. Questa barra si adatta al contesto:

- **0 selezionati, nessun partner aperto**: barra nascosta o vuota
- **1 partner aperto (click)**: mostra le azioni per quel partner (Attività, Deep Search, Workspace, Email, Note)
- **N selezionati (checkbox)**: mostra le azioni bulk (N sel. | Attività Diverse, Deep Search, Email Workspace, Email | ✕)
- **Deep Search in corso**: mostra progress bar + Stop

### Layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ [⚡ Attività] [✨ Deep Search] [💼 Workspace] [✉ Email] [📝 Note]  │  ← barra unica
│  2 sel.                                                    [✕ clear]│
├─────────────────────────────┬────────────────────────────────────────┤
│ Lista partner (sinistra)    │ Dettaglio partner (destra)             │
│                             │ (SENZA action bar interna)             │
└─────────────────────────────┴────────────────────────────────────────┘
```

### Modifiche tecniche

#### 1. `src/pages/PartnerHub.tsx` — Nuova barra unificata
- Creare un componente `UnifiedActionBar` (inline o separato) che riceve:
  - `selectedIds: Set<string>` (selezione bulk)
  - `focusedPartnerId: string | null` (partner visualizzato nel dettaglio)
  - Tutte le callback esistenti (onAssignActivity, onDeepSearch, onEmail, onSendToWorkspace)
  - Plus: `onNote` (per il singolo partner)
- Posizionarlo **sopra** il `ResizablePanelGroup`, dopo l'header con i contatori Paesi/Partner
- Logica contestuale:
  - Se `selectedIds.size > 0`: mostra azioni bulk con contatore "N sel." e pulsante clear
  - Se `selectedIds.size === 0 && focusedPartnerId`: mostra azioni singole per il partner aperto
  - Se nessuno dei due: barra nascosta (altezza 0)

#### 2. `src/components/partners/PartnerDetailFull.tsx` — Rimuovere action bar
- Eliminare l'intera sezione "ACTION BAR" (righe 250-300 circa) inclusi i pulsanti Attività, Deep Search, Workspace, Email, Note
- Rimuovere lo stato `showNoteInput` e la textarea delle note dal dettaglio
- Il dettaglio diventa puro contenuto informativo (header + enrichment + profilo + contatti + servizi + dettagli avanzati)
- Rimuovere le props `onAssignActivity`, `onSendToWorkspace`, `onEmail` dal componente

#### 3. `src/components/partners/BulkActionBar.tsx` — Eliminare
- Questo componente viene sostituito dalla barra unificata, può essere rimosso

#### 4. Gestione Note nella barra unificata
- Quando si clicca "Note" in modalità singolo partner, aprire un Dialog (non inline nel dettaglio) con textarea + salvataggio sulla tabella `interactions`
- La logica `handleSaveNote` si sposta nel parent `PartnerHub.tsx`

#### 5. Alert alias mancante
- Nella barra unificata, quando un singolo partner è aperto e manca `enrichment_data` o l'alias, mostrare un piccolo indicatore/badge di warning accanto al bottone Deep Search (es. puntino arancione) per suggerire che serve un arricchimento

### File coinvolti
- `src/pages/PartnerHub.tsx` — barra unificata + gestione note
- `src/components/partners/PartnerDetailFull.tsx` — rimozione action bar e note
- `src/components/partners/BulkActionBar.tsx` — eliminazione file

