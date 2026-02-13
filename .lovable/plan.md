

# Piano: Terminale di Download + Verifica Setting-Only

## Cosa viene fatto

### 1. Pannello Terminale in tempo reale

Un nuovo componente `DownloadTerminal` che mostra riga per riga cosa sta succedendo durante il download, in stile terminale (sfondo scuro, testo monospace, auto-scroll). Ogni riga mostra:

- Timestamp esatto
- Azione in corso (download, pausa, attesa, recovery...)
- WCA ID e nome azienda
- Delay calcolato con jitter applicato
- Risultato contatti (email/telefono trovati o meno)

Il terminale viene alimentato tramite un sistema di "log entries" salvati nel database nella tabella `download_jobs` in un campo JSONB `terminal_log` (ultimi 100 eventi), aggiornato ad ogni profilo dal processor. In questo modo il terminale si aggiorna in tempo reale tramite polling e sopravvive ai refresh della pagina.

Il componente viene posizionato nella tab "Scarica" dell'Operations Center, tra ActionPanel e JobMonitor.

### 2. Verifica che TUTTO venga dal Settings

Ho verificato il codice: il processor gia' usa esclusivamente i valori da `useScrapingSettings()`. Nessun valore e' hardcoded. Ogni parametro di timing passa dal pannello Settings > Scraping:

- `settings.delayMin` -- delay minimo
- `settings.delayDefault` -- delay predefinito
- `settings.jitterMin / jitterMax` -- range jitter
- `settings.antiBanEveryN / antiBanDurationS` -- pause periodiche
- `settings.interJobPauseS` -- pausa tra job
- `settings.keepAliveMs`, `settings.recoveryWait1/2/3`, ecc.

L'unico `Math.max` presente (riga 26 del processor) confronta il delay del job con `settings.delayMin` -- entrambi vengono dal settings, nessun numero fisso nel codice.

### 3. Garanzia di esecuzione strettamente sequenziale

Il processor gia' scarica UN SOLO profilo alla volta (loop `for` sequenziale). Aggiungero' nel terminale un log esplicito che mostra "Inizio profilo #X" e "Fine profilo #X -- attesa Ys" per rendere visibile che non ci sono mai due profili in parallelo.

## Dettaglio Tecnico

### File da creare

**`src/components/download/DownloadTerminal.tsx`**
- Componente React con stile terminale (bg nero/scurissimo, font mono, scrollbar custom)
- Legge i log dal campo `terminal_log` del job attivo tramite polling ogni 2s
- Ogni riga mostra: `[HH:MM:SS] AZIONE -- dettagli`
- Colori diversi per tipo: verde per successo, giallo per attesa/pausa, rosso per errore
- Auto-scroll verso il basso, con possibilita' di scrollare verso l'alto per rileggere
- Altezza fissa ~250px, scrollabile

### File da modificare

**`src/hooks/useDownloadProcessor.ts`**
- Aggiungere una funzione helper `appendLog(jobId, entry)` che fa un update JSONB per aggiungere una riga al campo `terminal_log`
- Chiamare `appendLog` ad ogni evento significativo:
  - `[START]` Inizio profilo #WCA_ID
  - `[OK]` Partner scaricato: "NomeAzienda" -- email: si/no, tel: si/no
  - `[WAIT]` Attesa Xs (delay base Ys * jitter Z.Zx)
  - `[PAUSE]` Pausa anti-ban Xs dopo N profili
  - `[PAUSE]` Pausa tra job: Xs
  - `[RECOVERY]` Tentativo recovery sessione...
  - `[NIGHT]` Pausa notturna fino alle HH:00
  - `[DONE]` Job completato
  - `[ERROR]` Errore: messaggio

**`src/pages/Operations.tsx`**
- Importare e inserire `DownloadTerminal` nella tab "download", sotto ActionPanel

### Migrazione database

Aggiungere colonna `terminal_log` (JSONB, default `[]`) alla tabella `download_jobs` per persistere gli ultimi 100 log del terminale.

## Risultato

Quando parti con un download, vedrai nel terminale qualcosa come:

```text
[19:42:03] START  Profilo #8842
[19:42:08] OK     Acme Logistics (Dubai, AE) -- email: si, tel: si
[19:42:08] WAIT   18s (base 15s * jitter 1.2x)
[19:42:26] START  Profilo #8843
[19:42:31] OK     Global Freight Co (Mumbai, IN) -- email: si, tel: no
[19:42:31] WAIT   22s (base 15s * jitter 1.47x)
[19:42:53] START  Profilo #8844
...
[19:45:12] PAUSE  Anti-ban: 52s dopo 8 profili
[19:46:04] START  Profilo #8850
```

Ogni riga e' un singolo profilo, mai due in parallelo. Puoi verificare visivamente che i tempi corrispondono a quanto impostato nel Settings.

