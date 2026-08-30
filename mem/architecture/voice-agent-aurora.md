---
name: Agente vocale Aurora (Command) e sync ElevenLabs
description: Persona vocale Aurora 8 sezioni, tool read-only in voce, edge elevenlabs-agent-sync, auth interna ai-assistant
type: feature
---

# Voce Command — Aurora

- Il Command usava per errore l'agente ElevenLabs **Robin_AI** (venditore verso clienti). Ora esiste `AURORA — Copilota Command` (`agent_1501m19pd4d9ee58s5ek52my2ptz`), stessa voce e stessi 12 tool di Robin, prompt da copilota interno.
- `elevenlabs-conversation-token` sceglie di default l'agente con `agents.role = 'voice'`; una richiesta esplicita di `agent_id` in allowlist ha la precedenza. Robin resta intatto per le chiamate commerciali.
- Persona scritta secondo la **Guida Strutturale Prompt Vocali** (KB `agent_prompt_guide`, 8 sezioni: Personality, Environment, Tone, Goal, Tools, Guardrails, Pronunciation, End call) + sezione "Numeri e conteggi" (conteggio parziale dichiarato). Copia in `agents.system_prompt` e in `CONVERSATIONAL_CORE` (`ai-assistant/systemPrompt.ts`).
- `elevenlabs-agent-sync` (edge): `action=get|push|create_copilot`. Il pulsante "Pubblica" in Prompt Lab → Voice/ElevenLabs scrive il prompt sull'agente reale. ElevenLabs rifiuta `tools` e `tool_ids` insieme nel create.

## Due bug corretti
1. `ai-assistant` rifiutava le chiamate interne service-role con `x-impersonate-user` → il bridge vocale `command-ask-brain` falliva SEMPRE (l'agente improvvisava senza dati). Ora la chiamata interna è accettata solo se il bearer è esattamente la service role key e l'header contiene un UUID.
2. In modalità conversazionale i tool erano disabilitati → la voce non poteva cercare nulla. Ora `VOICE_TOOL_DEFINITIONS` (sola lettura) è attivo quando `context.channel === "voice"`. Sul canale voce niente scritture/invii: solo proposte.
