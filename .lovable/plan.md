

# Piano: Usare EmailHtmlFrame standard nella pagina Download

## Problema
La pagina EmailDownloadPage usa un iframe custom semplificato per il rendering delle email, che non gestisce correttamente immagini, stili e layout complessi. Il componente standard `EmailHtmlFrame` già usato nella vista email normale gestisce tutto correttamente (mode faithful/safe, blocco immagini remote, responsive, etc.).

## Soluzione
Sostituire il componente `EmailSlide` interno con l'uso di `EmailHtmlFrame` dal modulo standard.

### File: `src/pages/EmailDownloadPage.tsx`

1. Importare `EmailHtmlFrame` da `@/components/outreach/email/EmailHtmlFrame`
2. Riscrivere `EmailSlide` per usare `EmailHtmlFrame` con `mode="faithful"` e `blockRemote={false}` invece dell'iframe custom
3. Rimuovere la logica iframe manuale e la funzione `escapeHtml` (non più necessaria)
4. Se `bodyHtml` è assente, fare fallback su un semplice `<pre>` con `bodyText`

Il componente `EmailHtmlFrame` gestisce già: auto-resize, stili base, max-width immagini, table responsive, e rendering fedele del layout originale dell'email.

