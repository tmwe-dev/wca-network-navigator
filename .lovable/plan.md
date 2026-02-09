

# Download Management - Pagina Unica a Flusso Guidato

Riprogettazione completa della pagina Download Management: da 4 tab separati a un'unica esperienza guidata passo-passo, con lo stile visivo della pagina Campaigns (sfondo scuro, glassmorphism, tema spaziale).

---

## Concetto

L'utente viene guidato attraverso un flusso lineare. Ogni passo si espande al centro della pagina, mentre a destra appare un elenco sospeso (floating) dei partner scaricati in tempo reale, cliccabile per vedere i dettagli in un popup.

```text
+-----------------------------+-----------------------+
|                             |                       |
|   AREA CENTRALE             |  LISTA SOSPESA        |
|                             |  (partner scaricati)  |
|   Step 1: Cosa vuoi fare?   |                       |
|   Step 2: Configura         |  [Partner 1]  [x]     |
|   Step 3: Processo LIVE     |  [Partner 2]  [x]     |
|                             |  [Partner 3]  [x]     |
|   [statistiche live]        |  ...                  |
|   [log in tempo reale]      |                       |
|                             |                       |
+-----------------------------+-----------------------+
```

---

## Step 1 - "Cosa vuoi fare?"

Tre opzioni presentate come card grandi con icone:

- **Scarica Partner** - Download sequenziale dalla directory WCA (manuale o automatico)
- **Arricchisci dal Sito** - Leggi siti web di partner gia scaricati con AI
- **Analisi Network** - Verifica a quali gruppi WCA hai accesso ai dati

Cliccando su un'opzione, si passa allo Step 2.

## Step 2 - Configurazione (varia in base alla scelta)

### Se "Scarica Partner":
- Modalita: Manuale (range ID) / Automatico (riprendi da ultimo ID)
- Slider o input per **tempo di attesa** tra un download e l'altro (es. 1s, 3s, 5s, 10s, 30s)
- Pausa extra ogni N partner (configurabile)
- Pulsante "Avvia"

### Se "Arricchisci dal Sito":
- Filtri per paese, tipo partner, solo non arricchiti
- Selezione partner con checkbox
- Pulsante "Avvia Arricchimento"

### Se "Analisi Network":
- Lista gruppi WCA con toggle membro/non membro
- Bottone test a campione

## Step 3 - Processo LIVE

Quando l'utente avvia il processo, la pagina si trasforma in una dashboard live:

### Pannello centrale:
- **Indicatore attuale**: "Scaricando ID #11472..." con animazione pulsante
- **Countdown**: timer visibile prima del prossimo download
- **Statistiche live** in badge luminosi (come i badge della pagina Campaigns): Trovati, Nuovi, Aggiornati, Errori, Velocita (partner/min)
- **Log scorrevole**: ultime righe di attivita con colori per stato (verde = nuovo, blu = aggiornato, grigio = non trovato, rosso = errore)
- **Pulsanti**: Pausa / Riprendi / Stop

### Pannello destro flottante:
- Lista verticale sospesa (stile identico ai partner selezionati nella pagina Campaigns)
- Ogni chip mostra: nome azienda, bandiera paese, badge "Nuovo"/"Aggiornato"
- Click su un chip = apri popup con tutti i dati scaricati
- Il pannello si popola in tempo reale mentre i download avvengono
- Scroll automatico verso il basso per i nuovi arrivi

### Popup dettaglio partner:
- Dialog con glassmorphism
- Mostra: nome, citta, paese, email, telefono, sito web, network, servizi, riassunto AI, rating
- JSON raw collassabile per dati completi

---

## Stile Visivo

La pagina adotta lo stesso approccio della pagina Campaigns:
- Sfondo scuro pieno (`bg-slate-950`) senza il globo 3D, ma con un gradiente sottile
- Pannelli in glassmorphism (`bg-black/40 backdrop-blur-xl border-amber-500/20`)
- Testi in `amber`, `emerald`, `blue` per i diversi stati
- Badge luminosi come nella barra delle statistiche Campaigns
- Header della pagina con sfondo scuro solido come quello delle Campaigns (`bg-slate-900/95`)
- Animazioni fade-in per nuovi elementi nella lista

---

## Dettagli Tecnici

### File da creare
- `src/pages/DownloadManagement.tsx` - riscrittura completa come pagina unica a flusso guidato

### File da modificare
- `src/components/layout/AppLayout.tsx` - aggiungere la rotta `/download-management` al trattamento "sfondo scuro" come `/campaigns`

### File da mantenere (riutilizzati internamente)
- `src/data/wcaFilters.ts` - costanti network/regioni/servizi
- `src/hooks/useNetworkConfigs.ts` - per la sezione Analisi Network
- `src/hooks/useDownloadQueue.ts` - puo servire per persistenza stato
- `src/lib/api/wcaScraper.ts` - funzione di scraping

### File da eliminare (logica integrata nella pagina unica)
- `src/components/download/NetworkAnalysis.tsx`
- `src/components/download/DownloadQueue.tsx`
- `src/components/download/DownloadRunner.tsx`
- `src/components/download/BatchEnrichment.tsx`

### Delay configurabile
L'utente sceglie il tempo di attesa tramite uno slider con valori predefiniti: 0s, 1s, 3s, 5s, 10s, 30s. Opzione separata per "pausa lunga ogni N partner" (es. 30s ogni 10 partner).

### Persistenza
- Ultimo ID processato salvato in `localStorage` (come ora)
- Stato dei network configs nel database (come ora)

