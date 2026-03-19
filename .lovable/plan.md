

# Integrazione IntelliFlow Workspace come Layer Dinamico

## Cosa fa IntelliFlow Workspace

IntelliFlow e un ambiente conversazionale AI-first con estetica ultra-premium dark/glassmorphism. Contiene:

- **AI Workspace**: Chat conversazionale con flussi scenario-based (import, campagne, report, email batch, voice). L'utente scrive un obiettivo e il sistema simula un'orchestrazione multi-agente con thinking → proposta → approvazione → esecuzione → audit trail.
- **Canvas Views**: Pannelli laterali dinamici (tabelle analisi, anteprime campagna, report executive, risultati esecuzione).
- **Tool Activation Bar**: Visualizzazione animata dei tool e delle fonti dati coinvolte.
- **Approval Panel**: Conferma strutturata con governance info.
- **Execution Flow**: Progress bar multi-step con stati (pending/running/done).
- **Voice Presence**: Waveform vocale (ElevenLabs TTS/STT).
- **AiEntity**: Sfera animata che rappresenta l'AI.
- **Floating Dock**: Navigazione bottom-bar con icone animate.
- **Pagine informative**: Capabilities (griglia moduli), Engine (architettura a layer), Architecture, Connections, Templates, Automations, Audit Log.

## Come si integra "sopra" il nostro sistema

Il concetto chiave: IntelliFlow non sostituisce le nostre maschere operative (Network, CRM, Outreach, Agenda). Diventa un **layer conversazionale sovrapposto** che orchestra i moduli gia esistenti.

```text
┌─────────────────────────────────────────┐
│  IntelliFlow Layer (overlay/tab)        │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ AI Chat     │  │ Canvas dinamico  │  │
│  │ + Tool Bar  │  │ (tabelle, report │  │
│  │ + Approval  │  │  campagne, etc.) │  │
│  │ + Execution │  │                  │  │
│  └─────────────┘  └──────────────────┘  │
├─────────────────────────────────────────┤
│  Sistema esistente (Network/CRM/        │
│  Outreach/Agenda/Dashboard)             │
└─────────────────────────────────────────┘
```

## Piano di integrazione (3 fasi)

### Fase 1 — Portare i componenti UI

Copiare e adattare i componenti visuali di IntelliFlow nel progetto corrente:

| Componente IntelliFlow | Destinazione nel nostro progetto |
|---|---|
| `AiEntity.tsx` | `src/components/intelliflow/AiEntity.tsx` |
| `ApprovalPanel.tsx` | `src/components/intelliflow/ApprovalPanel.tsx` |
| `ExecutionFlow.tsx` | `src/components/intelliflow/ExecutionFlow.tsx` |
| `ToolActivationBar.tsx` | `src/components/intelliflow/ToolActivationBar.tsx` |
| `VoicePresence.tsx` | `src/components/intelliflow/VoicePresence.tsx` |
| `CanvasViews.tsx` | `src/components/intelliflow/CanvasViews.tsx` |
| `TemplateSuggest.tsx` | `src/components/intelliflow/TemplateSuggest.tsx` |

I CSS custom (`.float-panel`, `.glow-soft`, `.ai-orb`, `.pill`, keyframes) vanno aggiunti al nostro `index.css`.

Le `toolMap` e gli `scenarios` vengono riadattati per mappare i **moduli reali** del nostro sistema (download WCA, deep search, email drafting, import contatti, etc.) invece dei dati demo.

### Fase 2 — Creare la pagina IntelliFlow Workspace

Una nuova pagina/tab accessibile dal sistema che funziona come ambiente conversazionale alternativo:

**Opzione A — Tab nel Dashboard**: Aggiungere una terza tab "AI Workspace" accanto a "Mission Control" e "Global AI" nella Dashboard.

**Opzione B — Pagina dedicata** (`/intelliflow`): Rotta propria con accesso dalla sidebar o dall'header (icona AI).

**Opzione C — Overlay modale full-screen**: Si apre sopra qualsiasi pagina (come uno "stage" sovrapposto) richiamabile da un pulsante flottante globale.

Il Workspace IntelliFlow ricalca la struttura originale: chat a sinistra, canvas dinamico a destra, tool bar in alto, input con mic/voice in basso.

### Fase 3 — Collegare ai moduli reali

Sostituire gli scenari demo con chiamate ai nostri servizi reali:

| Scenario IntelliFlow | Backend reale nostro |
|---|---|
| "Importa 300 contatti" | Edge function `process-ai-import` + `useContacts` |
| "Campagna per 50 lead" | `useEmailCampaignQueue` + `generate-email` |
| "Report partner Asia" | `usePartners` + `useCountryStats` |
| "10 bozze email" | `generate-outreach` + `useEmailDrafts` |
| "Deep Search" | `deep-search-partner` + `useDeepSearchRunner` |
| "Lettura vocale" | `elevenlabs-tts` (gia presente) |

L'`ai-assistant` edge function esistente viene esteso per supportare il formato di risposta strutturato di IntelliFlow (agentName, meta, governance, tools, canvas type).

## Dettagli tecnici

- **Dipendenze**: `framer-motion` gia presente nel progetto corrente. Nessuna nuova dipendenza.
- **Tema**: I colori CSS di IntelliFlow (primary `210 100% 66%`, accent `270 60% 62%`) sono compatibili col tema dark esistente. I `.float-panel` vanno aggiunti come utilita globali.
- **Rischio**: Basso. I componenti IntelliFlow sono isolati e non interferiscono con le maschere esistenti. Il canvas e un pannello laterale opzionale.
- **Volume stimato**: ~15 file nuovi, ~3 file modificati (App.tsx per rotta, index.css per stili, sidebar per link).

## Decisione richiesta

Prima di procedere, serve scegliere il punto di accesso:

- **Tab nel Dashboard** (piu integrato, meno invasivo)
- **Pagina dedicata /intelliflow** (autonoma, navigazione esplicita)  
- **Overlay full-screen** (accessibile ovunque, esperienza immersiva)

