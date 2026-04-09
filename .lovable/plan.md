
# Piano: Microfoni Uniformi + ElevenLabs Ovunque + Staff Direzionale con Canvas Chat

## Situazione Attuale

### Microfoni e Voice-to-Text
- **5 punti** usano `useContinuousSpeech` (GlobalChat, OraclePanel, IntelliFlowOverlay, HomeAIPrompt, MissionBuilder) — funzionano, scrivono nella textarea
- **AgentChatHub** ha un suo hook locale `useSpeechRecognition` separato, non usa `useContinuousSpeech` — comportamento diverso (nessun interim text, nessun auto-restart)
- **AgentChat** (dentro AgentDetail) importa `Mic/MicOff` ma NON ha alcun microfono funzionante — il bottone non esiste nel JSX

### ElevenLabs TTS
- **GlobalChat**: TTS funzionante con voce configurabile da settings
- **AgentChatHub**: TTS funzionante con voce dell'agente (`elevenlabs_voice_id`)
- **AgentChat**: TTS funzionante con voce dell'agente
- **MissionBuilder**: TTS funzionante con voce fissa Laura
- **OraclePanel / HomeAIPrompt / IntelliFlowOverlay**: Nessun TTS — manca il bottone Volume2 sulle risposte

### Staff Direzionale
- Non esiste nessuna pagina o componente dedicato
- Non esiste nessuna route `/staff-direzionale`
- Non c'e' drag & drop file in nessun chat del sistema
- Il bucket `chat-attachments` esiste gia' (pubblico) — pronto per i file

## Interventi

### 1. Uniformare microfono — Sostituire hook locale in AgentChatHub + Aggiungere mic in AgentChat

**AgentChatHub**: Rimuovere `useSpeechRecognition` locale, usare `useContinuousSpeech` come tutti gli altri. Il testo trascritto va nell'input.

**AgentChat**: Aggiungere bottone microfono nella barra input, usando `useContinuousSpeech`. Il testo va nell'input.

### 2. Aggiungere TTS (bottone Volume2) dove manca

In **HomeAIPrompt** e **IntelliFlowOverlay**: aggiungere bottone Volume2 sulle risposte assistant, usando la stessa funzione `playTTS` con voce da settings (`elevenlabs_default_voice_id`). Condizionato a `elevenlabs_tts_enabled === "true"`.

### 3. Creare pagina Staff Direzionale con Canvas Chat

Nuova pagina `/staff-direzionale` con:
- Layout a due colonne: lista 4 consulenti AI a sinistra, canvas chat a destra
- I 4 consulenti sono gli agenti con ruolo specifico (Luca Director, Gigi/Felice Account Manager, Gianfranco Strategy) — filtrati dal DB
- Canvas chat: area messaggi con markdown, input con microfono (`useContinuousSpeech`), TTS sulle risposte
- **Drag & drop file**: zona drop sulla chat che accetta qualsiasi file (Excel, PDF, immagini). I file vengono caricati su `chat-attachments` bucket e il link viene allegato al messaggio
- I job assegnati durante la chat vengono registrati in `ai_work_plans`
- Lista job attivi visibile in un pannello laterale/tab

### 4. Route e navigazione

- Aggiungere route `/staff-direzionale` in App.tsx
- Aggiungere link nella sidebar di navigazione

## File coinvolti

| File | Azione |
|------|--------|
| `src/pages/AgentChatHub.tsx` | Sostituire hook STT locale con `useContinuousSpeech` |
| `src/components/agents/AgentChat.tsx` | Aggiungere microfono con `useContinuousSpeech` |
| `src/components/home/HomeAIPrompt.tsx` | Aggiungere TTS Volume2 sulle risposte |
| `src/components/intelliflow/IntelliFlowOverlay.tsx` | Aggiungere TTS Volume2 sulle risposte |
| `src/pages/StaffDirezionale.tsx` | **Nuovo** — pagina completa con canvas chat, drag & drop, job list |
| `src/components/staff/StaffChatCanvas.tsx` | **Nuovo** — chat canvas con drag & drop file |
| `src/components/staff/FileDropZone.tsx` | **Nuovo** — componente drop zone riutilizzabile |
| `src/App.tsx` | Aggiungere route `/staff-direzionale` |
| `src/components/layout/Sidebar.tsx` (o equivalente) | Link navigazione |

## Ordine di esecuzione

1. Uniformare microfono in AgentChatHub e AgentChat
2. Aggiungere TTS in HomeAIPrompt e IntelliFlowOverlay
3. Creare FileDropZone + StaffChatCanvas
4. Creare pagina StaffDirezionale con route
5. Collegare navigazione
