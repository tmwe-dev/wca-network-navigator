

## Aggiungere Microfono all'Assistente Download (GlobalChat)

### Cosa fare

Aggiungere un pulsante microfono nella barra input del `GlobalChat` che usa la Web Speech API (`webkitSpeechRecognition`) per dettare comandi vocali. Il testo riconosciuto viene inserito nel campo input e inviato automaticamente.

### Modifiche in `src/components/global/GlobalChat.tsx`

1. **Stato microfono**: Aggiungere stato `isListening` e ref per `SpeechRecognition`
2. **Logica speech-to-text**: Usare `webkitSpeechRecognition` con lingua italiana (`it-IT`), risultato finale viene messo nell'input e inviato via `sendMessage`
3. **Pulsante mic**: Inserire tra il textarea e il pulsante Send un bottone rotondo con icona `Mic`/`MicOff`, con animazione pulsante rossa quando attivo
4. **Fallback**: Se il browser non supporta la Speech API, il pulsante non viene mostrato

### UI

Il pulsante mic avrà lo stesso stile compatto della barra input esistente: bordo arrotondato, colore rosso pulsante quando in ascolto, grigio quando idle.

