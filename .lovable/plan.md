

## Piano: Ristrutturazione Completa delle Maschere Operative

### Obiettivo
Trasformare Partner Hub, Acquisizione Partner e Download Management in un'unica esperienza moderna, potente e immersiva, con estetica glassmorphism avanzata, animazioni fluide e layout full-screen ergonomico.

---

### Architettura: 3 maschere ridisegnate

Ogni maschera usa lo schermo intero (nascondendo i margini della sidebar) con sfondi a gradiente animato, pannelli in glassmorphism e transizioni cinematografiche.

---

### 1. Partner Hub - "Command Center"

**Layout attuale**: Lista 400px fissa a sinistra + dettaglio a destra su sfondo piatto.

**Nuovo layout**: Full-screen con tre zone fluide.

```text
+------------------------------------------------------------------+
|  [Barra di Ricerca Globale con filtri inline]     [Vista] [Theme] |
+------------------------------------------------------------------+
|                          |                                        |
|   LISTA PARTNER          |   DETTAGLIO PARTNER                    |
|   (30-40% larghezza)     |   (60-70% larghezza)                  |
|                          |                                        |
|   Card glassmorphism     |   Header con gradiente animato         |
|   con hover glow         |   Sezioni a schede orizzontali         |
|   e stripe laterale      |   (Info | Contatti | Servizi | Social) |
|   qualita' contatti      |                                        |
|                          |   Mini-globo integrato (se filiali)     |
|   Pannello ridimensionab.|   KPI cards con animazione contatore   |
|                          |                                        |
+------------------------------------------------------------------+
```

**Miglioramenti specifici**:
- Sfondo con gradiente radiale animato che pulsa lentamente (ambient glow)
- Card partner nella lista con effetto glassmorphism (`bg-white/[0.04] backdrop-blur-xl`)
- Hover sulle card: glow laterale + leggero scale (1.02) + ombra colorata
- Stripe laterale qualita' contatti con gradiente (verde/ambra/rosso) e pulsazione
- Pannello dettaglio con header full-width a gradiente dinamico basato sul paese
- Sezioni del dettaglio organizzate in tabs orizzontali invece di collapsible verticali
- Contatori KPI con animazione "count-up" quando si seleziona un partner
- Pannello ridimensionabile (react-resizable-panels) tra lista e dettaglio
- Transizione di entrata fluida quando si seleziona un partner (scale-in + fade)
- Vista "Paesi" con card-mappa interattive piu' grandi e hover tooltip

**File da modificare**:
- `src/pages/PartnerHub.tsx` — Ristrutturazione completa del layout e dello stile
- `src/components/partners/PartnerCard.tsx` — Nuova card glassmorphism (componente estratto)

---

### 2. Acquisizione Partner - "Mission Control"

**Layout attuale**: Toolbar + stats bar + split 35/65 queue/canvas + bin in basso. Aspetto funzionale ma standard.

**Nuovo layout**: Full-screen immersivo con dashboard live.

```text
+------------------------------------------------------------------+
|  [Paese/Network] [Delay ████████] [Enrich] [Deep]  [Play|Pause]  |
+------------------------------------------------------------------+
|  DASHBOARD LIVE (barra compatta con KPI animati)                  |
|  [Processati: 45/120] [Email: 38] [Tel: 29] [Completi: 25]       |
|  [██████████████████░░░░░░░░] 37%    Session: ● Attiva            |
+------------------------------------------------------------------+
|                                |                                  |
|   CODA PARTNER                 |   CANVAS PARTNER                 |
|   (35%)                        |   (65%)                          |
|                                |                                  |
|   Glassmorphism cards          |   Documento "costruzione live"   |
|   con progress indicator       |   con sezioni che appaiono       |
|   per singola voce             |   sequenzialmente con fade-in    |
|                                |                                  |
|   Scroll virtuale              |   Bordo animato phase-aware     |
|   per performance              |                                  |
+------------------------------------------------------------------+
|           [████ 45/120 partner acquisiti ████]                     |
|           [● 25 completi  ● 20 incompleti]                        |
+------------------------------------------------------------------+
```

**Miglioramenti specifici**:
- Sfondo scuro con gradiente radiale pulsante (effetto "respiro" della stazione)
- Dashboard live compatta in alto con KPI animati (numeri che si aggiornano con transizione)
- Barra di progresso principale con gradiente animato e percentuale
- Indicatore di sessione WCA con pulsazione (verde/ambra/rosso)
- Queue items con micro-progress: ogni riga mostra un indicatore di fase (pallino che si riempie)
- Canvas partner con bordo che cambia colore in base alla fase (sky per download, viola per extract, emerald per complete)
- Effetto "comet trail" piu' elaborato con particelle
- Network Performance Bar ridisegnata come barra orizzontale compatta con sparkline
- Animazione di transizione tra un partner e l'altro: slide-out a sinistra + slide-in da destra
- Toolbar compatta su una riga con tutti i controlli inline
- Sfondo della coda che si illumina leggermente quando un partner viene completato

