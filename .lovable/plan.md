

# Ristrutturazione: Due Aree Separate + Landing Page

## Concetto

All'ingresso l'utente vede una **landing page** con due percorsi chiari:

```text
┌─────────────────────────────────────────────┐
│              WCA Partners                    │
│                                              │
│   ┌──────────────┐   ┌──────────────┐       │
│   │  🌐 Network  │   │  👤 CRM      │       │
│   │  WCA Partners│   │  Contatti    │       │
│   │  Hub         │   │  Hub        │       │
│   └──────┬───────┘   └──────┬───────┘       │
│          │                  │                │
│   Partner per paese   Rubrica contatti       │
│   Deep Search         Import / Biglietti    │
│   Qualità network     Gruppi / Origini      │
└─────────────────────────────────────────────┘
```

Una volta entrati in un'area, la sidebar mostra solo le voci pertinenti + le sezioni condivise (Outreach, Email Composer, Agenda, Agenti).

**Report Aziende** esce dal menu principale: è già presente in Settings come tab dedicata. Le route `/ra/*` restano funzionanti ma accessibili solo da Settings.

## Nuova struttura route

| Route | Contenuto |
|-------|-----------|
| `/` | **Landing page** — scelta Network o CRM |
| `/network` | Hub WCA (Operations: paesi → partner → dettaglio) |
| `/crm` | Hub Contatti (Contatti, Import, Biglietti) |
| `/outreach` | Cockpit, In Uscita, Workspace, Campagne, Attività (condiviso) |
| `/email-composer` | Email Composer (condiviso) |
| `/agenda` | Agenda (condiviso) |
| `/agents` | Agenti (condiviso) |
| `/settings` | Impostazioni (include tab Report Aziende) |

## File da modificare

### 1. `src/pages/Dashboard.tsx` — Diventa Landing Page
- Rimuovere i tab Mission Control / Global AI / Campagne
- Due card grandi cliccabili: **Network** (→ `/network`) e **CRM** (→ `/crm`)
- Sotto: widget riassuntivi (partner totali, contatti totali, attività in sospeso)
- Design pulito, due colonne, icone grandi

### 2. `src/components/layout/AppSidebar.tsx` — Sidebar context-aware
- Rimuovere sezione "Report Aziende" dal menu
- Riorganizzare in:
  - **Aree**: Dashboard, Network, CRM
  - **Strumenti**: Outreach, Email Composer, Agenda, Agenti, Chat Agenti
  - **Sistema**: Impostazioni

### 3. `src/App.tsx` — Pulizia route
- Rimuovere route `/ra`, `/ra/explorer`, `/ra/scraping`, `/ra/company/:id` dal menu principale (restano funzionanti come route nascoste accessibili da Settings)
- Redirect `/global` → `/`
- Campagne tab rimosso dalla Dashboard, resta dentro Outreach

### 4. `src/components/layout/AppLayout.tsx` — Aggiornare `isFullscreenRoute`
- Aggiungere `/` alla lista fullscreen (la landing page deve essere fullscreen)

## Dettagli tecnici

### Landing Page (Dashboard.tsx)
```text
┌─────────────────────────────────────┐
│  Benvenuto, [nome]                  │
│                                     │
│  ┌───────────┐  ┌───────────┐      │
│  │ 🌐        │  │ 👤        │      │
│  │ Network   │  │ CRM       │      │
│  │ 2,450     │  │ 1,230     │      │
│  │ partner   │  │ contatti  │      │
│  └───────────┘  └───────────┘      │
│                                     │
│  Attività recenti / briefing       │
└─────────────────────────────────────┘
```

Le due card navigano a `/network` e `/crm`. Sotto, un briefing operativo con le metriche principali da entrambe le aree.

### Sidebar semplificata
```text
Aree
  Dashboard        /
  Network          /network
  CRM              /crm

Strumenti
  Outreach         /outreach
  Email Composer   /email-composer
  Agenda           /agenda
  Agenti           /agents
  Chat Agenti      /agent-chat

Sistema
  Impostazioni     /settings
```

Report Aziende sparisce dalla navigazione principale. Resta accessibile dalla tab già esistente in Settings.

## File coinvolti

| File | Azione |
|------|--------|
| `src/pages/Dashboard.tsx` | Riscrivere come landing page a due percorsi |
| `src/components/layout/AppSidebar.tsx` | Rimuovere RA, riorganizzare sezioni |
| `src/App.tsx` | Pulire route RA dal layout principale |
| `src/components/layout/AppLayout.tsx` | Aggiornare fullscreen routes |

