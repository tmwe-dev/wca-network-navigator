

## Header contatore dinamico + Select All riposizionato

### Modifiche in `src/components/partners/CountryWorkbench.tsx`

#### 1. Header: contatore dinamico filtered/total
Nell'header (righe 225-227), sostituire il contatore statico `countryPartners.length` con logica dinamica:
- Se ci sono filtri attivi o ricerca: mostrare `filteredPartners.length / countryPartners.length`
- Altrimenti: mostrare solo `countryPartners.length`

#### 2. Rimuovere la riga "LIST HEADER" (righe 372-390)
Eliminare completamente la sezione che mostra `"9 / 11 partner"` e il bottone `"Sel. tutti"` a destra — informazione duplicata.

#### 3. Aggiungere checkbox "Seleziona tutti" a sinistra sopra la lista
Al posto della riga rimossa, inserire una riga minima con solo una checkbox (stile identico alle checkbox individuali delle card) che funge da "seleziona tutti i filtrati". Posizionata a sinistra, allineata con le checkbox delle card sottostanti.

### Layout risultante header
```text
← 🇦🇱 Albania                    9 / 11
```
Quando non ci sono filtri:
```text
← 🇦🇱 Albania                        11
```

### Layout sopra lista
```text
☐  (checkbox seleziona tutti, allineata con quelle sotto)
```

### File: `src/components/partners/CountryWorkbench.tsx` — unico file

