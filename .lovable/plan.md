

## Piano: Pagina "Global" — Download Visuale con Globo 3D + AI Assistant

### Concetto
Una nuova pagina `/global` con layout a due colonne:
- **Sinistra**: Chat AI (riutilizza logica di `AiAssistantDialog`) integrata inline (non dialog) + sotto la chat, un pannello di stato download live con contatori e bandierine dei paesi completati
- **Destra**: Globo 3D (riutilizza `CampaignGlobe`) che si muove automaticamente sul paese in fase di download

L'utente chiede all'AI in linguaggio naturale cosa scaricare (es. "Scarica tutti i partner USA con più di 10 anni") e l'AI attiva i job tramite il tool `create_download_job` già esistente. Il globo reagisce in tempo reale.

### Architettura

```text
┌─────────────────────────────────────────────────────┐
│                    Global Page                       │
├──────────────────┬──────────────────────────────────┤
│   AI Chat        │                                  │
│   (inline)       │         3D Globe                 │
│                  │    (auto-rotates to active        │
│   Quick prompts  │     download country)             │
│                  │                                  │
├──────────────────┤                                  │
│  Download Status │                                  │
│  ┌──┐ ┌──┐ ┌──┐ │                                  │
│  │🇺🇸│ │🇩🇪│ │🇮🇹│ │                                  │
│  └──┘ └──┘ └──┘ │                                  │
│  Live counters   │                                  │
└──────────────────┴──────────────────────────────────┘
```

### File da creare/modificare

1. **`src/pages/Global.tsx`** (nuovo) — Layout principale:
   - Colonna sinistra: chat AI inline (adattamento del codice di `AiAssistantDialog` come componente embedded, non dialog/modal) + pannello stato download sotto
   - Colonna destra: `CampaignGlobe` con `selectedCountry` pilotato dal job attivo
   - Sottoscrizione realtime a `download_jobs` per aggiornare contatori e posizione globo
   - Griglia di bandierine in basso a sinistra per i paesi completati
   - Quick prompts specifici: "Scarica tutti i partner", "Aggiorna profili mancanti", "Scarica USA", etc.

2. **`src/components/global/GlobalChat.tsx`** (nuovo) — Componente chat AI inline:
   - Riutilizza la logica SSE streaming di `AiAssistantDialog`
   - Stile space-dark integrato (non dialog floating, ma embedded nel layout)
   - Quick prompts specifici per download
   - Mostra `JobCreatedBadge` quando l'AI crea un job

3. **`src/components/global/DownloadStatusPanel.tsx`** (nuovo) — Pannello stato:
   - Sottoscrizione realtime a `download_jobs`
   - Contatori live: partner processati, email trovate, telefoni trovati
   - Griglia bandierine paesi completati con animazione di ingresso
   - Barra progresso per il job attivo
   - Pulsanti pausa/riprendi/cancella

4. **`src/App.tsx`** — Aggiungere rotta `/global` nelle protected routes

5. **`src/components/layout/AppSidebar.tsx`** — Aggiungere voce "Global" nella navigazione

### Comportamento del Globo
- Quando nessun job è attivo: rotazione libera con aerei
- Quando un job parte: il globo si sposta smoothly sul paese del job attivo (usa `selectedCountry` del `CampaignGlobe`)
- Quando il job cambia paese: transizione smooth al nuovo paese
- I paesi completati mostrano un marker verde sul globo

### Interazione AI
- Utilizza la stessa edge function `ai-assistant` già esistente con il tool `create_download_job`
- I quick prompts sono orientati al download: "Scarica tutti", "Aggiorna [paese]", "Profili mancanti globali"
- L'AI può anche rispondere a domande sullo stato ("Quanto manca?", "Quanti partner ho scaricato?")

### Cosa viene riutilizzato (zero duplicazione logica)
- `CampaignGlobe` — componente intero, solo prop `selectedCountry` pilotata
- `useDownloadJobs` — hook con realtime già implementato
- `usePauseResumeJob` — controlli job esistenti
- `ai-assistant` edge function — con tool `create_download_job` già funzionante
- Logica SSE streaming — estratta da `AiAssistantDialog`

