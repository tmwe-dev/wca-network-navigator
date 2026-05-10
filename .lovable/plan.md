## Diagnosi

Log attuale (3.9.62):
```
gate={"boxes":0,"clickedMessage":false,"clickedMore":false,"hasMain":true,"shells":0}
```
Significa: pagina profilo caricata (`hasMain=true`), ma:
- `findMessageBtn()` non trova il bottone "Messaggia" → `clickedMessage=false`
- `findMoreBtn()` non trova "Altro" → `clickedMore=false`
- nessun composer aperto (`shells=0`, `boxes=0`)

Causa: LinkedIn ha cambiato labels/markup dei bottoni del profilo. I regex attuali in `actions.js` (righe 339-340 e 351) non matchano più il DOM reale.

## Cosa cambia (solo `actions.js`, file unico, fallback `HybridOps.sendMessage` resta intatto)

### 1. Selettori "Messaggia" allargati (`findMessageBtn`)
Aggiungere selettori CSS espliciti prima del fallback testuale:
- `button[aria-label*="essag" i]` (Messaggia / Message / Messaggio)
- `button[data-control-name*="message" i]`
- `a[href*="/messaging/thread/"]`
- `a[href*="/messaging/compose"]`
- `button.message-anywhere-button`
- `button[aria-label*="criv" i]` (Scrivi)
- `[data-test-app-aware-link][href*="messaging"]`

Estendere regex testuale per includere: `chat`, `direct message`, `dm`, `inviare`, e accettare anche match parziali su `aria-labelledby`.

Cercare anche dentro Shadow DOM (la funzione `deepQueryAll` esiste già — usarla anche per i bottoni, non solo per shells/boxes).

### 2. Selettori "Altro/More" allargati (`findMoreBtn`)
- `button[aria-label*="ltro" i]` (Altro)
- `button[aria-label*="ore actions" i]`
- `button[aria-label*="ù azioni" i]`
- `button.artdeco-dropdown__trigger[aria-label]` filtrato per label
- Regex aggiuntiva: `dropdown|menu azioni|action menu`

### 3. Retry con backoff su click "Messaggia"
Invece di un singolo `mb.click()` per iterazione, dopo il primo click:
- aspetta 1.2s
- ricontrolla composer
- se ancora chiuso, prova **secondo bottone** "Messaggia" trovato (lista, non singolo)
- max 3 tentativi totali, poi passa al ramo "Altro"

Il flag `clickedMessage` diventa contatore `messageClickAttempts` (max 3).

### 4. Anticipare apertura "Altro"
Ridurre la soglia `Date.now() - started > 2500` a `> 1500` quando `messageClickAttempts >= 2`. Così il fallback "Altro → Messaggia" parte prima.

### 5. Diagnostica arricchita
Nel diagnostic finale aggiungere:
- `profileLoaded`: presenza di `.pv-top-card` o `[data-test-id*="top-card"]` o `section.artdeco-card`
- `messageBtnSelectorsHit`: array dei selettori CSS che hanno matchato (per capire QUALE selettore funziona o se nessuno)
- `visibleButtonsCount`: numero totale bottoni visibili nel main
- `firstButtonLabels`: prime 8 label dei bottoni visibili (truncate 40 char)
- `url`: `location.href` reale al momento del timeout

Questo permette, al prossimo fallimento, di vedere subito se LinkedIn ha cambiato di nuovo i label/markup.

### 6. Aumentare timeout interno gate
Da `Math.max(12000, timeoutMs || 30000)` (di fatto 30s perché `timeoutMs=30000` arriva da chiamante) → lasciato a 30s ma il polling interno passa da 100ms a 250ms (meno CPU, più tempo per LinkedIn di caricare lazy).

## Cosa NON tocco
- `background.js` keep-alive (funziona)
- `tab-manager.js` worker tab (funziona)
- `hybrid-ops.js` scrittura `sendMessage` (è la pipeline stabile)
- Fallback `HybridOps.sendMessage` per metodi non-CDP (3.9.62 ripristinato)
- CDP fail-fast diagnostico (resta)

## Packaging
- Bump manifest a `3.9.63`
- Catalog: 3.9.63 latest, 3.9.62 current=false
- `whatsappExtensionZip.ts` LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.9.63"
- Repackage zip + fallback `linkedin-extension.zip`

## Risultato atteso

Caso A (LinkedIn ha solo cambiato label):
- Nuovi selettori CSS matchano → composer si apre → invio OK

Caso B (cambiamento più profondo):
- Composer non si apre lo stesso, MA il diagnostic ora mostra `firstButtonLabels`, `url`, `visibleButtonsCount` → in 1 iterazione capiamo cosa cercare e patchiamo i selettori esatti.

In entrambi i casi il fallback `HybridOps.sendMessage` (3.9.62) continua a coprire i metodi DOM non-CDP.

## Tecnica (per riferimento)

File toccato: solo `public/linkedin-extension/actions.js` (sezione `probeComposer`/`waitForComposerReady`, righe ~325-395) + `manifest.json` + `catalog.json` + `src/lib/whatsappExtensionZip.ts`.

Nessuna modifica a edge function, DAL, RLS, prompt, AI, journalistReview.
