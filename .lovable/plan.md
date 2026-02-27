

## Diagnosi: Perché l'Afghanistan mostra ancora "Senza Profilo 3"

### Causa root trovata

Il problema NON e nel codice dell'app (il fix a `profileSaver.ts` e corretto). Il problema e nell'**estensione Chrome installata dall'utente**, che e una versione vecchia (v4) scaricata da `/download-wca-extension.html`.

**Prova dal DB**: entrambi i job Afghanistan (02:29 e 06:38, cioe DOPO il fix) mostrano "Profilo ✗" per tutti e 3 i partner. Il campo `raw_profile_html` e NULL per tutti e 3.

**Prova dal terminal log**: ogni partner mostra `📋 Profilo ✗` — significa che `result.profileHtml` era `undefined` nella risposta dell'estensione.

### Due versioni dell'estensione in conflitto

| | `public/chrome-extension/background.js` (v6) | `/download-wca-extension.html` (v4 inline) |
|---|---|---|
| Funzione estrazione | `extractFullProfileFromPage()` | `extractContactsFromPage()` |
| Cattura `profileHtml` | Si (`document.body.innerHTML`) | No |
| Cattura `profile` strutturato | Si (address, phone, networks...) | No |
| Risposta a webapp | Include `profile` + `profileHtml` | Solo `contacts` + `companyName` |
| `sendContactsToServer` | Invia `profile` + `profileHtml` | Invia solo `contacts` |

L'utente ha scaricato l'estensione dalla pagina HTML, che genera inline il codice v4. Il file `public/chrome-extension/background.js` (v6) non viene mai usato perche l'utente non lo scarica direttamente.

### Bug secondario: edge function `save-wca-contacts`

Riga 168: `if (profileHtml) { partnerUpdate.raw_profile_html = profileHtml }` e **dentro** il blocco `if (profile)` (riga 137). Stesso bug che avevamo nel client-side `profileSaver.ts`. Se `profile` e un oggetto vuoto `{}`, il blocco viene eseguito, ma se `profile` e `null/undefined`, il `profileHtml` non viene salvato.

### Piano di fix (3 file)

**1. `public/download-wca-extension.html`** — Aggiornare il background.js inline per usare `extractFullProfileFromPage()` (v6) con cattura di `profileHtml`, `profile` strutturato, e invio completo a `sendContactsToServer`. Copiare la logica esatta da `public/chrome-extension/background.js` linee 10-247 e 444-529.

**2. `supabase/functions/save-wca-contacts/index.ts`** — Spostare il salvataggio di `profileHtml` fuori dal blocco `if (profile)`, identico al fix gia applicato in `profileSaver.ts`:
```typescript
// Fuori da if(profile):
if (profileHtml) {
  await supabase.from('partners').update({ 
    raw_profile_html: profileHtml, 
    updated_at: new Date().toISOString() 
  }).eq('id', partnerId);
}
```

**3. Nessun cambio a `public/chrome-extension/background.js`** — Gia corretto (v6).

### Dopo il fix

L'utente dovra:
1. Ri-scaricare l'estensione dalla pagina aggiornata
2. Reinstallarla in Chrome (rimuovi vecchia + carica nuova)
3. Ri-scaricare i 3 partner afghani con il filtro "Senza Profilo"

