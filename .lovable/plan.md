

# MissionBuilder — Voice + Risposte Conversazionali AI

## Problemi identificati

1. **Nessun input vocale**: Il MissionBuilder ha solo input testo, manca il microfono presente ovunque nel sistema (IntelliFlow, AiAssistantDialog)
2. **AI deve rispondere a voce in modo sintetico**: Le risposte AI scritte possono essere lunghe/dettagliate, ma la voce deve essere breve e conversazionale — non leggere tutto il testo
3. **Dati**: I dati visualizzati sono reali (dalla tabella `partners`), ma il contatore step mostrava "1/6" nella versione cached — ora è 1/10

## Interventi

### 1. Aggiungere `useContinuousSpeech` al MissionBuilder

Stesso pattern di IntelliFlowOverlay: bottone mic accanto al campo input, testo interim mostrato live, invio automatico al rilascio.

**File**: `src/pages/MissionBuilder.tsx`
- Import `useContinuousSpeech`
- Bottone Mic/MicOff accanto al Textarea
- Placeholder cambia in "🎙 Sto ascoltando…" quando attivo
- Input mostra `interimText` durante l'ascolto

### 2. Aggiungere TTS conversazionale (useAiVoice)

Integrare `useAiVoice` con voce attiva di default (Laura IT). Ma con una modifica chiave: **il testo letto a voce è una versione compressa/sintetica**, non il testo completo scritto.

**Approccio**: Dopo ogni risposta AI, estrarre una frase riassuntiva (max 2 righe) da leggere a voce. In pratica:
- Il testo scritto nella chat rimane completo (markdown, dettagli, numeri)
- Il TTS legge solo un riassunto conversazionale — es. "Ho trovato 176 contatti in Cina e 94 negli Stati Uniti. Seleziona i paesi che ti interessano."
- Questo si ottiene aggiungendo un'istruzione al prompt del backend per generare un campo `voice_summary` nel messaggio, oppure facendo un estratto client-side delle prime 1-2 frasi

**Soluzione scelta**: Client-side — estrarre le prime 2 frasi dal testo pulito (senza markdown) e passarle al TTS. Zero modifiche backend.

### 3. Bottone toggle voce nell'header chat

Piccolo bottone Volume2/VolumeX nell'header del pannello chat per attivare/disattivare TTS.

## Riepilogo tecnico

| Modifica | File |
|----------|------|
| Import `useContinuousSpeech`, aggiungere mic button | `src/pages/MissionBuilder.tsx` |
| Import `useAiVoice`, TTS sintetico su risposte | `src/pages/MissionBuilder.tsx` |
| Nessun file nuovo, nessuna migrazione | — |

Totale: 1 file modificato. Pattern già collaudato nel progetto (IntelliFlow + AiAssistantDialog).

