

# Piano: Layout 2 Colonne Fisso + Download Visibile

## Problemi identificati

1. **Step 1 usa tutta la larghezza con un solo pannello** quando nessun partner e' selezionato. L'utente dice esplicitamente: "Non occupare mai tutta la pagina con un contenitore solo."
2. **Il dettaglio partner appare a sinistra** invece che a destra. L'utente vuole: lista a sinistra, dettaglio a destra.
3. **La sezione download e' nascosta** dentro un `Collapsible` (riga 487-623 di PartnerListPanel). L'utente non la trova. Vuole i controlli download come "tastoni" visibili in alto, non nascosti.

## Soluzione

### 1. Step 1: sempre 2 colonne (Operations.tsx)

```text
┌────────────────────────────┬───────────────────────────┐
│ LEFT (55-60%)              │ RIGHT (40-45%)            │
│ PartnerListPanel           │ PartnerDetailCompact      │
│ (action buttons, barre,   │ (dettaglio partner)       │
│  search, lista partner)   │                           │
│                            │ Se nessun partner:        │
│                            │ placeholder compatto      │
│                            │ con stats/hint            │
└────────────────────────────┴───────────────────────────┘
```

- Invertire le colonne: lista a SINISTRA, dettaglio a DESTRA
- Il pannello destro e' SEMPRE presente (mai full-width singolo)
- Quando nessun partner selezionato: il pannello destro mostra un riepilogo compatto (stats dei paesi selezionati, job attivi, hint "Seleziona un partner")
- Quando partner selezionato: mostra PartnerDetailCompact

### 2. Download visibile come "tastoni" (PartnerListPanel.tsx)

- **Rimuovere il Collapsible** che wrappa la sezione download (righe 487-623)
- **Aggiungere un quinto ActionButton** nella griglia dei "tastoni" (riga 447) per "Scarica Profili" con conteggio dei mancanti, oppure trasformare il pulsante "Profili" esistente per includere direttamente le opzioni download
- I 3 toggle chips (Nuovi / No profilo / Tutti) diventano visibili direttamente sotto i tastoni, come una riga di chip sempre presente
- Il delay slider e il bottone "Scarica N partner" restano inline, visibili senza dover aprire nulla
- Terminal e JobMonitor compatti restano sotto, visibili solo quando ci sono job attivi (non dentro un collapsible)

### 3. Griglia tastoni aggiornata

```text
Riga tastoni (grid-cols-5 o grid-cols-4 con download integrato):
┌──────────┬──────────┬──────────┬──────────┐
│ Scarica  │ Deep     │ Alias    │ Alias    │
│ Profili  │ Search   │ Azienda  │ Contatto │
│ (12)     │ (45)     │ (30)     │ (28)     │
└──────────┴──────────┴──────────┴──────────┘

Sotto: [Nuovi(5)] [No profilo(12)] [Tutti(50)] | Delay: 15s | [▶ Scarica 12]
```

Il click sul tasto "Scarica Profili" non apre un collapsible, ma evidenzia la riga di opzioni download che e' gia' visibile sotto.

## File modificati

1. **`src/pages/Operations.tsx`**
   - Step 1: layout sempre a 2 colonne (LEFT: PartnerListPanel ~58%, RIGHT: Detail/placeholder ~42%)
   - Invertire posizione: lista a sinistra, dettaglio a destra
   - Pannello destro: se no partner → placeholder con stats compatte; se partner → PartnerDetailCompact

2. **`src/components/operations/PartnerListPanel.tsx`**
   - Rimuovere `Collapsible` wrapper dalla sezione download
   - Rendere i controlli download (mode chips, delay, bottone avvio) sempre visibili come riga compatta sotto i tastoni
   - Terminal/JobMonitor visibili inline solo quando ci sono job attivi, senza collapsible

