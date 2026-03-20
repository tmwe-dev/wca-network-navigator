

## Piano: Ridisegno Completo Mission Control

### Problema

La pagina attuale ha 8 "mondi" in un carosello 3D sovrapposto che:
- Non si capisce dove cliccare
- Le card si sovrappongono e nascondono contenuto
- I numeri non comunicano nulla di utile
- Lo scroll wheel hijack è fastidioso
- Troppa complessità visiva, zero chiarezza operativa

### Nuovo Design: Griglia Pulita + AI Prompt

Eliminare completamente il carosello. Sostituire con un layout verticale pulito:

```text
┌─────────────────────────────────────────────────────────┐
│  Buongiorno. Cosa vuoi fare oggi?          [AI Prompt]  │
│  🎤 Chiedi al sistema qualsiasi cosa...                 │
│  [Riepilogo] [Partner senza contatti] [Campagne attive] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Outreach │ │ Network  │ │   CRM    │ │  Agenda  │   │
│  │ 860 cont.│ │ 1554 ptr │ │ 10 prosp │ │ 7 attiv. │   │
│  │ pronti → │ │ attivi → │ │ ────── → │ │ aperte → │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
│  ── Stato del sistema ──────────────────────────────    │
│  • 0 job download attivi                                │
│  • 860 contatti pronti all'outreach                     │
│  • 7 attività aperte                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Dettaglio Tecnico

**File: `src/pages/SuperHome3D.tsx`** — Riscrittura completa

- Rimuovere: carosello, wheel hijack, 8 "worlds", AnimatePresence delle card, KPI strip duplicata
- 4 card di navigazione (corrispondono ai 4 ambienti reali della sidebar: Outreach, Network, CRM, Agenda) con icona, titolo, un dato reale e freccia
- Sezione "Stato sistema" con 3-4 righe di testo chiaro sui segnali attivi (job, contatti pronti, attività aperte) — solo se > 0
- AI Prompt (`HomeAIPrompt`) in alto, come primo elemento, prominente
- Glassmorphism coerente con il resto della piattaforma
- Nessun wheel hijack, la pagina scorre normalmente
- Saluto contestuale (Buongiorno/Buonasera basato sull'ora)

**File: `src/pages/Dashboard.tsx`** — Rimuovere il `blockWheel` e `popstate` lock (non servono più senza carosello)

