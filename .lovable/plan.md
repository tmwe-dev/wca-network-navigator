
# Fix: Processi Automatici Attivi che Non Si Fermano Mai

## Problemi Trovati

Ci sono **3 fonti di processi attivi** che continuano a girare in background senza che tu li abbia avviati:

### 1. Loop di polling del processore download (OGNI 15 secondi)
Il processore in `useDownloadProcessor.ts` ha un loop infinito che interroga il database (`download_jobs?status=eq.pending`) ogni 15 secondi, anche quando NON ci sono job da eseguire. Questo genera chiamate di rete continue e permanenti.

### 2. Auto-check WCA da 5 componenti diversi (il problema principale!)
L'hook `useWcaSessionStatus` viene usato in **5 componenti**:
- AppSidebar
- ActionPanel
- WcaSessionIndicator
- WcaSessionCard
- Settings

Ogni componente crea la propria istanza dell'hook, e ognuna ha il proprio `autoCheckDone = useRef(false)`. Quando lo stato WCA e "expired" (com'e adesso), TUTTE le istanze attivano `triggerCheck()` indipendentemente, generando chiamate multiple a `check-wca-session`.

### 3. AppSidebar chiama `triggerCheck()` incondizionatamente al mount
In `AppSidebar.tsx` riga 44-46 c'e:
```text
useEffect(() => {
    triggerCheck();
}, []);
```
Questo lancia una verifica WCA OGNI VOLTA che la sidebar viene montata, senza alcuna condizione.

---

## Piano di Intervento

### A. Rendere l'auto-check globale (non per-istanza)
**File**: `src/hooks/useWcaSessionStatus.ts`

Spostare il flag `autoCheckDone` su `window` (singleton globale) invece di usare `useRef`. Cosi, indipendentemente da quante istanze dell'hook esistono, l'auto-check parte UNA SOLA VOLTA:

```text
const AUTO_CHECK_KEY = '__wcaAutoCheckDone__';
// Usare (window as any)[AUTO_CHECK_KEY] invece di useRef(false)
```

### B. Rimuovere il triggerCheck() incondizionato da AppSidebar
**File**: `src/components/layout/AppSidebar.tsx`

Eliminare completamente il `useEffect` alle righe 43-46. L'auto-check nell'hook stesso e gia sufficiente e gestito in modo centralizzato.

### C. Fermare il polling loop quando non ci sono job
**File**: `src/hooks/useDownloadProcessor.ts`

Implementare un contatore di cicli vuoti. Dopo 3 cicli consecutivi senza trovare job pending, il loop esce completamente (`loopRunning = false`). Il loop verra riavviato solo quando l'utente avvia effettivamente nuovi download (tramite `resetStop()`).

```text
let emptyRounds = 0;
// Nel loop:
if (no pending jobs) {
    emptyRounds++;
    if (emptyRounds >= 3) {
        console.log("[DownloadProcessor] No jobs for 3 rounds, stopping loop");
        break; // Esce dal while, loopRunning diventa false nel finally
    }
}
// Se trova un job: emptyRounds = 0;
```

---

## Risultato Atteso

| Prima | Dopo |
|-------|------|
| Polling DB ogni 15s per sempre | Loop si ferma dopo 45s senza job |
| 5 auto-check WCA simultanei | 1 solo auto-check globale |
| triggerCheck() extra da AppSidebar | Nessun check extra |
| Chiamate di rete continue in background | Silenzio totale quando non ci sono operazioni |

## File Modificati

| File | Modifica |
|------|----------|
| `src/hooks/useWcaSessionStatus.ts` | Auto-check con flag globale su window |
| `src/components/layout/AppSidebar.tsx` | Rimuovere triggerCheck() al mount |
| `src/hooks/useDownloadProcessor.ts` | Stop loop dopo 3 cicli vuoti |
