
# Piano: Semplificazione Radicale Parametri Scraping

## Concetto

Eliminare tutti i parametri complessi (jitter moltiplicativo, pause anti-ban, pause programmate, pausa notturna, inter-job pause, recovery wait multipli, etc.) e sostituirli con **due sole regole**:

1. **Una richiesta per volta** (gia' garantito dal DB lock)
2. **Minimo 15 secondi tra una richiesta e l'altra**, con variabilita' casuale di +/-3 secondi (range 12-18s)

## Cosa viene eliminato

| Parametro eliminato | Motivo |
|---|---|
| delayMin, delayMax, delayDefault | Sostituiti da un singolo "baseDelay" (15s) |
| jitterMin, jitterMax | Sostituiti da variazione +/-3s |
| antiBanEveryN, antiBanDurationS | Non servono piu': il delay base e' gia' sicuro |
| interJobPauseS | Rimosso: il delay base copre la pausa |
| pauseEveryN, pauseDurationS | Rimossi: pause programmate non servono |
| nightPause, nightStopHour, nightStartHour | Rimossi |
| avgScrapeTime | Rimosso |
| throttleGapMs | Rimosso |
| recoveryWait1, recoveryWait2, recoveryWait3 | Hardcoded a 3s, 10s, 30s nel codice (non configurabili) |

## Cosa resta

| Parametro | Valore | Descrizione |
|---|---|---|
| `scraping_base_delay` | **15** | Secondi di attesa base tra una richiesta e l'altra |
| `scraping_variation` | **3** | Variazione random in secondi (+/- questo valore) |

Il delay effettivo sara': `baseDelay + random(-variation, +variation)` = **12-18 secondi**.

Con un hard floor di `Math.max(result, 10)` nel codice per sicurezza assoluta.

## File da modificare

### 1. `src/hooks/useScrapingSettings.ts` -- Riscrittura completa

L'interfaccia `ScrapingSettings` passa da 24 campi a 6 campi essenziali:
- `baseDelay` (15s) -- delay base tra richieste
- `variation` (3s) -- variazione +/-
- `keepAliveMs` (30000) -- keep-alive del browser (tecnico, resta)
- `recoveryThreshold` (3) -- dopo N vuoti consecutivi fa recovery
- `excludeThreshold` (3) -- soglia auto-esclusione network
- `maxRetries` (2) -- retry per partner fallito

Il `KEY_MAP` viene aggiornato di conseguenza. Le funzioni `isNightPauseActive` e `msUntilNightEnd` vengono rimosse.

### 2. `src/hooks/useDownloadProcessor.ts` -- Semplificazione delay

Il blocco delay (righe 379-400) diventa:

```text
// Calcolo delay semplificato: base +/- variation
const variation = Math.floor(Math.random() * (settings.variation * 2 + 1)) - settings.variation;
const actualDelay = Math.max(settings.baseDelay + variation, 10); // hard floor 10s
await appendLog(jobId, "WAIT", actualDelay + "s");
await new Promise(r => setTimeout(r, actualDelay * 1000));
```

Vengono rimossi:
- Blocco anti-ban (righe 379-390)
- Blocco pause programmate (righe 367-377)
- Blocco pausa notturna (righe 355-365)
- Calcolo jitter moltiplicativo (righe 392-400)
- Inter-job pause (righe 446-449)

La riga di log iniziale (riga 46) viene semplificata per mostrare solo il delay base e la variazione.

### 3. `src/components/settings/ScrapingSettings.tsx` -- UI semplificata

Da 4 card con ~20 controlli a **1 sola card** con:
- Slider per "Delay base" (10-60s, default 15)
- Slider per "Variazione" (0-10s, default 3)
- Info: "Delay effettivo: 12-18 secondi"
- Soglia recovery (slider 1-10)
- Max retry (slider 0-5)

Tutto il resto (jitter, anti-ban, pause programmate, pausa notturna) sparisce dalla UI.

### 4. `src/components/download/SpeedGauge.tsx` -- Adattamento scala

Aggiornare la scala del tachimetro: le zone colorate si adattano al nuovo delay base (verde = sopra baseDelay, giallo = vicino, rosso = sotto 10s).

### 5. `src/components/acquisition/AcquisitionToolbar.tsx` -- Aggiornamento slider

Lo slider velocita' nella toolbar usa `settings.baseDelay` come default e rimuove i riferimenti a delayMin/delayMax.

### 6. Pulizia DB -- Rimozione vecchi parametri

Query SQL per rimuovere da `app_settings` tutti i vecchi parametri (scraping_delay_min, scraping_delay_max, scraping_jitter_min, etc.) e inserire i due nuovi (`scraping_base_delay = 15`, `scraping_variation = 3`).
