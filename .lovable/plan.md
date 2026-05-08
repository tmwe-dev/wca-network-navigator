## Problema

Inviando un messaggio a un contatto LinkedIn di 1° grado, l'estensione fallisce sempre con `navigation_drifted: tab non e su /in/<slug> (https://www.linkedin.com/messaging/thread/...)`.

LinkedIn ha cambiato comportamento: cliccare "Messaggia" sul profilo di un contatto già collegato non apre più una bolla overlay sulla pagina del profilo, ma ridireziona l'intera tab alla **vista messaggistica full-page** (`/messaging/thread/<id>`). 

La guardia URL in `hybrid-ops.js` accetta solo URL `/in/` o `/pub/` e quindi aborta. Il retry in `actions.js` rinaviga al profilo, riclicca "Messaggia", LinkedIn redireziona di nuovo a `/messaging/thread/...` → stesso errore. Loop deterministico.

La textbox di composizione è presente e perfettamente funzionante anche sulla pagina `/messaging/thread/...`: il `findBox()` esistente la troverebbe senza modifiche perché cerca qualunque contenteditable/role=textbox visibile con classi `msg-form`.

## Soluzione (minima e localizzata)

Estendere la regex della guardia per accettare anche le pagine di messaggistica come destinazioni valide per l'invio.

### File toccato (uno solo)

**`public/linkedin-extension/hybrid-ops.js`** — riga 167

Prima:
```js
if (!/linkedin\.com\/(in|pub)\//i.test(currentUrl)) {
  return Config.errorResponse(..., "navigation_drifted: tab non e su /in/<slug> (" + currentUrl + ")");
}
```

Dopo:
```js
if (!/linkedin\.com\/(in|pub|messaging)\//i.test(currentUrl)) {
  return Config.errorResponse(..., "navigation_drifted: tab fuori da profilo/messaging (" + currentUrl + ")");
}
```

Questo permette il proseguimento dell'invio sia dalla pagina profilo (overlay-bolla, vecchio caso) sia dalla vista messaggistica full-page (nuovo caso, contatti già collegati).

### Effetti collaterali da verificare

- `actions.js` riga 33 (retry su `navigation_drifted`) **resta invariato e corretto**: continuerà a salvare i casi in cui la tab finisce su `/feed/`, `/notifications/`, `/jobs/` ecc. (URL davvero "deragliati"), riportando il browser al profilo e ritentando.
- Il `findBox()` di livello 3 in `sendMessage` (riga 200+) **funziona già su entrambe le viste**: cerca qualunque `contenteditable=true` o `role=textbox` visibile con marker `msg-form` o aria-label "messag/scrivi". Non serve toccarlo.
- Il livello 1 (AX Tree, `ax-tree.js`) e il livello 2 (AI Learn) **non hanno guardie URL proprie**, quindi non vanno modificati.

### Versionamento e rilascio

1. Bump `manifest.json` `version` → `3.9.17` con description sintetica ("Fix invio: accetta navigazione su /messaging/thread/").
2. Aggiornare `LINKEDIN_EXTENSION_REQUIRED_VERSION` in `src/lib/whatsappExtensionZip.ts` a `3.9.17`, marcare `3.9.16` `current: false`.
3. Aggiornare `public/chrome-extensions/catalog.json`: `latestVersion: 3.9.17`, aggiungere entry `3.9.17 current: true`, marcare `3.9.16 current: false`.
4. Ribuildare lo zip:
   - `public/chrome-extensions/linkedin/linkedin-extension-3.9.17.zip`
   - copia su `public/linkedin-extension.zip`

### Cosa l'utente deve fare dopo l'implementazione

1. `chrome://extensions` → rimuovere "LinkedIn Cookie Sync"
2. Scaricare di nuovo lo zip dall'app, scompattare in cartella nuova, **Carica estensione non pacchettizzata**
3. Verificare nel pannello test: `🔧 Estensione installata: v3.9.17 (OK)`
4. Riprovare l'invio sullo stesso profilo

### Cosa NON tocco (rispetto principio madre)

- Nessuna modifica all'orchestrazione `sendLinkedInMessage` in `actions.js`
- Nessuna modifica ai 3 livelli di invio (AX Tree / AI Learn / structural fallback)
- Nessuna modifica al probe diagnostico aggiunto in 3.9.16 (resta utile per casi futuri di textbox effettivamente assente)
- Nessuna modifica al manifest oltre version + description
- Niente modifiche a WhatsApp, alla logica di test, alla UI

### Rischi residui

Praticamente nulli: la regex più permissiva amplia un controllo, non ne rimuove. Se la pagina `/messaging/thread/...` non avesse la textbox per qualunque motivo (raro: thread bloccato, premium-only, ecc.), il `findBox()` ritornerebbe null e l'invio fallirebbe con il messaggio descrittivo già esistente più il probe DOM aggiunto in 3.9.16 — esattamente il comportamento desiderato per diagnosticare casi non standard.
