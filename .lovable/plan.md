
# Fix: URL di Login Report Aziende (404)

## Problema
L'estensione RA punta a `https://www.reportaziende.it/login` che restituisce un errore 404. La pagina di login reale si trova su `https://ecommerce2.reportaziende.it/login3/`.

Inoltre, il rilevamento "sessione scaduta" controlla se l'URL contiene `/login`, che potrebbe non corrispondere ai redirect del nuovo dominio.

## Soluzione
Correggere l'URL di login e aggiornare i controlli di sessione scaduta nell'estensione.

## Dettagli tecnici

### File: `public/ra-extension/background.js`

**1. URL di login (riga 81)**
- Da: `https://www.reportaziende.it/login`
- A: `https://ecommerce2.reportaziende.it/login3/`

**2. Controlli sessione scaduta (righe 400, 442, 472)**
- Aggiornare i 3 controlli `tabInfo.url.includes("/login")` per riconoscere anche il nuovo dominio:
  - `tabInfo.url.includes("/login3") || tabInfo.url.includes("errore_404")`
- Questo copre sia il redirect al login su ecommerce2 sia il caso in cui RA mostra la pagina 404

**3. Selettori del form login**
- La funzione `fillLogin` gia' cerca `input#username` e `input[type="password"]` che corrispondono ai campi reali della pagina (`input#username` type email, `input#password`). Nessuna modifica necessaria.

### File: `public/ra-extension/manifest.json`
- Gia' include `https://ecommerce2.reportaziende.it/*` nei `host_permissions`. Nessuna modifica necessaria.

### Riepilogo modifiche
- `public/ra-extension/background.js` -- 4 punti da correggere (1 URL + 3 controlli sessione)
