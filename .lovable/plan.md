
# Piano Dashboard — Refactor mirato (no redesign)

L'utente conferma: **design OK**, **`as any` da eliminare**, **applicare i miglioramenti che NON entrano in conflitto con la logica esistente**. Procedo con audit dei conflitti prima di proporre.

## Audit conflitti vs. logica esistente

| Proposta iniziale | Conflitto? | Decisione |
|---|---|---|
| Eliminare `as any` in `agentBreakdowns` | Nessuno — è solo type safety (memory: zero-any) | ✅ Applicare |
| Rinominare `SuperHome3D` → `DashboardHome` | Nessuno funzionale, ma tocca import in più punti | ⏸️ Rimando (refactor cosmetico, basso valore) |
| Spostare `SuperHome3D` da `src/pages/` a `src/v2/ui/pages/` | **Conflitto** con `mem://architecture/v2-hybrid-orchestration-framework` (V2 = thin wrapper su V1) e `mem://project/development-status-governance` | ❌ Non toccare |
| RBAC su `NAV_CARDS` | **Possibile conflitto** — la dashboard è già protetta da `AuthenticatedLayout`. Filtrare per ruolo richiede definire mapping card→ruolo che oggi non esiste | ⏸️ Solo se utente lo chiede esplicitamente |
| Greeting dinamico (buongiorno/sera) | Nessuno — additivo | ✅ Applicare se già non esiste |
| Empty states migliorati | Nessuno — additivo | ✅ Applicare dove mancano |
| Briefing AI: verifica funzionamento | Read-only check | ✅ Verifica live |

## Interventi concreti (minimi e mirati)

### 1. Eliminare `as any` in `agentBreakdowns`
**File**: `src/pages/SuperHome3D.tsx` (e dove usato)
- Trovare i punti dove `agentBreakdowns` viene castato.
- Il tipo `AgentTaskBreakdown` esiste già in `src/v2/io/supabase/queries/dashboard.ts` ed è esportato da `useDashboardData.ts`.
- Sostituire `as any` con il tipo corretto, oppure usare `as unknown as AgentTaskBreakdown[]` solo se c'è un mismatch reale (pattern memory `tech/type-safety-implementation-patterns`).

### 2. Greeting dinamico (se manca)
**File**: `src/pages/SuperHome3D.tsx` (header)
- Verificare se esiste già un saluto contestuale.
- Se no, aggiungere "Buongiorno / Buon pomeriggio / Buonasera" usando `timeUtils.ts` esistente (memory `tech/time-management-and-work-hours-v2`, fascia 06:00–00:00 CET).

### 3. Empty states
**File**: componenti dashboard (`OperativeMetricsGrid`, `AgentStatusPanel`, `SmartActions`)
- `SmartActions` già gestisce vuoto con fallback "Esplora il network".
- Verificare `OperativeMetricsGrid` e `AgentStatusPanel`: se mostrano `0/0/0` senza messaggio, aggiungere micro-copy ("Nessun task attivo — tutto sotto controllo").

### 4. Verifica Briefing AI live
- Controllare console/network sulla dashboard quando l'utente apre il briefing.
- Confermare che `daily-briefing` edge function risponde (latenza, errori 4xx/5xx).
- Solo report, nessuna modifica.

## Cosa NON tocco
- `SuperHome3D.tsx` come file/posizione (V2 thin wrapper preservato)
- `NAV_CARDS` hardcoded (no RBAC senza richiesta esplicita)
- Layout, colori, componenti UI
- Logica `useDashboardData` / RPC `get_dashboard_snapshot`
- `useDailyBriefing` e prompt `daily-briefing`

## Sequenza esecuzione (dopo approvazione)
1. Audit puntuale `grep "as any"` su file dashboard → fix typings
2. Check greeting esistente → eventuale aggiunta
3. Check empty states → eventuale micro-copy
4. Test live briefing AI (network log)
5. Report sintetico conflitti zero / modifiche applicate

## Domanda residua
Procedo direttamente, oppure prima vuoi vedere l'output `grep "as any"` su `SuperHome3D.tsx` e componenti correlati per validare la portata reale del fix?
