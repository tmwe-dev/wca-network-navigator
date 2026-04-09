

# Piano: PDF Premium "WCA Network Navigator" — Luxury Dark Magazine

## Approccio completamente diverso

Invece di generare un PDF con ReportLab (che produce risultati piatti e brutti), useremo un approccio in 2 fasi:

### Fase 1: Screenshot reali con mock data attivo
1. Attivare i mock data (`demo-data-enabled = true` in localStorage) via browser
2. Navigare a OGNI pagina dell'app e catturare screenshot ad alta risoluzione (1920x1080):
   - `/` (Home con briefing operativo)
   - `/outreach` (Cockpit, In Uscita, Attività, Circuito, Coda AI — 5 screenshot)
   - `/inreach` (Email, WhatsApp, LinkedIn tabs)
   - `/network` (griglia paesi, lista partner)
   - `/campaigns` (globo 3D)
   - `/crm` (Contatti, Biglietti)
   - `/agenda` (calendario con attività)
   - `/settings` (tab Email, Connessioni, Profilo AI)
   - `/email-composer`
3. Applicare brightness/contrast boost con Pillow per garantire visibilità

### Fase 2: PDF con FPDF2 + compositing Pillow
Ogni pagina del PDF viene generata come immagine composita in Pillow (1920x1080), poi assemblata in PDF. Questo permette:
- Gradienti sfumati reali (non rettangoli piatti)
- Tipografia con font premium (Outfit, scaricato via Google Fonts)
- Overlay semi-trasparenti sugli screenshot
- Callout con frecce e cerchi pulsanti
- Ombre realistiche sui frame macOS

### Design system

**Palette**: `#0a0a0f` base, `#6366f1` primary, `#3b82f6` blue accent, `#a78bfa` violet, `#10b981` emerald, gradient glow
**Font**: Outfit (titoli), JetBrains Mono (dati/numeri)
**Frame**: macOS-style con bordo `#1c1c1e`, traffic lights, ombra diffusa
**Callout**: cerchi pulsanti colorati + linee + etichette su sfondo glass

### Struttura contenuti (~30 pagine)

| # | Pagina | Tipo |
|---|--------|------|
| 1 | Copertina cinematografica | Full-bleed gradient + titolo |
| 2 | Tagline emozionale | Testo grande su nero |
| 3 | La Sfida — numeri chiave | Infografica |
| 4 | Prima vs Dopo | Due colonne confronto |
| 5 | 6 Pilastri tecnologici | Grid con icone |
| 6 | Stack architetturale | Schema a livelli |
| 7-8 | Team AI — 6 agenti | Card + ruoli + territori |
| 9 | Ciclo autonomo | Flow diagram orizzontale |
| 10 | **Home** — screenshot annotato | Callout su briefing, agent status |
| 11 | **Outreach Cockpit** — screenshot | Callout su metriche, timeline |
| 12 | **In Uscita** — screenshot | Callout su job queue |
| 13 | **Inreach Email** — screenshot | Callout su inbox, filtri |
| 14 | **Inreach WhatsApp** — screenshot | Callout su chat |
| 15 | **Network** — screenshot | Callout su griglia paesi |
| 16 | **Campaigns** — globo 3D | Screenshot full-width |
| 17 | **Email Workspace** — screenshot | Callout su AI generation |
| 18 | **CRM** — screenshot | Callout su contatti |
| 19 | **Agenda** — screenshot | Callout su calendario |
| 20 | **Agent Cockpit** — screenshot | Dashboard agenti |
| 21 | Deep Search — flow | Diagramma arricchimento |
| 22 | Multi-Channel — 3 card | Email + WhatsApp + LinkedIn |
| 23 | Sicurezza — pausa notturna | Infografica |
| 24 | Performance — metriche ROI | Barre + numeri |
| 25 | Roadmap 2026-2027 | Timeline |
| 26 | Chiusura | CTA finale |

### Differenze rispetto ai tentativi precedenti

1. **Ogni pagina è un'immagine composita** — nessun overlap di testo/immagini
2. **Screenshot luminosi e puliti** con brightness boost + contrast
3. **Layout calcolato al pixel** — niente sovrapposizioni
4. **Varietà visiva** — pagine alternate tra full-bleed screenshot, infografiche, split-screen
5. **Mock data attivo** — tutte le interfacce popolate con dati realistici
6. **QA pagina per pagina** — verifico ogni singola pagina prima della consegna

### File coinvolti
Nessun file del progetto modificato. Script Python in `/tmp/`, output in `/mnt/documents/`.

