

# Piano: Dropdown Admin Globale per Cambio Operatore

## Situazione attuale

- `OperatorSelector` nel header esiste già ma è visibile a tutti (non solo admin) e non ha effetto sulle sezioni inbox
- `InArrivoTab` ha il proprio filtro operatore locale (tab orizzontali) indipendente dal selettore header
- Il contesto `ActiveOperatorContext` gestisce `activeOperator` ma non è usato come filtro globale nelle inbox

## Piano

### 1. Rendere il selettore header solo per admin

**File: `src/components/header/OperatorSelector.tsx`**
- Aggiungere check `useCurrentOperator()` → mostrare solo se `is_admin`
- Aggiungere opzione "Tutti gli operatori" come primo item
- Evidenziare visivamente quando si sta visualizzando un altro operatore (bordo colorato, badge "Viewing as...")
- Mostrare icona Shield/Crown per distinguere la modalità admin

### 2. Propagare la selezione globale alle inbox

**File: `src/components/outreach/InArrivoTab.tsx`**
- Rimuovere i tab orizzontali locali per operatore (sono ridondanti col selettore header)
- Usare `activeOperator` dal context come filtro, passando `activeOperator.user_id` ai componenti inbox
- Se admin ha selezionato "Tutti", passare `undefined` (nessun filtro)

### 3. Aggiornare il context per supportare "Tutti"

**File: `src/contexts/ActiveOperatorContext.tsx`**
- Aggiungere stato `viewingAll: boolean` quando admin seleziona "tutti"
- Esporre `isImpersonating: boolean` per sapere se si sta guardando un altro operatore

### File coinvolti

| File | Modifica |
|------|----------|
| `src/components/header/OperatorSelector.tsx` | Solo admin, opzione "Tutti", badge impersonation |
| `src/contexts/ActiveOperatorContext.tsx` | `viewingAll` flag, `isImpersonating` |
| `src/components/outreach/InArrivoTab.tsx` | Rimuovere tab operatore locali, usare context globale |

## Risultato
- L'admin ha un unico dropdown nel header per navigare tra gli operatori
- La selezione si propaga a tutte le sezioni (inbox, outreach, holding pattern)
- Gli operatori normali non vedono il selettore

