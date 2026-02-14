
# Piano: Tachimetro Velocita' Scraping + Certificazione Sicurezza

## Analisi della procedura attuale (certificazione)

### Flusso per 3 paesi

I job vengono eseguiti **uno alla volta, in sequenza**. Se lanci 3 paesi, il secondo parte solo dopo che il primo e' completato + 60s di pausa inter-job.

```text
PAESE 1 (es. 50 profili)
  Profilo 1 ──[30-50s]──> Profilo 2 ──[30-50s]──> ... Profilo 8 ──[PAUSA 60s]──> Profilo 9 ...
  Tempo stimato: ~50 profili x 40s media + 6 pause anti-ban x 60s = ~2370s (~40 min)

──[PAUSA INTER-JOB 60s]──>

PAESE 2 (es. 30 profili)
  ... stessa cadenza ...

──[PAUSA INTER-JOB 60s]──>

PAESE 3
  ...
```

### Tempistiche per singolo profilo

```text
1. Richiesta al server WCA (via estensione Chrome): ~3-5s
2. Salvataggio contatti nel DB: ~1-2s
3. Health check sessione (ogni 3 profili): ~1s
4. ATTESA con jitter: base 20s x (1.5 - 2.5) = 30-50s (media 40s)
---
Totale per profilo: ~35-55s (media ~43s)
```

### Garanzie anti-ban

| Protezione | Valore |
|---|---|
| Delay minimo assoluto (hard floor nel codice) | 15s |
| Delay effettivo minimo (con jitter 1.5x) | 30s |
| Delay effettivo massimo (con jitter 2.5x) | 50s |
| Pausa anti-ban | 60s ogni 8 profili |
| Pausa tra job consecutivi | 60s |
| Pausa lunga periodica | 3 min ogni 250 profili |
| Job paralleli | IMPOSSIBILE (DB lock) |
| Emergency stop | Immediato (cancelRef) |
| Health check sessione | Ogni 3 profili |
| Recovery automatico | Dopo 5 profili vuoti consecutivi |

Il sistema e' **piu' lento di un umano che naviga manualmente** — un umano potrebbe aprire un profilo ogni 10-15 secondi. Noi aspettiamo 30-50 secondi. Questo e' il margine di sicurezza.

## Il Tachimetro

Un componente visivo ispirato a un tachimetro automobilistico, posizionato nella top bar dell'Operations Center (visibile sempre quando c'e' un job attivo). Mostra:

1. **Ago del tachimetro**: indica i secondi dall'ultima richiesta al server (0-60s scala)
2. **Zone colorate**:
   - Verde (30-60s): zona sicura, velocita' ideale
   - Giallo (15-30s): zona di attenzione
   - Rosso (0-15s): zona pericolosa (non dovrebbe mai arrivarci)
3. **Valore numerico**: secondi esatti dall'ultima richiesta
4. **Label**: "Ultima richiesta Xs fa"
5. **Tasto STOP rosso**: integrato accanto al tachimetro, sempre visibile

### Dati per il tachimetro

Il tachimetro legge il campo `updated_at` del job attivo (aggiornato ad ogni profilo processato) e calcola i secondi trascorsi con un timer locale che si aggiorna ogni secondo.

### Posizione UI

Nella top bar dell'Operations Center, tra il badge "N job attivi" e il tasto tema. Il tachimetro e' compatto (circa 80x80px come un mini gauge circolare) con il tasto STOP integrato alla sua destra.

## File da modificare

### 1. Nuovo componente: `src/components/download/SpeedGauge.tsx`

Un gauge SVG semicircolare che mostra:
- Arco colorato (rosso -> giallo -> verde) da 0 a 60 secondi
- Ago che punta al valore corrente
- Numero centrale grande con i secondi
- Testo piccolo "sec dall'ultima richiesta"

Il componente riceve come prop l'`updated_at` del job attivo e usa un `useEffect` con `setInterval(1000)` per aggiornare il contatore ogni secondo.

### 2. `src/pages/Operations.tsx`

Inserire il `SpeedGauge` nella top bar, visibile solo quando ci sono job attivi. Layout:

```text
[Operations Center]  [2 job attivi ●]  [TACHIMETRO]  [BLOCCA TUTTO]  [WCA Session]  [Tema]
```

### 3. `src/hooks/useDownloadProcessor.ts`

Aggiungere un log nel terminale che mostra il delay calcolato PRIMA di attendere (gia' presente nella riga 364, nessuna modifica necessaria).

## Dettaglio tecnico del componente SpeedGauge

```text
Props:
  - lastUpdatedAt: string (ISO timestamp dal job attivo)
  - onStop: () => void (callback per emergency stop)

State:
  - elapsed: number (secondi dall'ultimo aggiornamento, calcolato localmente)

Rendering:
  - SVG semicircolare 80x80px
  - Arco di 180 gradi diviso in 3 zone colorate
  - Ago rotante basato su elapsed (0s = tutto a sinistra/rosso, 60s = tutto a destra/verde)
  - Numero centrale: elapsed + "s"
  - Sotto: "dall'ultima richiesta"
```

Il gauge si resetta a 0 ogni volta che `lastUpdatedAt` cambia (nuovo profilo processato), poi conta in su fino alla prossima richiesta. Quando il contatore e' nella zona verde (30-60s), tutto e' nella norma. Se scendesse sotto i 15s significherebbe che le richieste sono troppo ravvicinate.