**File da modificare**:
- `src/pages/AcquisizionePartner.tsx` — Layout e stile (logica pipeline invariata)
- `src/components/acquisition/PartnerCanvas.tsx` — Stile glassmorphism + transizioni migliorate
- `src/components/acquisition/PartnerQueue.tsx` — Card glassmorphism + micro-progress
- `src/components/acquisition/AcquisitionBin.tsx` — Redesign con animazione piu' elaborata
- `src/components/acquisition/AcquisitionToolbar.tsx` — Layout compatto inline
- `src/components/acquisition/NetworkPerformanceBar.tsx` — Redesign compatto

---

### 3. Download Management - "Globe Operations"

**Layout attuale**: Griglia paesi (60%) + azione/monitor (40%). Gia' glassmorphism.

**Nuovo layout**: Full-screen con dashboard operativa.

```text
+------------------------------------------------------------------+
|  Download Management  [Scarica | Aggiorna]   [Session] [Theme]   |
+------------------------------------------------------------------+
|  STATISTICHE GLOBALI (barra orizzontale compatta)                |
|  [249 paesi] [187 scansionati] [12.450 partner] [8.200 email]   |
+------------------------------------------------------------------+
|                                |                                  |
|   GRIGLIA PAESI                |   PANNELLO OPERATIVO             |
|   (60%)                        |   (40%)                          |
|                                |                                  |
|   Card glassmorphism con       |   ActionPanel migliorato         |
|   gradienti per stato          |   con preview del lavoro         |
|                                |                                  |
|   Barra completamento          |   Job Monitor con timeline       |
|   animata per paese            |   live e sparkline velocita'     |
|                                |                                  |
+------------------------------------------------------------------+
|  [Strumenti Avanzati - collapsibile]                              |
+------------------------------------------------------------------+
```

**Miglioramenti specifici**:
- Barra statistiche globali in alto con KPI aggregati animati
- Card paesi con hover glow piu' pronunciato e transizioni piu' fluide
- Badge selezionati con animazione di entrata (scale-in)
- Job Monitor con timeline grafica (non solo testo)
- Sparkline di velocita' nel job card (profili/minuto)
- Gradiente sfondo che cambia lentamente nel tempo (ambient animation)
- Filtri con animazione di switch (slide + fade)

**File da modificare**:
- `src/pages/DownloadManagement.tsx` — Aggiunta barra statistiche + layout migliorato
- `src/components/download/CountryGrid.tsx` — Hover effects potenziati
- `src/components/download/ActionPanel.tsx` — Preview lavoro prima dell'avvio
- `src/components/download/JobMonitor.tsx` — Timeline grafica

---

### Stile condiviso: Design System Glassmorphism

Tutti e tre le pagine condivideranno un linguaggio visivo coerente:

| Elemento | Stile |
|----------|-------|
| Pannelli | `bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl` |
| Hover | Glow laterale + `scale-[1.02]` + `shadow-lg shadow-sky-500/[0.06]` |
| Testo primario | `text-white` (dark) / `text-slate-900` (light) |
| Testo secondario | `text-slate-400` (dark) / `text-slate-500` (light) |
| Accenti | Sky-500 per azioni, Emerald-500 per successo, Amber-500 per warning, Rose-500 per errori |
| Transizioni | `duration-300 ease-out` per hover, `duration-500` per entrate |
| Sfondo | Gradienti radiali multi-layer con leggera animazione CSS |

---

### Dettagli Tecnici

**File nuovi**:
- `src/components/partners/PartnerCard.tsx` — Card partner estratta come componente riutilizzabile

**File modificati** (solo UI/stile, logica invariata):
- `src/pages/PartnerHub.tsx` — Layout full-screen, glassmorphism, tabs nel dettaglio, pannello ridimensionabile
- `src/pages/AcquisizionePartner.tsx` — Layout immersivo, dashboard KPI live, stile coerente
- `src/pages/DownloadManagement.tsx` — Barra statistiche globali, stile potenziato
- `src/components/acquisition/PartnerCanvas.tsx` — Bordi animati, transizioni migliorate
- `src/components/acquisition/PartnerQueue.tsx` — Card glassmorphism con micro-progress
- `src/components/acquisition/AcquisitionBin.tsx` — Redesign con particelle animate
- `src/components/acquisition/AcquisitionToolbar.tsx` — Layout compatto su riga singola
- `src/components/acquisition/NetworkPerformanceBar.tsx` — Barra compatta con sparkline
- `src/components/download/CountryGrid.tsx` — Hover glow potenziato
- `src/components/download/ActionPanel.tsx` — Preview pre-avvio
- `src/components/download/JobMonitor.tsx` — Timeline grafica

**Nessuna modifica alla logica di business**: Tutta la pipeline di acquisizione, i job di download, la gestione sessione e le impostazioni di scraping restano invariate. Si modifica solo la presentazione visuale.

**Dipendenze**: Nessuna nuova dipendenza. Si usa `react-resizable-panels` (gia' installato) per il Partner Hub.

---

### Ordine di Implementazione

1. Partner Hub (piu' grande, componente centrale)
2. Acquisizione Partner (stile coerente con Partner Hub)
3. Download Management (completamento della coerenza visiva)

