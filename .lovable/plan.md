

# Mission Builder — Da Wizard Statico a Conversazione AI-Driven

## Problema

Il Mission Builder mostra 10 step statici con UI hardcoded (badge paesi, slider, toggle). L'utente ha ragione: perché mostrare un selettore paesi se la missione potrebbe riguardare contatti, biglietti da visita, ex-clienti, o altro? L'AI deve guidare la conversazione e proporre le opzioni giuste in base al contesto.

## Nuovo Approccio

Eliminare il pannello sinistro con gli step fissi. Il pannello chat AI diventa l'interfaccia principale (full-width o quasi). L'AI fa domande progressive tramite prompt, e quando serve un input strutturato (multi-select paesi, scelta canale, slider), lo inietta come **widget inline nella chat** — non come step separato.

## Architettura

```text
┌─────────────────────────────────────────────────┐
│  Header: Nome missione + progress dots          │
├─────────────────────────────────────────────────┤
│                                                 │
│  Chat AI (full panel)                           │
│  ┌─────────────────────────────────────────┐   │
│  │ 🤖 Cosa vuoi fare oggi? Posso aiutarti  │   │
│  │    con email, WhatsApp, ricerca...       │   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │ 👤 Voglio contattare partner in Europa   │   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │ 🤖 Ho trovato 245 partner in Europa.    │   │
│  │    Seleziona i paesi:                   │   │
│  │    ┌──────────────────────────┐         │   │
│  │    │ ▼ Multi-select dropdown  │         │   │
│  │    │ ☑ Germany (45)           │         │   │
│  │    │ ☑ France (38)            │         │   │
│  │    │ ☐ Italy (22)             │         │   │
│  │    └──────────────────────────┘         │   │
│  │    [Conferma selezione]                 │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [🎙] [________________] [➤]                   │
└─────────────────────────────────────────────────┘
```

## Implementazione

### 1. Nuovo componente `MissionChatWidget`

Widget inline renderizzabili dentro i messaggi AI. Tipi:
- `country_select` — Dropdown multi-select con conteggio partner
- `channel_select` — Radio buttons (Email/WhatsApp/LinkedIn/Mix)
- `slider_batch` — Slider per regolare batch per paese
- `toggle_group` — Switch per deep search, allegati, etc.
- `confirm_summary` — Card riassuntiva con bottone "Lancia"

L'AI non genera questi widget — sono triggerati dal codice quando l'AI risponde con keyword specifiche o quando il backend restituisce un `widget_type` nel messaggio.

### 2. Modifiche a `MissionBuilder.tsx`

- Rimuovere il layout 50/50 (step + chat) → chat full-width
- Rimuovere import di `MissionStepRenderer` e `TOTAL_STEPS`
- Il progress si basa su `stepData` compilato (quanti campi hanno valore)
- L'AI apre la conversazione con: "Che tipo di attività vuoi creare?" invece di mostrare subito i paesi
- Le risposte AI con widget inline aggiornano `stepData` tramite callback

### 3. Prompt di sistema aggiornato

Aggiungere al contesto dell'`ai-assistant` un prompt specifico per `/mission-builder` che istruisce l'AI a:
- Fare domande progressive (chi, cosa, come, quando)
- Non assumere che sia sempre per-paese — potrebbe essere per tipo azienda, rating, ex-clienti
- Proporre opzioni basate sui dati reali del DB
- Confermare ogni scelta prima di procedere

### 4. Widget rendering nel chat

Quando il messaggio AI contiene marker come `[WIDGET:country_select]` o il backend include `widget_type` nella risposta, il renderer del messaggio mostra il widget interattivo invece del testo raw.

## File coinvolti

| File | Azione |
|------|--------|
| `src/pages/MissionBuilder.tsx` | Rimuovere split layout, chat full-width, widget inline |
| `src/components/missions/MissionStepRenderer.tsx` | Eliminato o ridotto a solo widget factory |
| `src/components/missions/MissionChatWidgets.tsx` | **Nuovo** — widget inline per chat |
| `supabase/functions/ai-assistant/index.ts` | Prompt mission-builder specifico |

Nessuna migrazione DB. Il `stepData` resta identico — cambia solo come viene compilato (da widget inline invece che da step fissi).

