# Audit Cervello AI — stato reale e piano di semplificazione

Risposta breve alla domanda: no, il braccio Intelligenza **non** è più fluido di quello Integrazioni. È il più problematico dei due — più codice, più cervelli paralleli, più fonti di verità per prompt e memoria, e del codice condiviso costruito per unificare tutto che oggi non è usato da nessuno.

## 1. Numeri verificati

- 45 funzioni edge nel braccio Cervello AI, ~9.500 righe (le Integrazioni erano ~35 funzioni / ~6.500 righe).
- `ai-assistant` da solo: 23 file, 4.579 righe — è il vero motore.
- 60 file edge chiamano direttamente lo shim AI; 10 file fanno `fetch` diretto verso endpoint di modello.
- 42 file toccano `kb_entries`, 26 toccano `ai_memory` / `conversation_summaries`.

## 2. Problemi trovati (in ordine di gravità)

### 2.1 Motore condiviso morto
`_shared/assistantEngine.ts` (153), `_shared/toolExecutionLoop.ts` (178), `_shared/platformTools.ts` + `platformToolDefs.ts` (94) hanno **zero importatori**: nessuna funzione li usa. In parallelo `ai-assistant` ha un proprio `toolLoopHandler.ts` + 5 file `toolDefs-*`. Esiste cioè un tentativo di unificazione abbandonato a metà, ~425 righe di codice fantasma che confondono chiunque legga il sistema (compresa l'AI che lo modifica).

### 2.2 Troppi cervelli conversazionali
Loop tool + prompt propri, indipendenti: `ai-assistant`, `command-ask-brain`, `voice-brain-bridge`, `prompt-copilot-chat`, `harmonize-proposal-chat`, `super-mario`, `optimus-analyze`, `agentic-decide`, più `finder-api-chat` già visto nelle Integrazioni. Nove punti dove correggere una regola di comportamento significa nove modifiche.

### 2.3 Un hop inutile
`unified-assistant` (139 righe) non fa altro che inoltrare a `ai-assistant`: il commento nel file lo dichiara esplicitamente. Ma è chiamato da 16 file frontend, mentre altri 15 chiamano `ai-assistant` direttamente. Due porte per lo stesso motore.

### 2.4 Il motore bypassa il proprio gateway
`ai-assistant` ha `aiProviderResolver.ts` + `aiCallHandler.ts` che fanno chiamate dirette al provider, invece di passare da `_shared/aiCallShim.ts` come le altre 60 chiamate. Budget, costo e logging non sono garantiti sullo stesso percorso.

### 2.5 Prompt su quattro registri
`operative_prompts`, `prompt_templates`, `email_prompts`, `prompt_versions`, più `edgeFnPromptRegistry.ts` a codice, più prompt inline nei singoli file. Esistono già trigger di mirroring tra tabelle: sintomo, non soluzione.

### 2.6 Conoscenza frammentata
`kb_entries` + `kb_entry_proposals` + `finder_api_kb` + i file in `public/kb-source/` + `ai_memory` + `conversation_summaries` + `scraper_agent_memory`. Sette contenitori per "quello che il sistema sa", con 10 funzioni `kb-*` e 2 `memory-*` che li muovono tra loro.

### 2.7 Famiglia agent sovrapposta
`agent-loop`, `agent-execute`, `agent-autonomous-cycle`, `agent-task-drainer`, `agent-autopilot-worker`, `agent-simulate`, `agent-audit`: ~2.100 righe con tre cicli di esecuzione diversi che fanno concettualmente la stessa cosa (prendi task → decidi → esegui → logga).

## 3. Quanto si può semplificare

| Intervento | Da → A | Rischio |
|---|---|---|
| Rimuovere il motore condiviso morto | −425 righe | Nullo |
| Chiudere il doppio hop `unified-assistant` | 2 porte → 1 | Basso |
| Portare `ai-assistant` sullo shim AI unico | 1 bypass → 0 | Basso |
| Consolidare i cervelli minori come scope di `ai-assistant` (`command-ask-brain`, `voice-brain-bridge`, `super-mario`, `finder-api-chat`) | 9 loop → 4-5 | Medio |
| Registro prompt unico (`operative_prompts` come SSOT, gli altri diventano viste) | 4 registri → 1 | Medio |
| KB unica con `source_type` (assorbe `finder_api_kb` e `public/kb-source`) | 7 contenitori → 3 | Medio |
| Un solo ciclo agent parametrico | 7 funzioni → 4 | Alto |

Totale realistico: da 45 a ~32 funzioni, ~2.500 righe in meno, e — soprattutto — un solo posto dove si cambia il comportamento dell'AI invece di nove.

## 4. Ordine proposto

1. Fase A (rischio nullo/basso): eliminare il codice motore morto, chiudere il doppio hop, portare `ai-assistant` sullo shim unico. Nessun cambiamento di comportamento visibile.
2. Fase B: registro prompt unico con compatibilità di lettura per i nomi vecchi.
3. Fase C: KB unificata con `source_type`, assorbendo `finder_api_kb`.
4. Fase D: assorbire i cervelli minori come scope, uno alla volta, con confronto risposta prima/dopo.
5. Fase E (solo alla fine): ciclo agent unico.

## 5. Note tecniche

- Ogni fase mantiene invariati i contratti di invocazione frontend: le porte vecchie restano come alias finché tutti i chiamanti non sono migrati.
- Prima di ogni rimozione: verifica dei log di invocazione reali, non solo dei riferimenti statici.
- Le fasi A–C sono indipendenti dal piano Integrazioni e possono procedere in parallelo; la D tocca `finder-api-chat`, quindi va coordinata con la Fase B di quel piano.
- Il braccio "Cervello AI" della galassia va aggiornato per mostrare i loop tool reali, così che questa mappa resti verificabile a colpo d'occhio.
