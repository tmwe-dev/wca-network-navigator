## Diagnosi (causa esatta del bug "Nome: 0 notifiche")

In `public/linkedin-extension/ax-tree.js` la funzione `extractProfile(tabId)` fa così:

```js
const h1 = findOne(nodes, "heading");
if (h1 && h1.name) result.name = h1.name.value;
```

Cioè prende **il primo `heading`** trovato nell'AX tree dell'INTERA pagina. Su LinkedIn, la barra di navigazione globale espone l'icona "Notifiche" come elemento di livello heading con aria-label tipo "0 notifiche". Quindi quel `findOne` agguanta la **nav**, non il profilo, e `result.name = "0 notifiche"`.

In più la stessa funzione **non estrae** né `headline` né `location`: li lascia `null`, e il render UI li mostra come `?`.

Il fallback strutturale in `hybrid-ops.js` (che invece ha `document.querySelector("h1")` con headline) **non viene mai raggiunto**, perché AX Tree restituisce un `name` non vuoto ("0 notifiche") e l'orchestratore considera il livello 1 riuscito.

Risultato visibile in test:
```
Nome: 0 notifiche
Headline: ?
Location: ?
```

Anche la URL nel "Seleziona contatto" risulta vuota perché su DB il profilo non viene mai salvato con dati validi (nome inquinato → record scartato/duplicato).

---

## Cosa cambia (solo extension LinkedIn — codice app intoccato)

Tre interventi chirurgici, tutti dentro `public/linkedin-extension/`. Niente refactor, niente modifiche all'app React, ai DAL, all'auth, agli edge.

### 1) `ax-tree.js` → `extractProfile`: pesca dentro `<main>` e ignora la nav

- Cambiare la ricerca da "primo heading di tutto l'AX tree" a "primo heading **discendente del nodo `main`/`pv-top-card`**".
- Aggiungere un filtro anti-rumore: scartare `name` che matchano `/^\d+\s*(notif|messag|conness|invit)/i` o `/^(notif|messag|search|cerca|home|rete|lavoro|jobs)/i`.
- Estrarre anche `headline` e `location` dall'AX tree, cercando i due primi `StaticText` sotto lo stesso heading "Nome".

### 2) `ax-tree.js` → contratto di "successo"

Considerare `axResult` valido solo se `name` è presente **e non matcha la blacklist**. Se non è valido, ritornare `null` così che `hybrid-ops.js` proceda al livello 2 (AI Learn) e poi al livello 3 (structural fallback).

### 3) `hybrid-ops.js` → fallback strutturale più robusto

Sostituire il generico `document.querySelector("h1")` con selettori scoped al top-card del profilo:

- Nome: `main h1.inline.t-24, main section.pv-top-card h1, main h1`
- Headline: `main .text-body-medium.break-words`
- Location: `main .text-body-small.inline.t-black--light.break-words`
- Photo: `main img.pv-top-card-profile-picture__image, main img[class*='profile-picture']`

Stesso filtro blacklist anti-nav applicato anche qui.

---

## Bump versione + distribuzione

- `public/linkedin-extension/manifest.json` → 3.9.13
- Nuovo zip `public/chrome-extensions/linkedin/linkedin-extension-3.9.13.zip` rigenerato + sostituito anche `public/linkedin-extension.zip` (lo scarica il pulsante in topbar).
- `public/chrome-extensions/catalog.json` → `latestVersion: 3.9.13`, marcata `current: true`; 3.9.12 → `current: false`.
- `src/lib/whatsappExtensionZip.ts` → `LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.9.13"` (unica riga toccata fuori dall'extension, serve solo a far apparire il banner di update).

---

## QA prima di dire "fatto"

1. Reinstallare 3.9.13 e ripetere `extractProfile` su `https://www.linkedin.com/in/sreyashbhandari8a360012/`.
2. Atteso: `name` = nome reale, `headline` valorizzato, `location` valorizzata, `profileUrl` = URL passato.
3. Verificare nel log testuale che non compaia più "0 notifiche".
4. Test secondario su un altro profilo a caso per evitare regressioni.
5. Confermare che `sendMessage` (già funzionante in 3.9.12) continui a funzionare — non lo tocchiamo.

---

## Cosa NON tocco (per esplicita richiesta)

- Nessun file in `src/`, `supabase/`, `edge functions`.
- Nessuna modifica a `WhatsApp extension`, `actions.js` LinkedIn, auth, RLS, queue, AI, DAL.
- Nessun refactor di `hybrid-ops.js` oltre alle due funzioni citate.
- Nessuna modifica al pulsante di download in topbar (continuerà a scaricare lo zip aggiornato in automatico).
