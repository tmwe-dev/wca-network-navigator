

# Piano: Agent Chat Hub — Pagina dedicata con Carousel

## Cosa viene creato

Una nuova pagina `/agent-chat` con un'interfaccia immersiva full-screen dove l'utente naviga tra gli agenti tramite un carousel orizzontale di avatar e chatta con ciascuno. Design premium glassmorphism, dark-first.

## Layout

```text
┌──────────────────────────────────────────────────┐
│  ◄  🎯 Luca  🧠 Marco  💰 Robin  💰 Bruce ...  ►  │  ← Carousel avatar (scroll orizzontale)
│     ^^^^^^^^                                      │    Agente selezionato = evidenziato + grande
├──────────────────────────────────────────────────┤
│                                                    │
│   🎯 Luca — Account Manager Senior                │  ← Header agente con ruolo + status
│   "Direttore Operativo · 47 tool · Attivo"        │
│                                                    │
│  ┌──────────────────────────────────────────┐     │
│  │  [messaggi chat con markdown + TTS]       │     │  ← Area chat espansa (70vh)
│  │                                            │     │
│  │  Luca: Ecco il report del team...         │  🔊 │
│  │                                            │     │
│  │  Tu: Fammi vedere lo stato di Robin        │     │
│  │                                            │     │
│  └──────────────────────────────────────────┘     │
│  [ Scrivi un messaggio...          ] [📎] [🎤] [➤] │  ← Input con TTS + send
└──────────────────────────────────────────────────┘
```

## File da creare

### 1. `src/pages/AgentChatHub.tsx`
- Pagina full-height che carica tutti gli agenti via `useAgents()`
- Carousel orizzontale di avatar nella top bar (emoji + nome, click per selezionare)
- Frecce sx/dx per navigare, animazione di transizione tra agenti
- Header con nome, ruolo, conteggio tool, stato attivo/inattivo
- Chat integrata (logica riutilizzata da `AgentChat.tsx`) con:
  - Area messaggi con scroll, markdown rendering, TTS button
  - Input bar con send + volume
- Ogni agente mantiene la propria cronologia messaggi nella sessione (Map di conversazioni)
- Framer Motion per transizioni fluide tra agenti

### 2. `src/components/agents/AgentAvatarCarousel.tsx`
- Componente carousel con gli avatar degli agenti
- Avatar selezionato: scala maggiore, bordo primary, glow
- Avatar non selezionato: scala ridotta, opacità 60%
- Scroll orizzontale nativo con snap, frecce ai lati
- Badge ruolo colorato sotto ogni avatar

## File da modificare

### 3. `src/App.tsx`
- Aggiungere route `/agent-chat` con lazy import di `AgentChatHub`

### 4. `src/components/layout/AppSidebar.tsx`
- Aggiungere voce "Chat Agenti" sotto "Agenti" con icona `MessageCircle`

## Dettagli tecnici

- Le conversazioni sono mantenute in un `useRef<Map<string, Message[]>>` per persistere tra switch di agente senza perdere la cronologia
- Il carousel usa scroll-snap CSS nativo (no libreria embla necessaria per questa UX)
- La chat riusa la stessa logica `supabase.functions.invoke("agent-execute")` dell'`AgentChat` esistente
- TTS riusa la stessa logica `elevenlabs-tts` esistente
- Nessun file esistente viene eliminato — la pagina Agents originale resta intatta per configurazione

