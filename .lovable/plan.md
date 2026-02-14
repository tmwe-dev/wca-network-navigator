

# Layout a Due Colonne per Acquisizione Partner

## Problema attuale
La pagina ha una struttura verticale con toolbar, stats bar, network bar tutti impilati in alto, sprecando circa meta' dello schermo verticale prima di arrivare ai dati. La coda dei partner e il canvas sono compressi nello spazio rimanente.

## Nuova struttura

```text
+----------------------------------+----------------------------------------------+
| COLONNA SINISTRA (35%)           | COLONNA DESTRA (65%)                         |
|                                  |                                              |
| [Selettori Paesi/Network]        |                                              |
| [Chips paesi selezionati]        |                                              |
| [Scansiona] [Ext] [Sessione]     |                                              |
| [Enrich] [Deep Search] [Speed]   |        PARTNER CANVAS                        |
| [Scan stats: trovati/nuovi]      |        (scheda partner corrente)             |
|                                  |                                              |
| --- Live Stats (compatte) ---    |                                              |
| --- Network Performance ---      |                                              |
|                                  |                                              |
| ════════════════════════════     |                                              |
| PARTNER QUEUE                    |                                              |
| (lista scrollabile)              |                                              |
|                                  |                                              |
| [▶ Avvia / ⏸ Pausa / ■ Stop]    |                                              |
+----------------------------------+----------------------------------------------+
|              ACQUISITION BIN (centrato in basso)                                |
+---------------------------------------------------------------------------------+
```

## Dettaglio tecnico

### File: `src/pages/AcquisizionePartner.tsx` (righe 1017-1265)

Ristrutturare il JSX del return:

1. **Layout principale**: `grid grid-cols-[35%_1fr]` al posto della struttura verticale attuale
2. **Colonna sinistra**: contiene in verticale:
   - Toolbar compattata (selettori paesi/network impilati verticalmente invece che orizzontali, switches e slider sotto)
   - Pulsante Scansiona + indicatori estensione/sessione + scan stats (compatti)
   - Live Stats Bar (compattata, impilata verticalmente)
   - Network Performance Bar
   - Partner Queue (flex-1, occupa tutto lo spazio rimanente)
   - Pulsanti azione (Avvia/Pausa/Stop) in fondo
3. **Colonna destra**: contiene solo il PartnerCanvas, che occupa tutto lo spazio disponibile

### File: `src/components/acquisition/AcquisitionToolbar.tsx`

Compattare per layout verticale:
- Rimuovere `ml-auto` dai controlli pipeline (Enrich, Deep Search, Velocita')
- Impilare i controlli in righe compatte invece che in un unico row largo
- Ridurre padding e gap

### Risultato

- Lo schermo viene sfruttato interamente senza sprechi verticali
- I filtri e la coda sono sempre visibili a sinistra
- Il canvas occupa il 65% della larghezza e tutta l'altezza disponibile
- Nessun scrolling necessario per vedere i dati del partner

### File modificati

1. `src/pages/AcquisizionePartner.tsx` -- ristrutturazione layout da verticale a due colonne
2. `src/components/acquisition/AcquisitionToolbar.tsx` -- compattamento per colonna stretta

