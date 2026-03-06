

## Analisi: dove vengono mostrati i cestini di importazione

### Stato attuale

Il selettore dei cestini (gruppi di importazione) si trova nella **riga 3 dei filtri** (`ContactFiltersBar.tsx`, righe 249-271), come **quarta colonna** della griglia filtri inline. E' un piccolo `Select` con icona `FolderOpen` che mostra:
- "Tutti i gruppi" come default
- Ogni gruppo con nome + conteggio: es. `Cosmoprof (142)`

Il problema: e' identico agli altri filtri (Paese, Origine, Status) — stessa dimensione, stesso peso visivo. Non c'e' nessuna evidenza del **cestino attivo** ne' un modo rapido per capire da quale importazione stai lavorando.

### Proposta: Cestino attivo in evidenza + dropdown dedicata

Aggiungere una **riga 0** (sopra l'AI bar) o un **header prominente** nella `ContactListPanel` che mostra:

```text
┌──────────────────────────────────────────────────────────┐
│ 📂 Cosmoprof 2025 (142 contatti)              [▾ Cambia]│  ← Header cestino attivo
├──────────────────────────────────────────────────────────┤
│ 🤖 [_________ Chiedi all'AI... _________]               │
│ ...filtri...                                             │
└──────────────────────────────────────────────────────────┘
```

**Dettagli:**
- Se nessun cestino e' selezionato: mostra "Tutti i cestini" con conteggio totale
- Se un cestino e' attivo: mostra il nome in grassetto, conteggio contatti, data importazione
- Il bottone "Cambia" apre un **Popover** con la lista completa dei cestini (nome, file sorgente, data, conteggio), con possibilita' di selezionare o tornare a "Tutti"
- Rimuovere il Select gruppo dalla riga 3 dei filtri (evitare duplicazione)

### File da modificare

| File | Azione |
|------|--------|
| `src/components/contacts/ContactFiltersBar.tsx` | Aggiungere header cestino prominente sopra AI bar, rimuovere Select gruppo dalla riga filtri |
| `src/components/contacts/ContactListPanel.tsx` | Nessuna modifica (importGroups gia' passato come prop) |

