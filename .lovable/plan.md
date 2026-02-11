

# Fix: Content Script non si connette alla Preview

## Problema Trovato
Il `manifest.json` dell'estensione specifica che il content script deve essere iniettato solo su:
```
https://*.lovable.app/*
```

Ma la preview dell'app gira su:
```
https://....lovableproject.com
```

Risultato: il content script non viene mai caricato, il bridge `window.postMessage` non funziona, e l'estensione non riceve mai la richiesta di estrarre i contatti. Per questo vedi la luce verde (la sessione WCA server-side e' ok) ma non arrivano email e telefoni privati.

## Soluzione

### 1. `public/chrome-extension/manifest.json`
Aggiungere il dominio `.lovableproject.com` ai matches del content script:
```json
"content_scripts": [
  {
    "matches": [
      "https://*.lovable.app/*",
      "https://*.lovableproject.com/*"
    ],
    "js": ["content.js"],
    "run_at": "document_idle"
  }
]
```

### 2. Dopo la modifica
Dovrai riscaricare i file dell'estensione (Impostazioni > Scarica Estensione Chrome) e ricaricarla in `chrome://extensions/`. Una volta fatto, quando apri la pagina Acquisizione Partner il content script si attivera' e il bridge sara' operativo.

## Risultato Atteso
- L'indicatore "Plug" nella toolbar di acquisizione diventa verde (estensione rilevata)
- Durante il download di ogni partner, la Phase 1.5 (estrazione contatti) si attiva automaticamente
- Email, telefoni diretti e mobile vengono estratti dal DOM autenticato del browser

