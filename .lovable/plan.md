

Le Fasi 1+2+3 sono già state implementate nel turno precedente. La RPC `get_dashboard_snapshot` è già live (visibile nello schema), `useDashboardData` la usa già, `BackgroundServices` defer è in piedi, i wrapper V2 sono già piatti, `mode="wait"` rimosso, prefetch esteso.

Restano però due punti del piano da finire/verificare. Faccio un mini-piano operativo solo su quelli.

## Cosa resta da fare

**1. Fase 1 — verificare invalidate globale rimosso**
Controllare `AuthenticatedLayout.tsx` riga ~76: deve invalidare solo su `event === "SIGNED_IN"`, non su ogni toggle di `sessionReady`. Se è ancora globale, sostituire.

**2. Fase 3 — lazy-load widget pesanti dashboard**
`OperativeMetricsGrid`, `SmartActions`, `AgentStatusPanel` oggi sono caricati subito in `SuperHome3D`. Convertirli in `React.lazy` con `<Suspense fallback={<Skeleton/>}>` per togliere peso al bundle iniziale della Dashboard.

**3. QA finale**
- Verificare in console che dopo navigazione non parta più una raffica di refetch
- Verificare che la dashboard chiami `get_dashboard_snapshot` una sola volta (Network tab → 1 RPC, non 12)
- Verificare che `/v2/network` apra in <1.5s a freddo dopo prefetch

## Decisione transizioni
Mantengo fade-in leggero in entrata (150ms), nessun exit blocker. Già applicato.

## File toccati (stimati)
- `src/v2/ui/templates/AuthenticatedLayout.tsx` (verifica/fix invalidate condizionale)
- `src/pages/SuperHome3D.tsx` (lazy import 3 widget pesanti)
- nessuna nuova migration

## Rischi
Bassi. Le modifiche sono additive (lazy) o restrittive (invalidate scoped).

