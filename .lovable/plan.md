

# Piano di Audit e Hardening: Prompt, KB, Voice e Flusso Commerciale

## Diagnosi Completa

Dopo un'analisi approfondita di tutte le edge function, i prompt, la KB, le tabelle e l'integrazione ElevenLabs, ho identificato **problemi critici** che impediscono al sistema di funzionare come progettato.

---

## PROBLEMA 1 — Tabelle Critiche Mancanti (BLOCCANTE)

Le seguenti tabelle sono referenziate nel codice ma **NON ESISTONO** nel database:

| Tabella | Chi la usa | Impatto |
|---|---|---|
| `commercial_playbooks` | `voice-brain-bridge`, `toolHandlersEnterprise` | Voice brain NON carica nessun playbook — risponde senza contesto commerciale |
| `voice_call_sessions` | `voice-brain-bridge` | Chiamate vocali non vengono tracciate — nessuno storico |
| `partner_workflow_state` | `ai-assistant` (workflow gate) | I workflow commerciali (qualifica→closing) sono completamente inoperativi |
| `commercial_workflows` | `ai-assistant` | Nessun workflow gate funziona — il framework di vendita strutturato è morto |
| `request_logs` | `voice-brain-bridge` | Nessun log delle richieste voice |
| `ai_request_log` | `voice-brain-bridge` | Nessun tracking delle chiamate AI per il canale voce |
| `ai_session_briefings` | Agent staff (Mira, Aurora) | Briefing operativi non funzionano |

Le migrazioni SQL esistono (`wave4`, `wave5`, `wave6`) ma evidentemente non sono mai state applicate.

**Fix**: Eseguire una migrazione unificata che crea tutte queste tabelle + seed dei playbook e delle regole voice.

---

## PROBLEMA 2 — KB "voice_rules" Vuota

Il `voice-brain-bridge` cerca `kb_entries` con `category = 'voice_rules'` ma **non ne esiste nessuna**. Il Brain vocale riceve ZERO istruzioni su come condurre una chiamata commerciale.

Le 16 categorie KB esistenti coprono email e vendita testuale ma mancano completamente:
- `voice_rules` — regole per il canale voce (tono, durata turni, gestione obiezioni vocali)
- `voice_playbooks` — script per chiamate strutturate

**Fix**: Creare 5-8 KB entries `voice_rules` con: regole di turno (≤40 parole), gestione obiezioni vocali, script di apertura/chiusura, transizioni di stato, regole anti-allucinazione vocali.

---

## PROBLEMA 3 — Prompt ai-assistant Riferisce Strumenti Inesistenti

Il system prompt del `ai-assistant` (3780 righe) menziona:
- `advance_workflow_gate` — tool referenziato ma la tabella `partner_workflow_state` non esiste
- `list_playbooks`, `apply_playbook` — tool per playbook, ma `commercial_playbooks` non esiste
- `get_procedure` — menzionato nel prompt ma non definito nei tool
- `list_voice_call_sessions` — referenziato nel seed degli agenti, tabella non esiste
- `save_kb_rule` — referenziato nel LEARNING_PROTOCOL, non definito come tool

Il CATALOGO PROCEDURE nel prompt (righe 270-302) è coerente con i tool reali, ma le sezioni Enterprise (workflow, playbook, voice) puntano nel vuoto.

**Fix**: Rimuovere riferimenti a tool inesistenti oppure (preferibile) creare le tabelle mancanti e definire i tool corrispondenti.

---

## PROBLEMA 4 — Categorie KB vs Tags nel System Prompt

Le 16 categorie KB sono:
```
arsenale, chiusura, chris_voss, cold_outreach, dati_partner, errori,
filosofia, followup, frasi_modello, hook, negoziazione, obiezioni,
persuasione, regole_sistema, struttura_email, tono
```

Il prompt del `ai-assistant` le referenzia correttamente nel CATALOGO PROCEDURE tramite i tag (`email`, `outreach`, `deep`, `search`, `linkedin`, ecc.) — **ma la KB viene caricata tramite RAG semantico o top-priority (≥5), NON per categoria/tag**.

La funzione `loadKBContext()` usa:
1. RAG retrieval semantico (se query ≥ 8 char)
2. Fallback: top 10 per priority ≥ 5

