

# Seleziona Tutti + Coppa Completamento

## Cosa cambia

### 1. Pulsante "Seleziona tutti" visibile in alto

Spostare il pulsante "Seleziona tutti" dal dropdown (dove e' nascosto nel popover filtri) a una posizione visibile, accanto allo switch "Solo Dir" e alle bandiere. Il pulsante seleziona/deseleziona tutti i paesi filtrati (rispettando il filtro attivo: "Mai esplorati", "Scansionati", ecc.).

Layout della riga sopra la lista:
```text
[🇮🇹 🇩🇪 🇫🇷 ...]  [Seleziona tutti (N)]  [Solo Dir toggle]
```

- Se il filtro e' su "Mai esplorati", seleziona solo quelli mai esplorati
- Se il filtro e' su "Tutti", seleziona tutti
- Il conteggio mostra quanti paesi verranno selezionati/deselezionati
- Il pulsante diventa "Deseleziona tutti" quando sono gia' tutti selezionati

### 2. Coppa sui paesi completati

Aggiungere un'icona coppa (Trophy da lucide-react) sulla sinistra della card dei paesi dove `isComplete === true` (directory scaricata e tutti i partner nel DB). La coppa sostituisce/affianca il testo "Completo" gia' presente, rendendolo visivamente immediato.

- Colore: emerald/gold
- Posizione: accanto alla bandiera o come badge sovrapposto
- Mantiene tutti i colori card esistenti (emerald per completi, amber per parziali, etc.)

## File da modificare

### `src/components/download/CountryGrid.tsx`

1. **Import**: aggiungere `Trophy` da lucide-react
2. **Riga bandiere** (righe 227-255): rendere la riga visibile sempre (non solo quando `selected.length > 0`) per mostrare il pulsante "Seleziona tutti" anche senza selezione. Aggiungere un bottone compatto "Seleziona tutti (N)" tra le bandiere e lo switch Solo Dir
3. **Card paese** (righe 321-326): nel blocco `isComplete`, aggiungere icona `Trophy` colorata emerald/gold accanto al testo "Completo"

Nessun altro file viene modificato.

