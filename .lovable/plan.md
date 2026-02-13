

# Fix: Redirect 404 su ReportAziende - Verifica Sessione Prima della Ricerca

## Problema

L'estensione apre direttamente `https://www.reportaziende.it/search.php?tab=2` senza verificare che la sessione sia attiva. Quando la sessione e' scaduta, il sito reindirizza a `errore_404_pagina_non_trovata?p=login`, causando l'errore.

Il codice attuale (riga 635) fa:
```text
tab = await chrome.tabs.create({ url: "https://www.reportaziende.it/search.php?tab=2", active: false });
```

Il check sulla sessione (righe 650-655) arriva DOPO il caricamento, ma a quel punto il sito ha gia' fatto il redirect al 404.

## Soluzione

### 1. Auto-login preventivo in `scrapeSearchResults` (riga 630-700)

Prima di aprire la pagina di ricerca, verificare la sessione e fare auto-login se necessario:

```text
async function scrapeSearchResults(params) {
  // STEP 0: Verifica sessione - apri una pagina qualsiasi e controlla redirect
  // Se redirect a login/404 -> esegui autoLogin() automaticamente
  // Poi riprova ad aprire la pagina di ricerca
}
```

Flusso:
1. Aprire la pagina di ricerca
2. Se il URL finale contiene "errore_404" o "login" -> eseguire `autoLogin()` automaticamente
3. Attendere che l'utente completi il login (o che il login automatico funzioni)
4. Riprovare ad aprire la pagina di ricerca
5. Se ancora 404 -> restituire errore "session_expired" con messaggio chiaro

### 2. Migliorare il check URL di sessione (righe 650-655)

Aggiungere piu' pattern di redirect al check:

```text
function isSessionExpiredUrl(url) {
  return url && (
    url.includes("/login3") ||
    url.includes("errore_404") ||
    url.includes("p=login") ||
    url.includes("/login") ||
    !url.includes("reportaziende.it/search")  // non e' piu' sulla pagina di ricerca
  );
}
```

### 3. Stessa logica per `runDiscoverFields` (riga 608-628)

Anche la discovery apre `search.php?tab=2` senza verificare la sessione. Aggiungere lo stesso check.

### 4. Retry con auto-login integrato

Se la sessione e' scaduta durante `scrapeSearchResults`:

```text
// Dopo aver rilevato sessione scaduta:
addLog("Sessione scaduta, tentativo auto-login...");
var loginResult = await autoLogin();
if (loginResult.success) {
  // Attendi sincronizzazione cookie
  await new Promise(r => setTimeout(r, 3000));
  // Riprova la ricerca (un solo retry)
  // ... ricrea il tab con search.php?tab=2
}
```

## File da Modificare

- `public/ra-extension/background.js`:
  - Righe 630-700 (`scrapeSearchResults`): aggiungere auto-login preventivo e retry
  - Righe 608-628 (`runDiscoverFields`): aggiungere check sessione
  - Aggiungere funzione helper `isSessionExpiredUrl(url)`

## Risultato Atteso

L'estensione non mostrera' piu' la pagina 404. Se la sessione e' scaduta:
1. Esegue auto-login automatico
2. Riprova la ricerca
3. Se il login fallisce, mostra un messaggio chiaro: "Sessione scaduta - effettua il login su ReportAziende"
