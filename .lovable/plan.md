# Command come "Luca operativo" — collaborativo, proattivo, vocale

Obiettivo: rendere `/v2/command` un layer sopra tutti gli agenti che (1) parla con identità Luca, (2) all'apertura propone un briefing data-driven, (3) può conversare a voce sia in modo leggero (attuale) sia full-duplex on-demand, (4) quando "programma un'attività" distingue chiaramente tra task per agenti AI e attività umane in agenda.

## 1. Prompt Command nel Prompt Lab (governance, non codice)

I prompt vivono già in `operative_prompts` (context = `command`). Oggi ne esistono solo 2 (Router + Vincoli messaging). Aggiungiamo via seed (script `scripts/seed-command-prompts.ts`, idempotente per `name+context`) le voci mancanti, tutte editabili dal Prompt Lab senza redeploy:

- **Command — Identità & Collaborazione** (priority 100): "Sei Luca in modalità cockpit. Collabori con l'utente come direttore-operativo: ascolti, proponi, chiedi conferma sulle azioni a impatto, esegui le altre. Italiano, sintetico, una proposta concreta per messaggio."
- **Command — Briefing all'apertura** (priority 95): regole per il briefing iniziale (vedi §2): cosa includere, cosa NO, lunghezza max, tono.
- **Command — Programmazione attività** (priority 90): quando creare `agent_tasks` (esecuzione AI) vs `activities` (utente in agenda). Sempre esplicito nel piano: "Eseguo io con [agente]" vs "Metto in agenda tua per [data]".
- **Command — Uso memoria & guru** (priority 85): regole d'ingaggio per `ai_memory`, KB doctrine, sherlock_playbooks, guru/super-assistant. Quando salvare in memoria, quando consultare il guru.
- **Command — Proattività & holding pattern** (priority 80): suggerire follow-up basati su `holding_pattern_governance`, lead in attesa >7gg, mission ferme, agenti idle.
- **Command — Voce conversazionale** (priority 75): quando la sessione è in modalità voce → frasi brevi (3-4), no markdown, no esecuzione di tool di scrittura senza conferma esplicita vocale ("dì 'conferma' per procedere").

Tutti i nuovi prompt useranno `tags: ['command', 'OBBLIGATORIA', '<area>']` per essere caricati dal loader unificato (`_shared/operativePromptsLoader.ts`) con `scope: "command"` (già attivo in `useCommandSubmit` e `ai-assistant`).

## 2. Briefing automatico all'apertura

Nuovo hook `useCommandBriefing` (`src/v2/ui/pages/command/hooks/useCommandBriefing.ts`) che parte una volta al mount di `CommandPage` se `messages.length === 0`:

1. **Raccolta dati (DAL, parallel)**:
   - `holdingPatternStats()` (già esiste in `src/data/contacts.ts`)
   - `agent_tasks` in stato `pending`/`running` (con count per agente)
   - `activities` con `due_date` ≤ oggi
   - `mission_runs` bloccate / in `pending_approval`
   - Lead in `responded` ma senza follow-up >3gg
   - Top 3 partner con `lead_score` alto e holding_state critico
2. **Composizione**: chiamata a `ai-assistant` mode `tool-decision` con scope `command` e un nuovo intent `briefing` che inietta i dati raccolti come context. Il prompt "Briefing all'apertura" (DB) decide cosa dire e quali 3 azioni proporre.
3. **Output**: messaggio assistant in chat + 3 chip cliccabili sotto la chat (componente `BriefingActionChips`) che pre-compilano l'input. TTS leggero (TTS attuale) legge solo la prima frase; il resto è testo.
4. **Disattivabile**: toggle in `localStorage.wca_command_briefing` (di default ON), bottone nel header Command.

## 3. Voce ibrida: TTS attuale + ElevenLabs Conversational on-demand

**Stato attuale**: `useVoiceOutput` (TTS via edge `tts`) + `useVoiceInput` (Web Speech STT) — restano default per risposte testo→voce.

**Nuovo**: pulsante "Modalità conversazione" (icona mic doppia) nel header Command che apre una sessione full-duplex ElevenLabs:

