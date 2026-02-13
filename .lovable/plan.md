
# Fix: fillAndSubmitSearchForm non viene eseguita

## Causa Root

`chrome.scripting.executeScript` non risolve automaticamente le Promise restituite dalle funzioni iniettate. La funzione `fillAndSubmitSearchForm` (riga 292-551) restituisce `new Promise(...)`, ma il risultato che arriva a `scrapeSearchResults` (riga 743-747) e' un oggetto Promise serializzato come `{}`.

Di conseguenza:
- `fillData` = `{}` (oggetto vuoto)
- `fillData.submitted` = `undefined` (falsy)
- Il check a riga 750 (`!fillData.submitted`) e' sempre vero
- L'estensione ritorna immediatamente "Form non compilato" senza mai aspettare

## Soluzione

Riscrivere `fillAndSubmitSearchForm` come funzione **sincrona** che esegue le operazioni con `setTimeout` a cascata e NON restituisce una Promise. In alternativa, usare un pattern a due step:

1. Iniettare uno script sincrono che configura i filtri e fa il submit del form
2. Attendere il caricamento della pagina risultati nel listener `onUpdated`

### Modifiche in `public/ra-extension/background.js`

**1. Convertire `fillAndSubmitSearchForm` in funzione sincrona (righe 292-551)**

Rimuovere il wrapper `new Promise(...)` e la funzione interna `async run()`. Le operazioni sui modal (apertura, compilazione, click "Applica") devono essere sequenziali con `setTimeout` annidati oppure, meglio ancora, usare direttamente il DOM senza attese (dato che le modali Bootstrap sono gia' nel DOM, solo nascoste).

Approccio:
- Trovare gli input direttamente nel DOM (anche dentro modali nascoste) senza aprirle
- Impostare i valori con `dispatchEvent`
- Fare `form.submit()` sincrono
- Ritornare `{ submitted: true }` come valore sincrono

```text
function fillAndSubmitSearchForm(params) {
  // Tutto sincrono - niente Promise, niente async
  try {
    var form = document.querySelector("#cercaAvanzataForm, form[name='cercaAvanzata']");
    
    // Cercare input dentro modali (sono nel DOM anche se nascoste)
    // Impostare valori ATECO, Geografia, Fatturato, Dipendenti
    // ...
    
    if (form) { form.submit(); return { submitted: true }; }
    return { submitted: false, error: "Form non trovato" };
  } catch(e) {
    return { submitted: false, error: e.message };
  }
}
```

**2. Aggiornare `scrapeSearchResults` (righe 743-753)**

Rimuovere il check su `fillData.submitted` come condizione di errore immediato, dato che il form submit causa un page navigation. Invece, dopo l'iniezione dello script, attendere semplicemente il caricamento della pagina successiva (che e' gia' gestito dal listener `onUpdated` a righe 756-769).

**3. Gestione alternativa: approccio "hidden input injection"**

Se le modali non espongono gli input quando sono nascoste, usare un approccio diverso: creare hidden inputs direttamente nel form con i nomi corretti dei parametri, senza toccare le modali. Questo richiede conoscere i nomi esatti dei campi POST del form.

## File da Modificare

- `public/ra-extension/background.js`: righe 292-551 (fillAndSubmitSearchForm) e 743-753 (check risultato)

## Rischio

Il rischio principale e' non conoscere i nomi esatti dei parametri POST del form `cercaAvanzataForm`. Per questo, nella prima esecuzione utilizzeremo la funzione `discoverFormFields` gia' presente per mappare i campi, e li useremo nel codice sincrono.
