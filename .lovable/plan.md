## Obiettivo
Fare in modo che il Deep Search non si blocchi sui popup cookie/privacy e continui a leggere il contenuto reale dei siti.

## Diagnosi
Il metodo corretto è un auto-consent centralizzato nell’estensione Partner Connect, ma oggi è collegato solo ad alcuni percorsi:

- `withTab(url, fn)` chiama già `autoAcceptConsent(tab.id)` prima dello scraping.
- Il Deep Search Sherlock però usa il flusso canonico `navigateBackground → wait → scrape`:
  - webapp: `fs.readUrl()`
  - estensione: `handleAgentAction(navigate background)`
  - estensione: `handleScrape()`
- In questo flusso l’auto-consent non viene eseguito: `BackgroundTab.navigate()` carica la pagina ma non clicca i popup, e `handleScrape()` estrae subito.

Quindi il problema non è solo la lista dei selettori: il punto principale è che il metodo non è inserito nel percorso effettivamente usato dal Deep Search.

## Metodo da usare
Implementare un gate unico prima di ogni lettura pagina:

```text
navigate page
wait load
run consent resolver
wait for re-render / overlay removal
scrape page
```

Il resolver deve:

1. provare selettori noti dei CMP più diffusi;
2. usare fallback testuale multilingua;
3. attraversare anche iframe accessibili (`allFrames: true`);
4. usare click realistico via eventi mouse + `.click()`;
5. gestire shadow DOM aperti, dove possibile;
6. ripetere 2-3 tentativi perché molti banner compaiono dopo il primo render;
7. rimuovere solo blocchi visuali/scroll-lock residui dopo il click, senza cancellare prima il popup;
8. restituire un report diagnostico: `accepted`, `selector`, `text`, `frameCount`, `attempts`.

## Piano di modifica

### 1. Spostare l’auto-consent nel flusso reale del Deep Search
Agganciare `autoAcceptConsent(tabId)` direttamente a:

- `BackgroundTab.navigate(url)` subito dopo `waitForTabLoad(tabId)`;
- `handleScrape(msg)` prima di `scrapeTab(tabId)`, come rete di sicurezza.

Questo copre Sherlock e il batch basato su `fs.readUrl()` senza cambiare la logica UI.

### 2. Rendere `autoAcceptConsent()` più robusto
Estendere l’attuale funzione con:

- selettori aggiuntivi per CMP comuni: OneTrust, Cookiebot, Didomi, Iubenda, Quantcast, CookieYes, Usercentrics, Termly, Complianz, Axeptio, TrustArc, Google consent;
- fallback testuale con pattern più ampi: “accept all”, “allow all”, “agree”, “continue”, “save choices”, “accetta tutto”, “consenti tutto”, “continua”, equivalenti FR/DE/ES/PT/NL;
- ricerca in shadow roots aperti;
- scoring dei candidati per preferire “accept all” rispetto a “reject”, “manage”, “settings”;
- retry breve con MutationObserver o polling temporizzato.

### 3. Evitare falsi positivi pericolosi
Non cliccare bottoni che contengono testo tipo:

- reject / decline / deny;
- settings / preferences / manage options;
- subscribe / sign up / buy / checkout;
- login / register.

L’obiettivo è accettare solo popup consenso, non interagire con modali commerciali.

### 4. Aggiornare i punti legacy dello scraper
Aggiungere il gate anche nei percorsi che aprono tab manualmente e oggi non lo chiamano:

- `handleCrawlStart()` dopo `waitForTabLoad()`;
- `handleMap()` dopo `waitForTabLoad()`;
- eventuale `agent navigate` non-background, se usato da pipeline future.

Lasciare intatto WhatsApp/LinkedIn: fuori scope.

### 5. Versionare e lasciare traccia
- Bump Partner Connect da `3.4.4` a `3.4.5`.
- Aggiornare descrizione manifest.
- Aggiornare memoria tecnica `firescrape-consent-auto-accept` con il nuovo punto architetturale: auto-consent nel `BackgroundTab.navigate` e in `handleScrape`, non solo in `withTab`.

## Validazione prevista

- Verificare via search che ogni `waitForTabLoad()` destinato a scraping abbia il gate consenso prima dell’estrazione.
- Controllare che il percorso Sherlock rimanga:

```text
fs.readUrl → navigateBackground → BackgroundTab.navigate → autoAcceptConsent → handleScrape → scrapeTab
```

- Eseguire test statico mirato con `rg` sui punti `scrapeTab(` e `waitForTabLoad(`.
- Non modificare persistenza DB, card, AI, email, WCA bridge o funzioni IMAP.