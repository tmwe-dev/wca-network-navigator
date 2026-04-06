
# Rimuovere la linguetta IntelliFlow in basso a destra

## Problema
La linguetta viola fissa sul bordo destro in basso (con icona Sparkles) duplica il pulsante IntelliFlow AI già presente nell'header in alto a destra. È ridondante.

## Intervento
Rimuovere il blocco `<button>` in `src/components/layout/AppLayout.tsx` (righe ~160-172) che renderizza il tab fisso in basso a destra con `bottom-20` e `right: 0`.

Nessun altro file coinvolto.
