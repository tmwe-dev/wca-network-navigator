
# Animazione Live "Card Flip" nel Viewer Dati Scaricati

## Concetto

Aggiungere al dialogo "Dati Scaricati" due modalita':

1. **Modalita' manuale** (job non attivo): navigazione libera avanti/indietro come ora
2. **Modalita' LIVE** (job attivo): un toggle "LIVE" appare nella toolbar. Quando attivato, il viewer si posiziona automaticamente sull'ultimo partner scaricato e ad ogni nuovo partner esegue un'animazione "card flip":
   - La card corrente **cade all'indietro** (rotazione 3D sull'asse X, da 0 a -90 gradi, con opacity che va a 0)
   - Dopo 300ms, la nuova card **sale dal basso** (da +90 gradi a 0, con opacity da 0 a 1)
   - Effetto visivo: come una carta che si ribalta su un tavolo e ne appare una nuova

## Modifiche tecniche

### 1. JobMonitor.tsx
- Passare `jobStatus={job.status}` come nuova prop a `JobDataViewer`, cosi' il viewer sa se il job e' attivo

### 2. JobDataViewer.tsx

**Nuove prop:**
- `jobStatus: string` -- per sapere se il job e' "running"

**Nuovi state:**
- `liveMode: boolean` -- toggle per la modalita' live (default: false)
- `animPhase: "idle" | "exit" | "enter"` -- fase dell'animazione corrente

**Logica live:**
- Quando `liveMode` e' attivo e `processedIds.length` cambia (nuovo partner scaricato):
  1. Imposta `animPhase = "exit"` (la card corrente cade, durata 400ms)
  2. Dopo 400ms, aggiorna `currentIndex` all'ultimo partner e imposta `animPhase = "enter"` (la nuova card sale, durata 400ms)
  3. Dopo altri 400ms, torna a `animPhase = "idle"`
- Il refetch dei dati usa `refetchInterval: 5000` quando liveMode e' attivo, per catturare i nuovi partner

**Animazione CSS (inline styles con perspective 3D):**
- `exit`: `transform: perspective(600px) rotateX(-90deg); opacity: 0; transition: all 0.4s ease-in`
- `enter`: partenza da `rotateX(90deg)` e transizione a `rotateX(0deg); opacity: 1; transition: all 0.4s ease-out`
- `idle`: nessuna trasformazione

**UI aggiuntiva:**
- Quando il job e' "running", appare un bottone/toggle "LIVE" nella barra di navigazione, con un pallino verde pulsante
- In modalita' LIVE i bottoni avanti/indietro sono disabilitati (la navigazione e' automatica)
- Il contatore mostra "LIVE -- Partner N di M" con un'icona animata

### File modificati

1. `src/components/download/JobDataViewer.tsx` -- aggiunta prop jobStatus, toggle LIVE, animazione 3D card flip, refetch automatico
2. `src/components/download/JobMonitor.tsx` -- passaggio prop jobStatus a JobDataViewer
