

## Ristrutturazione Download Management - Tutto in Una Pagina

### Problema attuale
Per avviare un download servono **4 click** attraverso 3 schermate diverse:
1. "Scarica Partner" (schermata azione)
2. Seleziona paesi + "Prosegui"
3. Seleziona network + "Prosegui"  
4. "Avvia Download"

Inoltre il file e' un monolite di **1903 righe** con 15+ componenti inline, difficile da mantenere.

### Nuova struttura: Layout a due colonne, zero navigazione

La pagina diventa un'unica schermata divisa in due zone:

```text
+------------------------------------------+----------------------------+
|  COLONNA SINISTRA (60%)                  |  COLONNA DESTRA (40%)      |
|                                          |                            |
|  [Cerca paese...]  [Filtri]              |  PANNELLO AZIONE           |
|                                          |                            |
|  +--------+ +--------+ +--------+       |  Paesi: IT, DE, FR         |
|  | Italia | | Germany| | France |       |  Network: [Tutti v]        |
|  | 45/50  | | 30/80  | | 0/120  |       |  Velocita: [===--]         |
|  +--------+ +--------+ +--------+       |  Stima: ~25 min            |
|  +--------+ +--------+ +--------+       |                            |
|  | Spain  | | UK     | | USA    |       |  [Scarica 150 mancanti]    |
|  | 12/35  | | 0/200  | | 10/500 |       |  [Aggiorna 45 esistenti]   |
|  +--------+ +--------+ +--------+       |                            |
|  ...                                     |  --- Job Attivi ---        |
|                                          |  IT: 23/50 [Pausa][Stop]   |
|                                          |  DE: 5/80  [Pausa][Stop]   |
+------------------------------------------+----------------------------+
```

### Cosa cambia concretamente

**1. Eliminazione del wizard a 3 step**
- Non c'e' piu' la schermata "Cosa vuoi fare?" 
- Non c'e' piu' il passaggio "Scegli Network" separato
- La selezione paesi e' sempre visibile a sinistra
- Il pannello azione a destra si aggiorna in tempo reale con i paesi selezionati

**2. Pannello azione contestuale (colonna destra)**
Quando selezioni uno o piu' paesi, il pannello mostra:
- Riepilogo: quanti partner nella directory, quanti gia' scaricati, quanti mancanti
- Selettore network (dropdown, default "Tutti")
- Slider velocita'
- Pulsante principale: "Scarica X mancanti" oppure "Aggiorna X esistenti"
- Se non ci sono paesi selezionati: mostra i job attivi e completati recenti

**3. Job attivi sempre visibili**
- I job in corso appaiono nella parte bassa del pannello destro (o sotto il pulsante)
- Non serve navigare in una schermata separata per vederli
- Mantengono tutte le metriche attuali (progresso, velocita', contatti trovati, pausa/stop)

**4. "Aggiorna Contatti" integrato**
- Invece di essere un'azione separata, diventa un toggle nel pannello: "Scarica mancanti" vs "Aggiorna contatti esistenti"
- Oppure un secondo pulsante sotto quello principale

**5. Strumenti avanzati**
- "Arricchisci dal Sito" e "Analisi Network" restano in un collapsible in fondo alla pagina
- WCA Browser resta nel collapsible

### Dettagli tecnici

**Decomposizione del file (da 1903 righe a componenti)**

Il file `DownloadManagement.tsx` viene spezzato in moduli:

| File | Contenuto |
|------|-----------|
| `src/pages/DownloadManagement.tsx` | Layout principale, ~150 righe |
| `src/components/download/CountryGrid.tsx` | Griglia paesi con filtri, ricerca, statistiche |
| `src/components/download/ActionPanel.tsx` | Pannello destro: riepilogo + azione + network + velocita' |
| `src/components/download/JobMonitor.tsx` | Lista job attivi/completati con controlli |
| `src/components/download/JobCard.tsx` | Singola card job (estratta dall'attuale) |
| `src/components/download/WcaSessionIndicator.tsx` | Indicatore sessione WCA (estratto) |
| `src/components/download/AdvancedTools.tsx` | Sezione collapsible con Enrich + Network Analysis |
| `src/components/download/theme.ts` | Oggetto tema (le 130 righe di `t()`) |

**Flusso utente semplificato:**
1. Apri Download Management - vedi subito la griglia paesi
2. Clicca su uno o piu' paesi - il pannello destro si popola
3. Clicca "Scarica" - parte. Fine.

**Nessuna modifica al backend** - le Edge Functions e la logica dei job restano identiche.

