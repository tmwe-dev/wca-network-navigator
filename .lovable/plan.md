

# Rimuovere filtri qualità inline da Network/Operations

## Problema
La pagina Network (`Operations.tsx`) ha ancora:
1. **StatPill bar** nella toolbar (righe 162-169): "No Profilo", "No Email", "No Tel" come pill cliccabili
2. **CountryGrid** (righe 164-191): chip filtro qualità duplicati dentro la griglia paesi
3. **filterMode state locale** (riga 48): `useState<FilterKey>("all")` — dovrebbe leggere da `useGlobalFilters().filters.quality`

Tutto questo è già gestito nel FiltersDrawer sinistro (sezione "Qualità dati" visibile su `/network`).

## Modifiche

### 1. `src/pages/Operations.tsx`
- Rimuovere `filterMode` state locale → leggere `useGlobalFilters().filters.quality` e mapparlo a `FilterKey`
- Rimuovere le StatPill di qualità (righe 162-169) dalla toolbar — mantenere solo il contatore "Partner" come info
- Rimuovere prop `onFilterModeChange` dal `<CountryGrid>`
- Rimuovere import di `FileX, MailX, PhoneOff`

### 2. `src/components/download/CountryGrid.tsx`
- Rimuovere il blocco "Quality filter chips" (righe 164-191) dal render
- Mantenere la prop `filterMode` in lettura (serve per filtrare i paesi), ma rimuovere `onFilterModeChange` dall'interfaccia
- Il filtro arriva dal context globale, non da chip inline

Risultato: la toolbar Network mostra solo il contatore partner totali e le azioni (AI, tema). I filtri qualità si attivano esclusivamente dal drawer sinistro.

