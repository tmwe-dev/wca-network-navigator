
Obiettivo: bloccare completamente lo scroll della pagina su `/network` e far scorrere solo i pannelli interni (paesi, lista partner, dettaglio), mantenendo sempre tutto dentro lo screen.

## Perché oggi scorre ancora
Dal replay si vede scroll su `element id=1` (documento), quindi non è solo un pannello interno: sta ancora “cedendo” il contenitore di pagina.  
In più, nella colonna sinistra la sezione “paesi selezionati” può crescere senza limite verticale e spingere fuori il layout.

## Piano di correzione

1. **Bloccare il viewport a livello AppLayout**
   - File: `src/components/layout/AppLayout.tsx`
   - Cambiare shell principale da `min-h-screen` a `h-screen overflow-hidden`.
   - Garantire che la colonna centrale resti `h-full min-h-0 overflow-hidden`.
   - Risultato: il documento non deve più diventare scrollabile nelle route fullscreen (inclusa `/network`).

2. **Rendere la route Network rigidamente contenuta**
   - File: `src/pages/Network.tsx`
   - Mantenere wrapper con `h-full min-h-0 overflow-hidden`.
   - Assicurare che anche il fallback di `Suspense` non possa espandere il documento.

3. **Chiudere tutti i leak verticali in Operations**
   - File: `src/pages/Operations.tsx`
   - Su layout principale e colonne: aggiungere/rafforzare `overflow-hidden` + `min-h-0`.
   - Colonna sinistra: forzare contenimento (`overflow-hidden`) così non espande la pagina.
   - Colonna centrale/dettaglio: confermare solo scroll interno (`overflow-auto` nel body dettaglio).

4. **Limitare l’altezza dei blocchi non scrollanti in CountryGrid**
   - File: `src/components/download/CountryGrid.tsx`
   - Root del componente: `overflow-hidden`.
   - Toolbar superiore (ricerca/sort/selezioni): mantenuta `flex-shrink-0`.
   - Sezione bandierine selezionate: trasformarla in area con `max-h + overflow-y-auto` (non deve crescere all’infinito).
   - Lista paesi resta `flex-1 min-h-0 overflow-y-auto`.
   - Bottone sync resta `flex-shrink-0`.

## Verifica (obbligatoria)
1. Vai su `/network` desktop (viewport attuale) e prova wheel/trackpad sullo sfondo: **la pagina non deve muoversi**.
2. Seleziona molti paesi (20+): la colonna sinistra resta dentro container, scrolla solo internamente.
3. Prova lista partner lunga + dettaglio aperto: scroll solo nei rispettivi pannelli.
4. Test mobile/tablet: nessun “crollo” verticale della pagina, solo scroll interno alle liste.

## File da aggiornare
- `src/components/layout/AppLayout.tsx`
- `src/pages/Network.tsx`
- `src/pages/Operations.tsx`
- `src/components/download/CountryGrid.tsx`
