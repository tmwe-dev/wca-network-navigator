

## Diagnosi: perche B2C Logistics e altri 20 profili ZA non vengono scaricati

### Problema trovato

Ho analizzato i dati del database. Su 69 partner South Africa, 48 sono stati scaricati con successo (con HTML, email, contatti). I 21 rimanenti falliscono TUTTI, ripetutamente, con due tipi di errore:

1. **"member not found"** — il processore pensa che il profilo non esista
2. **"non caricato"** (pageLoaded: false) — la pagina risulta troppo corta (< 5000 caratteri)

Ma il sessionVerifier conferma che la sessione e attiva (test su profilo 86580). Quindi il problema non e la sessione.

### Causa probabile

Questi 21 profili WCA probabilmente hanno una struttura di pagina diversa dagli altri 48 che funzionano. Possibili scenari:
- La pagina e piu leggera di 5000 caratteri (soglia troppo rigida in `checkPageLoaded`)
- L'H1 contiene testo che matcha erroneamente "not found"
- La pagina usa classi CSS diverse da `profile_label`/`profile_val`/`contactperson_row`

### Il problema VERO: nessun log diagnostico

Non logghiamo MAI il dettaglio della risposta dell'estensione (companyName, lunghezza HTML, numero contatti, errore). Senza questi dati, e impossibile distinguere tra "pagina con formato diverso" e "profilo genuinamente inesistente".

### Piano di fix (3 interventi)

**1. Aggiungere log diagnostici dettagliati** (`src/hooks/useDownloadProcessor.ts`)
- Per OGNI profilo, loggare nel terminal_log: companyName restituito, lunghezza profileHtml, numero contatti, pageLoaded, error
- Cosi al prossimo tentativo sappiamo esattamente cosa vede l'estensione

**2. Salvare l'HTML grezzo anche per profili "falliti"** (`src/hooks/useDownloadProcessor.ts`)
- Se `result.profileHtml` esiste ma il profilo viene marcato come "not found" o "empty", salvare comunque l'HTML nel partner per ispezione post-mortem
- Aggiungere un campo diagnostico al terminal log con i primi 500 caratteri dell'HTML

**3. Rendere `checkPageLoaded` piu intelligente** (`public/chrome-extension/background.js`)
- Abbassare la soglia da 5000 a 2000 caratteri
- Aggiungere un check del titolo/H1: se la pagina ha un H1 con un nome azienda (non "Error", non "Login"), considerarla caricata anche se corta
- Loggare la lunghezza effettiva nel risultato per diagnostica

### Dettaglio tecnico

```text
Flusso attuale (rotto):
  extension apre pagina → checkPageLoaded (>5000?) 
    NO → return pageLoaded:false → "non caricato" → retry → fail
    SI → extract → H1 check → "member not found"? → skip permanente

Flusso corretto:
  extension apre pagina → checkPageLoaded (>2000? OR H1 ha nome azienda?)
    → extract → log companyName + htmlLength + contacts
    → salva HTML comunque per diagnostica
    → isMemberNotFound solo se H1 dice LETTERALMENTE "Member Not Found"
```

File da modificare:
1. `public/chrome-extension/background.js` — `checkPageLoaded` piu permissivo + log lunghezza
2. `src/hooks/useDownloadProcessor.ts` — log diagnostici dettagliati + salvataggio HTML per profili falliti

