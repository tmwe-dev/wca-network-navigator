

## Diagnosi definitiva: WCA restituisce una pagina anti-bot, non "Member not found"

### Il problema reale

Il profilo #62345 (NTP Logistics) ESISTE — lo hai dimostrato incollando il contenuto. Ma l'estensione riceve una pagina diversa: esattamente 19917 caratteri con H1 = "Member not found. Please try again."

Tutti e 13 i profili restituiscono **identicamente** 19917 byte. Questo non e un "member not found" genuino — e una **pagina di errore anti-bot/rate-limit** di WCA. Il sito blocca le richieste rapide automatizzate restituendo questa pagina template.

La sessione sul profilo di test (86580) passa perche e la prima richiesta dopo una pausa. Le successive vengono bloccate.

### Perche il codice attuale fallisce

1. Il processore verifica la sessione su #86580 → passa ✅
2. Conclude: "sessione attiva, quindi 'Member not found' e genuino" → **skip permanente**
3. Salva i profili REALI in `partners_no_contacts` come inesistenti
4. I job successivi li filtrano via → non vengono mai piu ritentati

### Piano di fix (3 interventi)

**1. Rilevamento pagina anti-bot** (`background.js` + `useDownloadProcessor.ts`)

La pagina "Member not found" di WCA ha sempre la stessa lunghezza (~19917 chars). Un profilo genuinamente inesistente e una pagina di rate-limit sono indistinguibili dal solo testo H1, ma distinguibili dalla lunghezza HTML e dal contesto:
- Se `html.length` e identico per 3+ profili consecutivi → e rate-limiting, NON "member not found" genuino
- Il processore deve trattare questo caso come **errore temporaneo** (retry con delay maggiore), non skip permanente

Modifica in `useDownloadProcessor.ts`:
- Aggiungere un tracker della lunghezza HTML delle risposte "not found"
- Se 3+ profili restituiscono la stessa identica lunghezza HTML con "member not found", trattarli come **rate-limited** invece che "genuinely not found"
- Aumentare il delay tra richieste (da 15s a 25-30s) quando viene rilevato rate limiting
- NON salvarli in `partners_no_contacts`

**2. Aumentare il delay del checkpoint** (`src/lib/wcaCheckpoint.ts`)

Il delay attuale di 15 secondi tra richieste non e sufficiente per evitare il blocco di WCA. Portarlo a 20-25 secondi come default, con backoff automatico a 30s quando si rileva rate limiting.

**3. Pulire i falsi positivi gia salvati** (query SQL)

I profili marcati erroneamente come "not found" in `partners_no_contacts` (quelli con `company_name` che inizia con "WCA " e country_code = 'ZA') devono essere rimossi o marcati come `resolved = true`, cosi i prossimi job li riprovano.

### File da modificare

1. **`src/hooks/useDownloadProcessor.ts`** — Aggiungere rilevamento rate-limit basato su lunghezza HTML identica per profili consecutivi; trattare come errore temporaneo con delay aumentato
2. **`src/lib/wcaCheckpoint.ts`** — Aumentare il delay minimo tra richieste da 15s a 20s
3. **`public/chrome-extension/background.js`** — Nella risposta di `extractContactsForId`, includere la lunghezza esatta dell'HTML per permettere al processore di rilevare pagine template identiche
4. **Migrazione SQL** — DELETE o UPDATE dei record falsi positivi in `partners_no_contacts` per il Sud Africa

