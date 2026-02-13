

# Fix: Protezione Anti-Ban per Download WCA

## Problemi Identificati

1. **Delay fisso senza jitter**: il WCA processor usa un delay costante (es. 10s esatti), pattern facilmente rilevabile come bot
2. **Nessuna pausa lunga**: a differenza del RA processor, non ci sono pause ogni N profili
3. **Zero pausa tra job consecutivi**: quando un job finisce, il successivo parte in 5 secondi
4. **Delay troppo basso**: i job recenti usano 10s invece del minimo sicuro di 15s

## Modifiche Pianificate

### 1. Aggiungere jitter al delay in `useDownloadProcessor.ts` (riga 248-250)

Sostituire il delay fisso con un delay randomizzato (0.8x - 1.5x), identico alla logica gia' usata nel RA processor.

```text
// PRIMA (prevedibile):
await new Promise(r => setTimeout(r, delaySeconds * 1000));

// DOPO (randomizzato):
const jitter = delaySeconds * 1000 * (0.8 + Math.random() * 0.7);
await new Promise(r => setTimeout(r, jitter));
```

### 2. Aggiungere pausa lunga ogni 10 profili in `useDownloadProcessor.ts`

Inserire una pausa di 45-60 secondi ogni 10 profili elaborati (dopo riga 247, prima del delay normale). Simile a quanto gia' implementato nel RA processor.

### 3. Aggiungere pausa tra job consecutivi in `useDownloadProcessor.ts` (riga 277-300)

Nel polling loop, dopo il completamento di un job, attendere 30 secondi prima di prendere il prossimo dalla coda. Questo evita che 3 job da paesi piccoli vengano eseguiti a raffica senza interruzione.

### 4. Forzare delay minimo a 15s in `useDownloadProcessor.ts` (riga 26)

```text
// PRIMA:
const delaySeconds = job.delay_seconds || settings.delayDefault;

// DOPO:
const delaySeconds = Math.max(job.delay_seconds || settings.delayDefault, settings.delayMin);
```

### 5. Forzare delay minimo anche nella creazione job in `ActionPanel.tsx`

Assicurare che il valore di `delay_seconds` passato a `createJob.mutateAsync` sia almeno `scrapingSettings.delayMin`.

## File da Modificare

- `src/hooks/useDownloadProcessor.ts`: jitter, pause lunghe, pausa tra job, delay minimo
- `src/components/download/ActionPanel.tsx`: validazione delay minimo alla creazione

## Risultato Atteso

- Delay tra profili: 12-22s (con jitter su base 15s) invece di 10s fissi
- Pausa lunga: 45-60s ogni 10 profili
- Pausa tra job: 30s dopo ogni job completato
- Pattern di traffico molto meno prevedibile e piu' simile a navigazione umana

