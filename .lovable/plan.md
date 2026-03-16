
Obiettivo confermato: fare un’analisi tecnica di Report Aziende per capire come evitare uno scraping “scheda per scheda” e privilegiare un flusso di export/download più robusto.

Cosa ho verificato nella struttura attuale
- L’integrazione RA oggi è costruita attorno all’estensione Chrome:
  - `src/hooks/useRAExtensionBridge.ts` espone solo azioni di scraping/search/login/status.
  - `public/ra-extension/background.js` apre `search.php?tab=2`, compila il form, legge la tabella risultati e poi visita le singole schede.
- Il flusso corrente è quindi:
  1. ricerca in RA
  2. estrazione lista risultati da tabella
  3. apertura profilo azienda
  4. parsing DOM della scheda
  5. salvataggio in `prospects`
- Questo approccio è coerente con pochi record, ma è debolissimo per l’obiettivo “download massivo di indirizzi/contatti”:
  - richiede una visita per record
  - dipende dal DOM della scheda
  - è lento
  - rischia blocchi/session expiry
  - non sfrutta eventuali export nativi o API

Conclusione tecnica principale
- Sì: il modello attuale non è la strada giusta se il target è scaricare dataset ampi con indirizzi/contatti.
- La strategia da privilegiare deve diventare “download first”, con questo ordine:
  1. API ufficiale, se realmente disponibile nel piano
  2. export nativo da ricerca personalizzata / risultati
  3. scraping della tabella risultati senza entrare nelle schede
  4. apertura schede solo come fallback per record incompleti o arricchimento

Analisi del sito rispetto al tuo obiettivo
1. Ricerca avanzata (`search.php`)
- Utile per costruire il set di aziende target.
- Già compatibile con l’architettura attuale.
- Però oggi il codice usa questa pagina solo per trovare link, non per massimizzare i dati direttamente dai risultati.

2. Ricerca personalizzata (`searchPersonalizzata.php`)
- È il punto più promettente.
- Se davvero consente di scegliere le colonne, allora può diventare la fonte primaria del dataset.
- In questo caso l’estensione non dovrebbe più “scrapare aziende”, ma:
  - costruire query/filtro
  - selezionare colonne
  - leggere o scaricare il risultato tabellare/export
  - convertire il file/risultato nel formato `prospects`/import interno

3. API / collegamento API
- Se il tuo account ha davvero accesso API, questa è la soluzione migliore in assoluto.
- L’analisi tecnica deve quindi partire da una verifica concreta:
  - endpoint reali
  - autenticazione
  - formato risposta
  - limiti
  - campi disponibili
- Se esiste, l’estensione può diventare secondaria o sparire per RA.

Limiti precisi dell’implementazione attuale
- `runSearchOnly()` e `runBatchScrape()` ciclano per ATECO/area e paginazione, ma lavorano sempre via browser automation.
- `extractSearchResults()` legge solo ciò che vede in tabella; non gestisce un export file.
- `extractProfileData()` cerca campi nel DOM della scheda, quindi è fragile per strutture complesse come indirizzi multipli, sedi secondarie, recapiti sparsi.
- Non esiste oggi un modulo per:
  - catturare download CSV/XLS
  - parsare export RA
  - importare export RA nel wizard import come sorgente dedicata
  - usare API RA se presenti

Proposta architetturale consigliata
Fase A — Discovery tecnica reale del sito
- Studiare concretamente:
  - `searchPersonalizzata.php`
  - presenza di bottoni export
  - richieste XHR/fetch per generazione tabella/export
  - presenza reale di endpoint API
- Output atteso:
  - mappa dei parametri
  - formato export
  - formato API
  - strategia primaria/fallback

Fase B — Nuovo motore RA “download first”
- Introdurre un layer RA con 3 modalità:
  - `api`
  - `export`
  - `table_scrape`
- Logica:
  - se API disponibile: usa API
  - altrimenti se export disponibile: genera/scarica export
  - altrimenti: legge la tabella risultati
  - schede dettaglio solo per arricchimento selettivo

Fase C — Integrazione con il sistema attuale
- I dati RA non devono più passare solo dal parser della scheda.
- Devono poter essere caricati come lotto importato, con origine chiara `report_aziende`.
- Idealmente:
  - export/API -> staging/import
  - poi trasferimento/uso come gli altri record
- Questo allinea RA con la logica già usata per business card e import strutturati.

Cosa proporrei di costruire dopo questa analisi
1. Modulo “RA Discovery”
- Un’azione nell’estensione per:
  - aprire `searchPersonalizzata.php`
  - ispezionare form, colonne, pulsanti export, chiamate rete
  - restituire una diagnosi strutturata

2. Modulo “RA Export Capture”
- Se il sito scarica un file:
  - intercettare il download
  - leggere CSV/XLS
  - convertirlo in record interni
- Questo è il percorso più importante se non c’è API.

3. Modulo “RA API Client”
- Solo se la verifica conferma API accessibile dal tuo piano.
- Sarebbe il backend più stabile per query massive.

4. Fallback “scrape tabella, non scheda”
- Se export/API non ci sono:
  - estrarre il massimo dalla tabella risultati
  - paginare
  - salvare solo dataset lista
  - dettaglio singolo solo on-demand

Decisione tecnica consigliata
- Non continuare a investire sullo scraping delle schede come motore principale RA.
- Fare subito una discovery mirata su:
  - `searchPersonalizzata.php`
  - export risultati
  - API reale del tuo account
- Poi rifattorizzare l’integrazione RA verso “download first”.

File/aree che toccherei nella futura implementazione
- `public/ra-extension/background.js`
  - nuova modalità discovery/export/api
- `src/hooks/useRAExtensionBridge.ts`
  - nuove azioni tipo `discoverExport`, `runExport`, `testApi`
- `src/components/prospects/ProspectImporter.tsx`
  - nuova UI per scegliere modalità RA: API / Export / Fallback
- pipeline import esistente
  - per far entrare i dataset RA esportati come lotto chiaro e riutilizzabile

Rischi da considerare
- L’API potrebbe essere solo commerciale o non accessibile dal tuo piano.
- L’export potrebbe essere generato via richieste firmate o token sessione.
- Il formato export potrebbe essere XLS/CSV con colonne variabili.
- Alcuni campi chiave potrebbero essere disponibili solo nel dettaglio, quindi servirà comunque un fallback ibrido.

Esito della proposta
- La tua osservazione è corretta: per grandi volumi non ha senso verificare gli indirizzi entrando nelle schede una per una.
- La proposta migliore è rifondare RA su un approccio “API/export prima, scraping solo come fallback o arricchimento”.
- Il prossimo step concreto che propongo è una discovery tecnica del flusso `searchPersonalizzata` + export/API, così possiamo capire qual è la via davvero sostenibile prima di scrivere altra logica.

<lov-actions>
<lov-suggestion message="Testa end-to-end il flusso Report Aziende nel preview e verifica dove si blocca davvero tra login, ricerca e risultati.">Verifica end-to-end</lov-suggestion>
<lov-suggestion message="Analizza tecnicamente searchPersonalizzata.php e individua se esiste un export CSV/XLS utilizzabile direttamente dall’estensione.">Analizza export RA</lov-suggestion>
<lov-suggestion message="Verifica se il mio account Report Aziende ha davvero accesso API e proponi un client dedicato al posto dello scraping delle schede.">Verifica API RA</lov-suggestion>
<lov-suggestion message="Progetta una nuova integrazione Report Aziende con priorità API/export e scraping della scheda solo come fallback per record incompleti.">Progetta motore download-first</lov-suggestion>
</lov-actions>
