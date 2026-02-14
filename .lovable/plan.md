
# Nascondere paesi senza dati nella directory

## Cosa cambia

Per default, la Country Grid mostrera' solo i paesi che hanno almeno un record nella directory (`cacheCounts[code] > 0`). Un toggle in alto permettera' di mostrare anche i paesi vuoti.

## Modifica

### File: `src/components/download/CountryGrid.tsx`

1. **Nuovo stato**: `const [showEmpty, setShowEmpty] = useState(false)`

2. **Filtro aggiuntivo** nella logica `filtered` (riga 77-83): aggiungere prima del return finale del filtro `"all"`:
   - Se `showEmpty` e' `false`, escludere i paesi dove `cacheCounts[c.code]` e' `0` o `undefined` (cioe' nessun membro nella directory)
   - I paesi gia' selezionati vengono sempre mostrati, indipendentemente dal toggle

3. **Toggle nell'area toolbar** (vicino al "Solo Dir" toggle, riga 178-183): aggiungere un toggle con label "Mostra vuoti" e icona `Globe`, che controlla `showEmpty`

4. **Aggiornare i contatori** (`missingCount`, `exploredCount`, etc.) per riflettere il filtro attivo

### Dettaglio tecnico

Nel blocco filtro (riga 77-83), dopo il check `matchesSearch`:

```text
// Se showEmpty e' false, nascondi paesi senza record in directory
// (a meno che non siano gia' selezionati)
if (!showEmpty && !cacheCounts[c.code] && !selectedCodes.has(c.code)) return false;
```

Il toggle verra' posizionato nella riga dei controlli (riga 161-183), accanto al toggle "Solo Dir", con lo stesso stile compatto:

```text
<label>
  <Switch checked={showEmpty} onCheckedChange={setShowEmpty} />
  <Globe className="w-3 h-3" />
  Tutti
</label>
```
