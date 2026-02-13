

## Implementare lo Scraping di Report Aziende via Chrome Extension

### Situazione attuale

L'estensione RA attualmente gestisce solo **cookie sync** e **auto-login**. Lo scraping vero (estrazione dati dalle pagine) non e' ancora implementato. Report Aziende richiede autenticazione per tutte le ricerche e i profili aziendali, quindi lo scraping deve avvenire tramite l'estensione Chrome che ha accesso ai cookie di sessione.

### Cosa c'e' su Report Aziende

Dalla ricognizione del sito emergono queste risorse:

**Pagina ATECO** (`/ricerca-ateco`): albero completo dei codici ATECO con link ai risultati. Ogni codice punta a `/ateco-XX_YY_ZZ` con la lista delle aziende. L'albero e' gerarchico:
- Sezione (lettera): A = Agricoltura, B = Estrazione, C = Manifatturiero...
- Divisione (2 cifre): 01, 02, 46, 52...
- Gruppo (3 cifre): 01.1, 52.2...
- Classe (5-6 cifre): 01.11.00, 52.29.10...

**Ricerca Personalizzata** (`/ricerca-personalizzata`): filtri per Regione, Provincia, Comune, CAP, Codice ATECO, Fatturato, Dipendenti, EBITDA, ecc. Restituisce tabelle di risultati con link ai profili.

**Profili aziendali**: contengono dati anagrafici (P.IVA, sede, ATECO), finanziari (fatturato, utile, dipendenti), management (nomi, ruoli, CF) e contatti (email, PEC, telefono).

### Piano di implementazione

#### 1. Scraper nel background.js dell'estensione RA

Aggiungere al `background.js` le funzioni di scraping:

**`scrapeSearchResults(params)`**: apre la Ricerca Personalizzata con filtri (ATECO, regione, provincia), estrae la lista dei risultati (ragione sociale + link al profilo). Gestisce la paginazione automatica.

**`scrapeCompanyProfile(url)`**: naviga a un profilo aziendale, estrae tutti i dati strutturati:
- Anagrafica: ragione sociale, P.IVA, CF, indirizzo, CAP, citta', provincia, regione
- ATECO: codice + descrizione
- Forma giuridica, data costituzione
- Finanziari: fatturato, utile, dipendenti, anno bilancio
- Contatti: telefono, email, PEC, sito web
- Management: lista di persone con nome, ruolo, CF
- Rating affidabilita' e credit score
- Salva l'HTML grezzo come backup

**`runBatchScrape(params)`**: orchestratore che:
1. Esegue la ricerca con i filtri specificati
2. Per ogni risultato, naviga al profilo e lo scrapa
3. Ogni N aziende (batch di 5-10) invia i dati a `save-ra-prospects`
4. Rispetta delay configurabili tra le richieste
5. Reporta il progresso in tempo reale

#### 2. Message handler nell'estensione

Aggiungere nuove azioni al listener `onMessage`:
- `scrapeByAteco`: riceve codice ATECO + filtri geografici, avvia lo scraping batch
- `scrapeCompany`: riceve URL di un singolo profilo, lo scrapa e ritorna i dati
- `getScrapingStatus`: ritorna stato corrente (in corso, completato, errori)
- `stopScraping`: interrompe lo scraping in corso

#### 3. Bridge nella webapp (content.js)

Il content.js gia' funziona come bridge bidirezionale. Le nuove azioni passeranno automaticamente dal webapp all'estensione.

#### 4. Hook `useRAExtensionBridge` nella webapp

Nuovo hook (o estensione di quello esistente) per comunicare con l'estensione RA dalla webapp:
- `scrapeByAteco(atecoCode, filters)`: avvia scraping per codice ATECO
- `scrapeCompany(url)`: scrapa singola azienda
- `getStatus()`: controlla stato scraping

#### 5. UI nel Prospect Center

Aggiungere al pannello destro del Prospect Center un tab "Importa" con:
- Selettore codice ATECO (dall'albero)
- Filtri: regione, provincia, range fatturato
- Pulsante "Avvia Scraping"
- Barra di progresso con contatori (trovate, salvate, errori)
- Log in tempo reale

#### 6. Aggiornare `download-ra-extension.html`

Rigenerare il pacchetto scaricabile con il nuovo `background.js` che include le funzioni di scraping.

### File da creare/modificare

**Estensione Chrome (file statici):**
- `public/ra-extension/background.js` — aggiungere funzioni di scraping (scrapeSearchResults, scrapeCompanyProfile, runBatchScrape) e nuovi message handler
- `public/download-ra-extension.html` — aggiornare il pacchetto generato per includere il nuovo background.js

**Frontend:**
- `src/hooks/useRAExtensionBridge.ts` — nuovo hook per comunicare con l'estensione RA (scraping, status)
- `src/components/prospects/ProspectImporter.tsx` — nuovo componente UI per configurare e lanciare lo scraping nel Prospect Center
- `src/pages/ProspectCenter.tsx` — aggiungere tab "Importa" con il ProspectImporter

### Logica di estrazione dati (dentro background.js)

La funzione `scrapeCompanyProfile` viene iniettata nella pagina del profilo aziendale e deve:

1. Cercare i dati anagrafici nelle tabelle/div della pagina (selectors CSS da identificare con l'autenticazione attiva — la struttura esatta si scopre navigando la pagina da autenticati)
2. Estrarre il management dalla sezione dedicata (tipicamente tabella con nome, ruolo, CF)
3. Raccogliere l'HTML completo come backup per parsing futuro con AI
4. Restituire un oggetto strutturato compatibile con la tabella `prospects` e `prospect_contacts`

### Sicurezza e rate limiting

- Delay minimo configurabile tra le richieste (default 8-12 secondi, come per WCA)
- Pause lunghe automatiche ogni N profili
- Pausa notturna (stessi orari di WCA)
- Interruzione immediata se la sessione scade (redirect a login)
- Esecuzione sequenziale: un solo scraping alla volta

### Nota importante

La struttura HTML esatta dei profili aziendali su Report Aziende non e' visibile senza autenticazione. L'implementazione iniziale usera' selettori CSS generici e l'HTML grezzo verra' salvato per consentire un raffinamento successivo dei selettori dopo i primi test con sessione autenticata.

