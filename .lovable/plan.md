

# Piano: Presentazione Istituzionale + Tutorial Magazine-Style

## Cosa si costruisce

Trasformazione completa di `Guida.tsx` in una presentazione HTML scrollabile full-screen, stile rivista istituzionale, con ~45 sezioni/pagine.

## Struttura file

### Componenti nuovi in `src/components/guida/`

| Componente | Contenuto |
|---|---|
| `GuidaLayout.tsx` | Container principale: scroll snap, nav dots laterali, progress bar top |
| `CoverSection.tsx` | Copertina: titolo cinematografico, animazione particelle, tagline |
| `VisionSection.tsx` | Il problema → la soluzione, layout split con icone animate |
| `PerformanceSection.tsx` | Contatori animati giganti con dati live dal DB |
| `AgentTeamSection.tsx` | Cards agenti con avatar, ruolo, stats in tempo reale |
| `AutonomousCycleSection.tsx` | Diagramma del ciclo con animazione step-by-step |
| `OutreachSection.tsx` | AI email generation spiegata con esempio visivo |
| `GlobalNetworkSection.tsx` | Mappa paesi con contatori |
| `DeepSearchSection.tsx` | Flusso arricchimento con timeline visiva |
| `MultichannelSection.tsx` | Email + WhatsApp + LinkedIn unified |
| `ProspectSection.tsx` | Discovery autonomo clienti |
| `SecuritySection.tsx` | Pausa notturna, rate limits, comportamento umano |
| `ResultsSection.tsx` | Metriche di successo, statistiche aggregate |
| `RoadmapSection.tsx` | Funzionalità future con timeline |
| `ClosingSection.tsx` | Chiusura emozionale |
| `TutorialSection.tsx` | Template riusabile per ogni sezione tutorial |
| `ScreenshotFrame.tsx` | Frame macOS-style per screenshot con effetto lente |
| `AnnotatedScreenshot.tsx` | Screenshot con callout/frecce che puntano a funzionalità |
| `ScrollIndicator.tsx` | Nav dots laterali + progress bar |

### Pagina rinnovata

| File | Modifica |
|---|---|
| `src/pages/Guida.tsx` | Riscrittura completa: diventa orchestratore delle sezioni |

## Design

- **Full-screen sections** con `scroll-snap-type: y mandatory`
- **Palette premium dark**: sfondo `#0a0a0f` con gradients blu/viola, accenti `hsl(var(--primary))`
- **Tipografia magazine**: titoli 48-64px font-bold, body 18-20px, ampio leading
- **Screenshot frames**: bordo macOS-style con traffic lights, ombra diffusa
- **Lente di ingrandimento**: cerchio CSS con `clip-path: circle()` + `scale(2.5)` su dettagli chiave
- **Callout annotazioni**: linee SVG con pallino + label che puntano a elementi nello screenshot
- **Animazioni scroll**: `IntersectionObserver` per fade-in, slide-up, counter animation
- **Nav laterale**: dots cliccabili con label on hover, posizione fissa a destra

## Contenuti screenshot

Per ora inserisco placeholder visivi (gradient + overlay con wireframe dell'interfaccia reale) con la struttura pronta. Ogni screenshot mostra il layout reale della sezione descritta, ricostruito con componenti semplificati. In un secondo momento si possono sostituire con screenshot reali.

## Dati live

Le sezioni Performance e Results faranno query al DB per mostrare numeri reali:
- Totale partner, contatti, email inviate, paesi coperti
- Task agenti completati, email generate dall'AI
- Attività aperte, prospect importati

## Risultato

~45 sezioni scrollabili full-screen che raccontano WCA Network Navigator come prodotto istituzionale e contemporaneamente guidano l'utente nell'uso di ogni funzionalità, con screenshot annotati, lenti di ingrandimento e callout descrittivi.

