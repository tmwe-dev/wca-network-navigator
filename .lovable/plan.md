

## Piano: Riposizionamento Campagne + Potenziamento Email Composer

### Analisi Attuale

- **Outreach** ha 4 tab: Cockpit, Workspace, Email Composer, Campagne
- **Dashboard** ha 2 tab: Home, Global AI
- **Email Composer**: editor HTML manuale senza AI, senza goal/proposte/preset, selezione destinatari in fondo alla pagina
- **Workspace**: ha GoalBar (goal, proposte, documenti, link, preset) + AI generation ma NON invia email direttamente

### Modifiche Pianificate

**1. Spostare Campagne nella Dashboard**

Campagne (globo 3D + selezione partner per paese) diventa il terzo tab della Dashboard, accanto a Home e Global AI. Coerente perché sia Global che Campagne sono viste panoramiche/strategiche.

```text
Dashboard: [Home] [Global AI] [Campagne]
Outreach:  [Cockpit AI] [Workspace] [Email Composer]
```

**2. Ridisegno Email Composer — Layout a 3 Colonne**

Trasformare l'Email Composer da editor piatto a strumento AI-powered con la stessa ergonomia del Workspace:

```text
┌──────────────────────────────────────────────────────────┐
│  GoalBar (goal, proposta, documenti, link, preset)       │
├────────────┬──────────────────────┬──────────────────────┤
│ RUBRICA    │  EDITOR EMAIL        │  ANTEPRIMA           │
│ DESTINATARI│                      │                      │
│            │  Oggetto             │  Inbox-style          │
│ [Cerca...] │  Corpo (textarea)    │  preview              │
│ [AI: ...]  │  Variabili           │                      │
│            │  Link + Allegati     │  ── Coda Monitor ──  │
│ Filtri:    │                      │                      │
│ · Paese    │  [Genera con AI]     │  Stat: inviati,      │
│ · Sorgente │  [Salva Bozza]       │  falliti, in coda    │
│ · Con email│  [Accoda Invio]      │                      │
│            │                      │                      │
│ Lista      │  Categoria           │                      │
│ partner    │  Delay coda          │                      │
│ selezionab.│                      │                      │
└────────────┴──────────────────────┴──────────────────────┘
```

Dettaglio delle novità:
- **Colonna sinistra — Rubrica Destinatari**: porta in alto la selezione destinatari (ora in fondo). Ricerca testuale + filtri (paese, sorgente, con/senza email). Checkbox per selezione multipla. Contatore "selezionati / con email"
- **GoalBar integrata**: stessa GoalBar del Workspace (goal, proposta base, documenti, link, preset) posizionata sopra le colonne
- **Pulsante "Genera con AI"**: invoca l'edge function `generate-email` passando goal, proposta, documenti e destinatari selezionati per generare automaticamente oggetto e corpo
- **Colonna destra — Anteprima + Monitor Coda**: preview inbox-style (640px centrata) + CampaignQueueMonitor sotto

**3. File Modificati**

| File | Modifica |
|------|----------|
| `src/pages/Dashboard.tsx` | Aggiungere tab "Campagne" con lazy import |
| `src/pages/Outreach.tsx` | Rimuovere tab "Campagne" (restano 3 tab) |
| `src/pages/EmailComposer.tsx` | Riscrittura completa: layout 3 colonne, GoalBar, AI generation, rubrica destinatari a sinistra |
| `src/App.tsx` | Aggiornare redirect `/campaigns` da legacy a `/` (Dashboard) |

### Dettaglio Tecnico

- La GoalBar viene riutilizzata identica dal Workspace (`useWorkspacePresets`, `useWorkspaceDocuments`)
- Il pulsante "Genera con AI" chiama `generate-email` edge function con i parametri del preset attivo
- La rubrica destinatari riusa la logica esistente di `RecipientSelector` ma in formato lista verticale a colonna intera
- Il layout usa `ResizablePanelGroup` a 3 pannelli (25% / 45% / 30%)

