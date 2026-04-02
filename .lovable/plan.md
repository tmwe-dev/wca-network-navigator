
# Piano: MissionDrawer Ultra-Compatto

## Concetto

Eliminare tutto lo spazio verticale sprecato. Tutto in alto, compatto, con icone. Le scelte si fanno tramite popup (Dialog).

## Layout nuovo

```text
┌──────────────────────────────────────┐
│ 🎯 Mission Context                  │
├──────────────────────────────────────┤
│ RIGA 1: Preset (bottoni/icone)       │
│ [P1] [P2] [P3] [+] [⚡Rapida|Std]  │
│ (se >5 preset → dropdown)           │
├──────────────────────────────────────┤
│ RIGA 2: Azioni compatte (icone)      │
│ [🎯 Obiettivo] [📝 Proposta]        │
│ [📎 Docs (2)] [🔗 Link (1)]         │
│ Ogni icona apre popup per scegliere  │
├──────────────────────────────────────┤
│ RIGA 3: Destinatari                  │
│ [🔍 Cerca azienda...]               │
│ [risultati ricerca]                  │
│ [chip] [chip] [chip] [Rimuovi]       │
└──────────────────────────────────────┘
```

## Dettaglio modifiche

### 1. Preset — Bottoni icona, non form

- Se **≤5 preset**: bottoni compatti in fila con nome abbreviato, quello attivo evidenziato con colore primario
- Se **>5 preset**: convertire automaticamente in dropdown Select
- Bottone [+] per salvare nuovo preset → apre mini Dialog con campo nome
- Bottone [🗑️] visibile solo se un preset e' attivo
- Qualita' AI resta inline nella stessa riga come toggle compatto (Rapida / Standard / Premium)

### 2. Obiettivo e Proposta — Icone compatte con popup

- **Eliminare** le textarea e i ContentSelect dal body della sidebar
- Sostituire con **2 bottoni icona** compatti in una riga orizzontale:
  - Icona Target + "Obiettivo" (o il nome selezionato, troncato)
  - Icona FileText + "Proposta" (o il nome selezionato, troncato)
- Click su ciascuno → apre il Dialog popup (ContentSelect) per scegliere/editare
- Il testo completo e' visibile solo nel popup, non nella sidebar

### 3. Documenti e Link — Icone badge, non collapsible

- Eliminare le sezioni collapsible
- 2 bottoni icona compatti nella stessa riga: Paperclip + count, Link2 + count
- Click → Dialog popup per gestire (lista + aggiungi/rimuovi)

### 4. Destinatari — Subito sotto, piu' spazio

- Ricerca + lista chip come ora, ma subito sotto le icone azioni
- Molto piu' spazio verticale disponibile per i risultati grazie alla compattazione sopra

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/global/MissionDrawer.tsx` | Rewrite completo del layout — compattazione, Dialog per docs/link |
| `src/components/shared/ContentSelect.tsx` | Nessuna modifica (popup gia' pronto) |

## Risultato

La sidebar passa da ~600px di scroll a ~250px di contenuto visibile tutto in una schermata. Popup per i dettagli.