Questo significa che le categorie `arsenale` (priority 7) e `persuasione` (priority 7) vengono iniettate MENO frequentemente delle `regole_sistema` (priority 10). **La gerarchia è corretta** ma andrebbe verificata la copertura durante le conversazioni commerciali.

---

## PROBLEMA 5 — Voice Integration Incompleta

Il sistema ha 3 layer vocali, ma nessuno funziona completamente:

1. **TTS (elevenlabs-tts)** — Funziona. Edge function OK, `useAiVoice.ts` lo usa correttamente.
2. **Conversational Agent (elevenlabs-conversation-token + AgentVoiceCall)** — Funziona solo se l'agente ElevenLabs è configurato esternamente. Il `voice-brain-bridge` è il webhook per questo, ma **fallisce silenziosamente** perché `commercial_playbooks` e `voice_call_sessions` non esistono.
3. **STT (Web Speech API)** — Funziona (browser-native), nessun problema.

---

## PROBLEMA 6 — Operative Prompts Vuoti

La tabella `operative_prompts` esiste ed è correttamente referenziata da `loadOperativePrompts()`, ma contiene **0 record**. Il LEARNING_PROTOCOL nel system prompt istruisce l'AI a creare operative prompts (`save_operative_prompt`) ma questo tool non è mai stato definito.

---

## Piano di Implementazione (6 Step)

### Step 1: Migrazione Tabelle Mancanti
Creare una singola migrazione SQL che:
- Crea `commercial_playbooks`, `commercial_workflows`, `partner_workflow_state`
- Crea `voice_call_sessions`, `request_logs`, `ai_request_log`, `ai_session_briefings`
- Seed playbook `voice_wca_partner_call` con template completo
- RLS per tutte le tabelle
- Indici per performance

### Step 2: Seed KB Voice Rules
Inserire 6 `kb_entries` con `category = 'voice_rules'`:
1. "Regole di turno vocale" — ≤40 parole, niente markdown/URL, tono naturale
2. "Script apertura chiamata" — saluto, identificazione, hook iniziale
3. "Gestione obiezioni vocali" — riformulazione Chris Voss adattata al parlato
4. "Transizioni di stato" — discovery→qualification→closing trigger phrases
5. "Chiusura e follow-up vocale" — CTA verbale, proposta follow-up email
6. "Schema output JSON Brain→Voice" — contratto JSON documentato

### Step 3: Pulizia System Prompt ai-assistant
- Rimuovere riferimenti a `get_procedure` (non esiste come tool)
- Aggiungere tool definition per `save_operative_prompt` e `save_kb_rule`
- Verificare che `advance_workflow_gate` abbia il corrispondente handler in `toolHandlersEnterprise.ts`

### Step 4: Definire Tool Mancanti
In `toolHandlersEnterprise.ts` o direttamente in `ai-assistant`:
- `save_operative_prompt` — insert in `operative_prompts`
- `save_kb_rule` — insert in `kb_entries`
- Verificare che `advance_workflow_gate`, `list_playbooks`, `apply_playbook` abbiano handler funzionanti

### Step 5: Test End-to-End Voice Brain Bridge
- Deploy `voice-brain-bridge` aggiornato
- Test con curl simulando un turno di chiamata
- Verificare che il playbook venga caricato e le voice_rules iniettate
- Verificare che la sessione venga salvata in `voice_call_sessions`

### Step 6: Test Flusso Commerciale Completo
Verificare l'intero percorso:
1. **Mission Builder** → Crea missione → Plan Review → Approve → cockpit_queue
2. **AI Assistant** → Conversazione con memory + KB inject → genera outreach
3. **Holding Pattern** → Contatti entrano nel circuito → screening automatico
4. **Voice** → Chiamata a partner → Brain carica playbook + context → azioni registrate

---

## File Coinvolti

- `supabase/migrations/` — nuova migrazione unificata per le 7 tabelle
- `supabase/functions/ai-assistant/index.ts` — pulizia prompt, aggiunta tool definitions
- `supabase/functions/_shared/toolHandlersEnterprise.ts` — handler per tool mancanti
- `supabase/functions/voice-brain-bridge/index.ts` — nessuna modifica (già corretto, mancano solo le tabelle)
- KB seed — 6 entries `voice_rules` + seed `operative_prompts`

