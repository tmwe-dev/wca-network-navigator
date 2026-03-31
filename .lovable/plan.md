

# Linguette Laterali per Drawer Filtri e Mission

## Problema
Le zone hover attuali sono solo 5px e invisibili — bisogna arrivare al bordo esatto. Servono zone piu' ampie (10px) con linguette visibili che invitino all'interazione.

## Modifiche in `src/components/layout/AppLayout.tsx`

1. **Ampliare zona hover** da `w-[5px]` a `w-[12px]`
2. **Sostituire i div invisibili** con linguette stilizzate posizionate sotto la header (`top-14`):
   - **Sinistra**: linguetta semitrasparente con icona `SlidersHorizontal` (filtri), arrotondata a destra, ~32px di altezza
   - **Destra**: linguetta semitrasparente con icona `Target` (AI/Mission), arrotondata a sinistra
3. **Stile linguette**: `bg-muted/40 backdrop-blur-sm border border-border/30`, con hover che aumenta opacita' (`hover:bg-muted/60`)
4. **Mantengono** la stessa logica hover con timer da 150ms
5. **z-index** `z-[60]` confermato per stare sopra al contenuto

### Risultato visivo
Due piccole tab ancorate ai bordi, appena sotto la header, con icona che indica cosa aprono. Area sensibile di 12px dal bordo.

## Bug runtime (fix collaterale)
In `src/hooks/useCockpitContacts.ts` riga 181: accesso a proprieta' undefined. Aggiungere optional chaining per evitare il crash.

