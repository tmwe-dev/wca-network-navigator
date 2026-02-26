

# Fix: Eliminare la terza colonna visibile nello Step 0

## Problema

Il carousel non nasconde correttamente lo Slide 1 quando siamo nello Step 0. Il pannello dettaglio partner (con placeholder "Seleziona un partner dalla lista a destra") e' visibile a destra della CountryGrid, sprecando spazio.

## Causa

Il container del carousel ha `overflow-hidden` sul wrapper esterno, ma i due slide sono entrambi renderizzati e il layout `flex` li mostra affiancati. Quando `carouselStep === 0`, lo Slide 0 ha `width: 100%` e lo Slide 1 ha `width: 50%`, ma il container flex li mostra entrambi perche' non c'e' un vero clipping.

## Soluzione

1. **`Operations.tsx`** -- Rendere lo Slide 1 solo quando `carouselStep === 1`**, oppure nasconderlo con `visibility: hidden` / `display: none` quando non attivo. Il modo piu' pulito: usare `overflow-hidden` sul container interno e impostare `min-width` correttamente, oppure semplicemente non renderizzare lo Slide 1 quando `carouselStep === 0`.

Approccio concreto: wrappare lo Slide 1 in un condizionale `{carouselStep === 1 && (...)}` e impostare lo Slide 0 a `width: 100%` sempre. Quando si conferma, lo Slide 0 scompare e appare lo Slide 1 con una transizione. Questo elimina qualsiasi possibilita' che la terza colonna sia visibile nello step 0.

In alternativa (per mantenere l'animazione carousel smooth): forzare `overflow: hidden` sul container diretto degli slide e assicurarsi che la `width` del container interno sia esattamente il 100% della viewport, non di piu'.

**Approccio scelto**: Conditional rendering + transizione fade/slide. Piu' semplice e senza rischi di leak visivo:

```text
Step 0: [Stats | CountryGrid] ← occupa 100%
Step 1: [DetailPanel | PartnerList] ← occupa 100%, renderizzato solo quando attivo
```

La transizione avviene con un semplice fade + slide CSS (`opacity` + `translateX`) gestito da classi condizionali.

## File modificati

1. **`src/pages/Operations.tsx`** -- Sostituire il sistema carousel a doppio slide con rendering condizionale: Step 0 mostra Stats+Grid al 100%, Step 1 mostra Detail+List al 100%. Transizione con animazione CSS.