- Nuovo hook `useCommandRealtimeVoice` basato su `@elevenlabs/react` (`useConversation`) con `connectionType: "webrtc"`.
- Nuova edge function `elevenlabs-conversation-token` che chiama `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=...` (secret `ELEVENLABS_API_KEY` già presente; richiediamo `ELEVENLABS_COMMAND_AGENT_ID` come nuovo secret se mancante).
- L'agent ElevenLabs è configurato (lato dashboard ElevenLabs, fuori codice) con `clientTools` whitelisted: `runCommandTool(toolId, params)` → richiama il registry esistente passando per `useCommandSubmit.sendMessage`.
- `overrides.agent.prompt`: iniettiamo lato client il system prompt composto da `composeSystemPrompt({ scope: "command", conversational: true })` + i prompt operativi `command` letti dal DB → coerenza 100% con la modalità testo.
- Quando la conversazione è attiva: l'azione di scrittura richiede conferma vocale ("conferma" / "annulla") prima di toccare DB; le hard guards (`hardGuards.ts`) restano invariate.

**Costo controllato**: la modalità realtime parte solo on-demand, non auto-attiva.

## 4. Programmazione attività con scelta esplicita

Nuovo tool nel registry `schedule-activity` (in `src/v2/ui/pages/command/tools/scheduleActivity.ts`) che accetta:
```
{ kind: "agent_task" | "human_activity",
  title, description, dueAt, agentId?, partnerId?, contactId? }
```
- `kind = "agent_task"` → insert in `agent_tasks` (eseguito da agente, KPI/budget governance).
- `kind = "human_activity"` → insert in `activities` (compare in agenda utente).

Il prompt "Programmazione attività" obbliga il modello, quando propone azioni nel piano, a esplicitare il `kind` per ciascuna. La UI di approvazione (`ApprovalPanel`) mostrerà un badge: 🤖 "Eseguo io" vs 📅 "Metto in agenda tua".

## 5. Uso memoria + guru

`useCommandSubmit` arricchisce già `context.history`. Aggiungiamo nel context inviato a `planExecution`:
- ultime N entries da `ai_memory` (DAL `src/data/aiMemory.ts`) filtrate per `context = 'command'` o globali
- top KB hit dal guru (`super-assistant`) per il prompt corrente — chiamata batch 1 sola query KB pre-plan

Questo è puramente lato edge (`ai-assistant`), via il sistema di context injection esistente (`contextInjection.ts`). Aggiungiamo uno scope `command` al builder che pesca da `ai_memory` + KB `command_tools` + KB `doctrine`.

## 6. Discoverability potenziata

La pagina `/v2/command/help` esiste già. Aggiunte:
- Sezione "Prompt attivi" che lista i prompt `context = command` letti via DAL (`listOperativePrompts({ scope: "command" })`), con link diretto al Prompt Lab pre-filtrato per editarli.
- Sezione "Memoria & Guru" con conteggio entry `ai_memory` correnti e KB `command_tools` + `doctrine`.
- Bottone "Avvia briefing ora" che invoca `useCommandBriefing.run()`.

---

## Sezione tecnica (riepilogo file)

**Nuovi file**:
- `scripts/seed-command-prompts.ts` (idempotente)
- `src/v2/ui/pages/command/hooks/useCommandBriefing.ts`
- `src/v2/ui/pages/command/hooks/useCommandRealtimeVoice.ts`
- `src/v2/ui/pages/command/components/BriefingActionChips.tsx`
- `src/v2/ui/pages/command/components/RealtimeVoiceButton.tsx`
- `src/v2/ui/pages/command/tools/scheduleActivity.ts`
- `supabase/functions/elevenlabs-conversation-token/index.ts`

**File modificati**:
- `src/v2/ui/pages/command/CommandPage.tsx` (mount briefing + button realtime)
- `src/v2/ui/pages/command/components/CommandPageHeader.tsx` (toggle briefing + bottone voce realtime)
- `src/v2/ui/pages/command/tools/registry.ts` (registra `schedule-activity`)
- `src/v2/ui/pages/command/CommandHelpPage.tsx` (sezioni prompt attivi + memoria)
- `supabase/functions/_shared/contextInjection.ts` (scope `command`: `ai_memory` + KB)
- `supabase/functions/ai-assistant/modeHandlers.ts` (intent `briefing`)
- `package.json` (`@elevenlabs/react`)

**Secrets richiesti** (chiederò via `secrets--add_secret` prima dell'implementazione):
- `ELEVENLABS_COMMAND_AGENT_ID` (id agente Command su dashboard ElevenLabs; `ELEVENLABS_API_KEY` già presente)

**Memoria**: aggiornerò `mem://features/command-tools-expanded` o creerò `mem://features/command-luca-orchestrator` con la nuova architettura (briefing, voce ibrida, schedule-activity).

**Vincoli rispettati**: AI Invocation Charter (tutto via `invokeAi`/`ai-assistant`), DAL-only, no `any`, voice rules esistenti, no modifica a `check-inbox`/IMAP, hard guards e soft-delete invariati.
