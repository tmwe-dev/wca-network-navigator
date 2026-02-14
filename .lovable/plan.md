

# Fix: Pulsante "Verifica ora" senza feedback visivo

## Problema

Il pulsante "Verifica ora" nel popover WCA Session Indicator funziona tecnicamente (le richieste partono e ritornano con successo), ma **non mostra alcun feedback visivo** durante il controllo. Questo perche':

- Il pulsante usa `disabled={isLoading}` dove `isLoading` viene da React Query e vale `true` solo al primo caricamento della pagina
- Durante `triggerCheck()`, nessuno stato di caricamento viene attivato, quindi il pulsante resta identico e l'utente pensa che non funzioni
- Nessun toast o messaggio conferma il risultato del check

## Soluzione

### File: `src/hooks/useWcaSessionStatus.ts`

Aggiungere uno stato `isChecking` separato gestito manualmente dentro `triggerCheck`:

- Aggiungere `const [isChecking, setIsChecking] = useState(false)` nello hook
- In `triggerCheck`: impostare `setIsChecking(true)` all'inizio e `setIsChecking(false)` nel finally
- Esportare `isChecking` dallo hook

### File: `src/components/download/WcaSessionIndicator.tsx`

1. Usare `isChecking` (nuovo) al posto di `isLoading` per il pulsante "Verifica ora"
2. Mostrare un toast con il risultato del check (successo/errore) dopo il completamento
3. Applicare la stessa correzione al pulsante nel `WcaSessionDialog`

### Dettaglio tecnico

Nel hook `useWcaSessionStatus.ts`:
```
// Aggiungere stato locale
const [isChecking, setIsChecking] = useState(false);

// In triggerCheck:
setIsChecking(true);
try { ... } finally { setIsChecking(false); }

// Esportare
return { ..., isChecking };
```

Nel componente `WcaSessionIndicator.tsx` (linea 74):
```
// Da:
disabled={isLoading}
// A:
disabled={isChecking}

// Da:
{isLoading ? <Loader2 .../> : <RefreshCw .../>}
// A:
{isChecking ? <Loader2 .../> : <RefreshCw .../>}
```

Stessa modifica per il dialog (linea 127-129).

