
## Piano: Pannello Impostazioni Download Centralizzato

### Problema
Tutti i parametri che controllano la velocita' e il comportamento dello scraping sono hardcoded nel codice sorgente. Questo impedisce di calibrare il sistema senza modificare il codice, aumentando il rischio di blocco da parte di WCA.

### Soluzione
Creare una nuova sezione "Scraping & Sicurezza" nelle Impostazioni che permetta di configurare ogni parametro critico, salvandoli in `app_settings` nel database. Tutti i componenti di download leggeranno da li' invece di usare valori fissi.

### Parametri da centralizzare

| Parametro | Valore attuale (hardcoded) | Dove si trova |
|-----------|---------------------------|---------------|
| Delay minimo tra partner | 0s | Slider min in toolbar |
| Delay massimo tra partner | 60s | Slider max in toolbar |
| Delay predefinito | 15s (Acquisizione), 5s (Download) | AcquisizionePartner, ActionPanel |
| Tempo medio scraping stimato | 15s | ActionPanel (per calcolo ETA) |
| Keep-alive interval | 30s | AcquisizionePartner |
| Soglia auto-esclusione network | 3 tentativi | AcquisizionePartner |
| Soglia recovery sessione | 3 vuoti consecutivi | AcquisizionePartner |
| Soglia anti-throttling | 120s (gap tra partner) | AcquisizionePartner |
| Pausa tra retry recovery | 3s, 10s, 30s | AcquisizionePartner |
| Arricchimento sito (default) | OFF | AcquisizionePartner |
| Deep Search (default) | OFF | AcquisizionePartner |
| Max retry per partner fallito | 2 | AcquisizionePartner |
| Pausa lunga programmata | Non presente | Da aggiungere |

### Nuova UI nelle Impostazioni

Un nuovo tab **"Scraping"** (icona Shield) con tre sezioni:

**1. Velocita' e Limiti**
- Slider: Delay minimo consentito (default: 10s) — impedisce di andare troppo veloci
- Slider: Delay massimo (default: 60s)
- Slider: Delay predefinito per nuovi job (default: 15s)
- Input: Tempo medio scraping per calcolo ETA (default: 15s)

**2. Sicurezza Sessione**
- Slider: Soglia recovery sessione (default: 3 vuoti consecutivi)
- Slider: Soglia auto-esclusione network (default: 3 tentativi)
- Slider: Soglia anti-throttling in secondi (default: 120s)
- Input: Pausa recovery 1° tentativo (default: 3s)
- Input: Pausa recovery 2° tentativo (default: 10s)
- Input: Pausa recovery 3° tentativo (default: 30s)
- Input: Keep-alive interval (default: 30s)
- Input: Max retry per partner con errore di caricamento (default: 2)

**3. Pause Programmate**
- Switch: Attiva pausa notturna (orario di stop/ripartenza)
- Input: Pausa lunga ogni N partner (es. pausa di 5 minuti ogni 100 partner)
- Questo serve per simulare un comportamento umano e ridurre il rischio di ban

### Hook centralizzato: `useScrapingSettings`

Nuovo hook che:
- Legge tutti i parametri da `app_settings` via `useAppSettings()`
- Li espone come oggetto tipizzato con valori di default
- Viene usato da AcquisizionePartner, ActionPanel, AcquisitionToolbar, JobMonitor, ResyncConfigure

### Chiavi in `app_settings`

```
scraping_delay_min         = "10"
scraping_delay_max         = "60"
scraping_delay_default     = "15"
scraping_avg_time          = "15"
scraping_keepalive_ms      = "30000"
scraping_exclude_threshold = "3"
scraping_recovery_threshold = "3"
scraping_throttle_gap_ms   = "120000"
scraping_recovery_wait_1   = "3000"
scraping_recovery_wait_2   = "10000"
scraping_recovery_wait_3   = "30000"
scraping_max_retries       = "2"
scraping_pause_every_n     = "0"      (0 = disattivo)
scraping_pause_duration_s  = "300"    (5 min)
scraping_night_pause       = "false"
scraping_night_stop_hour   = "02"
scraping_night_start_hour  = "07"
```

### File da modificare

**File nuovi:**
- `src/hooks/useScrapingSettings.ts` — Hook centralizzato con valori tipizzati e default

**File da modificare:**
- `src/pages/Settings.tsx` — Aggiungere tab "Scraping"
- `src/pages/AcquisizionePartner.tsx` — Sostituire tutte le costanti hardcoded con valori dal hook
- `src/components/download/ActionPanel.tsx` — Usare delay default e avgScrapeTime dal hook
- `src/components/acquisition/AcquisitionToolbar.tsx` — Leggere min/max/step dal hook
- `src/components/download/JobMonitor.tsx` — Usare DELAY_VALUES dal hook
- `src/components/download/ResyncConfigure.tsx` — Usare DELAY_VALUES dal hook
- `src/components/download/theme.ts` — Rimuovere DELAY_VALUES/DELAY_LABELS (spostati nel hook)

### Logica pausa programmata

Nel loop di acquisizione (`runExtensionLoop`), dopo ogni partner processato:
1. Controlla se `scraping_pause_every_n > 0` e se il contatore e' multiplo di quel valore → pausa di `scraping_pause_duration_s` secondi
2. Controlla se `scraping_night_pause` e' attivo e l'ora corrente e' nell'intervallo di stop → pausa fino all'ora di ripartenza

### Impatto sulla sicurezza

- Il delay minimo impedisce di impostare velocita' pericolose (sotto i 10s) a meno che non venga deliberatamente abbassato nelle impostazioni
- Le pause programmate riducono drasticamente il rischio di pattern detection
- Tutti i parametri sono modificabili senza toccare il codice
