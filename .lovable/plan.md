

# Bandiere BCA Piu' Grandi

## Problema
Le bandiere emoji nelle card dei biglietti da visita sono troppo piccole (`text-base` = 16px). Devono essere almeno 3 volte piu' grandi per essere ben visibili.

## Modifiche

### `src/pages/Operations.tsx`

1. **Header gruppo azienda** (riga 592): cambiare `text-base` → `text-4xl` (36px, ~3x)
2. **Card singolo contatto** (riga 642): il flag inline nel nome e' minuscolo. Estrarlo dal testo e metterlo come elemento separato con `text-3xl` accanto al nome, ben visibile

Risultato: bandiere grandi e leggibili sia nell'header del gruppo che nella card del contatto.

