

# Aggiungere Sezione ElevenLabs nelle Impostazioni + Voce nell'Assistente AI Globale

## Stato attuale

- La configurazione voce ElevenLabs esiste **solo** dentro `AgentVoiceConfig.tsx`, accessibile unicamente dal dettaglio di un singolo agente. Non c'è nessuna impostazione globale.
- L'assistente AI globale (`GlobalChat.tsx`) **non ha TTS**: risponde solo in testo.
- Le edge function `elevenlabs-tts` e `elevenlabs-conversation-token` esistono già e funzionano.
- Il secret `ELEVENLABS_API_KEY` è già configurato nel backend.
- I preset voci sono hardcoded in `AgentVoiceConfig` (Laura, Sarah, Daniel, George, Roger).

## Piano

### 1. Nuova sezione "Voce AI" nelle Impostazioni (`Settings.tsx`)

Aggiungere un nuovo tab **"Voce AI"** nella pagina Settings, tra Connessioni e Import/Export. Questo tab contiene:

- **Voce predefinita**: selezione della voce ElevenLabs da usare per l'assistente AI globale (salvata in `app_settings` con chiave `elevenlabs_default_voice_id`)
- **API Key status**: badge che mostra se il secret `ELEVENLABS_API_KEY` è configurato
- **Preset voci**: lista cliccabile delle voci disponibili (stessa lista di `AgentVoiceConfig` + voci aggiuntive)
- **Voice ID personalizzato**: campo per inserire un ID voce custom
- **Test voce**: pulsante per ascoltare un'anteprima della voce selezionata
- **Attivazione TTS globale**: switch on/off per abilitare le risposte vocali nell'assistente

### 2. Nuovo componente `ElevenLabsSettings.tsx`

Nuovo file `src/components/settings/ElevenLabsSettings.tsx` con:
- Tab orizzontali: **Voce** (selezione voce default) e **Avanzate** (API key, Agent ID per conversational AI)
- Salva su `app_settings`: `elevenlabs_default_voice_id`, `elevenlabs_tts_enabled`, `elevenlabs_agent_id`

### 3. Integrare TTS nell'assistente globale (`GlobalChat.tsx`)

- Leggere `elevenlabs_default_voice_id` e `elevenlabs_tts_enabled` da `useAppSettings()`
- Dopo ogni risposta dell'assistente, se TTS è abilitato, chiamare `elevenlabs-tts` e riprodurre l'audio
- Aggiungere un pulsante speaker su ogni messaggio assistente per riascoltare

### File coinvolti

| File | Azione |
|------|--------|
| `src/components/settings/ElevenLabsSettings.tsx` | **Nuovo** — pannello impostazioni voce con tab |
| `src/pages/Settings.tsx` | Aggiungere tab "Voce AI" con import del nuovo componente |
| `src/components/global/GlobalChat.tsx` | Aggiungere TTS automatico + pulsante riascolto sui messaggi |

