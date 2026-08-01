---
name: Command Orchestrator V2
description: Command come layer sopra gli agenti — briefing automatico, scope `command` con context completo (memory+KB+doctrine+holding), Help mostra prompt+Memoria, voce ibrida ElevenLabs Conversational on-demand
type: feature
---
**Briefing all'apertura**: `useCommandBriefing` (riusa `useSmartSuggestions`) + `BriefingPanel` mostrato nello stato vuoto della CommandPage. Genera sommario testuale + chip prompt cliccabili.

**Help page** (`/v2/command/help`): `useCommandPromptsAndKb` carica `operative_prompts WHERE context='command'` e `kb_entries WHERE category IN ('command_tools','ai_memory')`. Sezione "Prompt attivi" + "Memoria & Guru" con link a Prompt Lab e KB.

**Context injection scope `command`** (edge `ai-assistant`):
- `_shared/scopeConfigs.ts` — nuovo `case "command"` con `contextRequirements: [profile, memory, kb, doctrine, operative_prompts, mission_history, holding_state, active_workflow, email_context]`, `tools: PLATFORM_TOOLS`, temperature 0.3.
- `_shared/contextTagExtractor.ts` — `scopeMap.command = ['command_tools','ai_memory','operative_procedure','system_doctrine']` per filtrare KB Level-1.

**Voce ibrida**: TTS+STT (`useVoiceOutput`/`useVoiceInput`) restano default. On-demand:
- Edge `elevenlabs-conversation-token` → fetch token WebRTC da `https://api.elevenlabs.io/v1/convai/conversation/token` usando `ELEVENLABS_API_KEY` + `ELEVENLABS_COMMAND_AGENT_ID` (secret). JWT richiesto. Emette anche `bridge_token` (sha256-hash in tabella `bridge_tokens`, TTL 30min) per autenticare il client tool ask_brain.
- `useCommandRealtimeVoice` (hook `@elevenlabs/react useConversation`) avvia/termina sessione full-duplex e registra il client tool **`ask_brain(question)`** che inoltra a `command-ask-brain` → `ai-assistant` scope=`command`.
- `RealtimeVoiceToggle` nel `CommandPageHeader`.

**Bridge Voce↔Brain (architettura definitiva):**
- 11labs gestisce SOLO voce/turn-taking/persona (LLM minimale, temperature 0.3, max_tokens 200).
- Tutta l'intelligenza vive in Brain via il client tool `ask_brain` → edge `command-ask-brain` (auth via bridge_token) → `ai-assistant` scope=`command` (memory L1-L3, KB, doctrine, holding, prompt operativi, scheduling).
- Risposta ottimizzata TTS: ≤80 parole, no markdown/URL, sanitizzata in `command-ask-brain`.
- Prompt completo persona Toto+Robin+Bruce+Aurora in `docs/PROMPT_11LABS_COMMAND.md` — pronto da incollare nella dashboard 11labs (system prompt + first message + tool registration + voice settings).
