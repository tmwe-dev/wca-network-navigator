

# Piano: Voce bidirezionale nell'Agent Chat Hub

## Problema
La pagina `/agent-chat` ha solo input testuale e TTS per le risposte. Manca completamente il microfono per dettare messaggi e la possibilità di conversazione vocale bidirezionale con gli agenti ElevenLabs.

## Soluzione
Aggiungere due modalità vocali alla barra input:

1. **Microfono STT** (Speech-to-Text via Web Speech API) — pulsante mic che trascrive la voce dell'utente nel campo input, pronto per l'invio
2. **Conversazione vocale live** (ElevenLabs Conversational AI via `@elevenlabs/react`) — pulsante dedicato che avvia una sessione vocale bidirezionale in tempo reale con l'agente selezionato, usando il suo `elevenlabs_agent_id`

## Layout input bar aggiornato

```text
[ Scrivi a Luca…                    ] [🎤] [📞] [➤]
                                       STT  Voice Send
```

- **🎤 STT**: Toggle on/off. Quando attivo, trascrive in italiano nel campo input. Animazione pulse rossa.
- **📞 Voice Call**: Apre un overlay di conversazione vocale live con l'agente (ElevenLabs WebRTC). Mostra VoicePresence con waveform.
- **➤ Send**: Invia il messaggio testuale come ora.

## File da modificare

### `src/pages/AgentChatHub.tsx`
- Aggiungere stato STT con `webkitSpeechRecognition` (italiano)
- Aggiungere pulsante microfono nella input bar con toggle on/off
- Aggiungere pulsante "Voice Call" che apre overlay conversazione
- Aggiungere stato `voiceMode` per l'overlay vocale
- Importare e rendere `VoicePresence` durante la sessione vocale
- Auto-play TTS sulle risposte agente (toggle opzionale)

### `src/components/agents/AgentVoiceCall.tsx` (nuovo)
- Componente overlay che usa `useConversation` da `@elevenlabs/react`
- Richiede token da `elevenlabs-conversation-token` edge function
- Mostra stato connessione, waveform animata, pulsante chiudi
- Usa l'`elevenlabs_agent_id` dell'agente attivo

## Dettagli tecnici

- STT usa `webkitSpeechRecognition` nativo (no dipendenze extra), lingua `it-IT`
- Voice Call usa `@elevenlabs/react` già disponibile nel progetto e l'edge function `elevenlabs-conversation-token` già esistente
- Il token viene generato passando l'`elevenlabs_agent_id` dell'agente selezionato
- `VoicePresence` esistente viene riutilizzato per il feedback visivo

