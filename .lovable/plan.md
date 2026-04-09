

# Piano: PDF Magazine-Style con Screenshot Reali

## Problema
Il PDF precedente era testo su sfondo scuro senza nessun screenshot reale. Serve una presentazione professionale con immagini vere dell'interfaccia.

## Approccio

### Fase 1: Cattura Screenshot Reali
Navigare a ogni pagina principale dell'app e catturare screenshot reali:
- **Home** (dashboard con briefing operativo)
- **Inreach** (inbox email/WhatsApp/LinkedIn)
- **Operations / Network** (griglia paesi, partner)
- **Workspace** (AI email generation)
- **Campaigns** (globo 3D)
- **CRM** (prospect)
- **Agenda** (reminder/calendar)
- **Cockpit** (dashboard agenti)
- **Settings** (configurazione)
- **Guida** stessa (copertina della presentazione HTML)

Copiare tutti gli screenshot in `/tmp/` per l'embedding nel PDF.

### Fase 2: Generare PDF Premium con ReportLab
Creare un PDF landscape A4 (~30-35 pagine) con:

**Design visivo:**
- Sfondo scuro `#0a0a0f` con gradienti blu/viola/primary
- Screenshot reali incorniciati in frame macOS-style (bordo arrotondato + traffic lights)
- Testo bianco con titoli grandi (36-48pt), body 14-16pt
- Linee decorative, separatori gradient, badge colorati
- Callout con frecce/cerchi che evidenziano funzionalità specifiche nello screenshot

**Struttura contenuti:**
1. **Copertina** — titolo cinematografico con gradient
2. **La Visione** (2 pagine) — problema/soluzione, prima/dopo
3. **Architettura** (2 pagine) — stack tecnologico, pilastri
4. **Team AI** (2 pagine) — i 6 agenti con ruoli
5. **Home Dashboard** (1 pagina) — screenshot + spiegazione
6. **Inbox Multicanale** (2 pagine) — email, WhatsApp, LinkedIn con screenshot
7. **Network & Operations** (2 pagine) — griglia paesi, partner
8. **AI Workspace** (2 pagine) — generazione email AI
9. **Campaigns** (1 pagina) — globo 3D
10. **CRM & Prospect** (2 pagine) — gestione prospect
11. **Agenda** (1 pagina) — reminder e follow-up
12. **Cockpit Agenti** (2 pagine) — dashboard real-time
13. **Ciclo Autonomo** (2 pagine) — diagramma flusso
14. **Sicurezza** (1 pagina) — pausa notturna, rate limits
15. **Performance** (2 pagine) — metriche, ROI
16. **Roadmap** (1 pagina) — futuro
17. **Chiusura** (1 pagina)

**Tecnica per i frame screenshot:**
- Disegnare rettangolo arrotondato grigio scuro
- 3 cerchi colorati (rosso/giallo/verde) come traffic lights
- Immagine dello screenshot inserita sotto il titolo bar
- Ombra esterna simulata con rettangolo semi-trasparente

### File coinvolti
Nessun file del progetto modificato. Solo script Python in `/tmp/` che genera il PDF in `/mnt/documents/`.

### QA
Conversione di ogni pagina in immagine per verifica visiva prima della consegna.

## Risultato
Un PDF di ~30 pagine stile rivista premium con screenshot reali dell'app, gradienti, frame macOS e spiegazioni dettagliate di ogni funzionalità.

