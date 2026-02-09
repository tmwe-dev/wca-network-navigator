

# Aggiungere "Seleziona Tutti" alla selezione paesi

## Cosa cambia

Aggiungere un pulsante **"Seleziona tutti"** nella schermata di selezione paesi del Download Wizard, accanto alla barra di ricerca e ai filtri. Il pulsante selezionera tutti i paesi attualmente visibili (rispettando filtro e ricerca attivi). Se sono gia tutti selezionati, funzionera come "Deseleziona tutti".

## Dettaglio tecnico

### File: `src/pages/DownloadManagement.tsx` - Componente `PickCountry`

1. **Aggiungere un pulsante "Seleziona tutti / Deseleziona tutti"** nella riga dei filtri (riga ~477-515), dopo il selettore di ordinamento.

2. **Logica**: al click, se non tutti i paesi filtrati sono selezionati, li aggiunge tutti. Altrimenti li rimuove tutti. Questo rispetta il filtro attivo: se hai filtrato "Mai esplorati", seleziona solo quelli.

3. **Testo dinamico**: il pulsante mostra "Seleziona tutti (N)" o "Deseleziona tutti" in base allo stato corrente.

| File | Modifica |
|------|----------|
| `src/pages/DownloadManagement.tsx` | Aggiungere pulsante e logica nel componente `PickCountry`, passando una nuova prop `onSelectAll` dal wizard oppure gestendolo internamente con la prop `onToggle` esistente |

