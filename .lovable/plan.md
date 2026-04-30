# Audit Command AI: diagnosi e piano di intervento

## Problema confermato
Il flusso visto nella conversazione non è un singolo bug: è un problema architetturale nella Command AI. Il sistema perde il target operativo tra un turno e l'altro, confonde query di lettura con azioni, non usa in modo affidabile i risultati appena selezionati e lascia che l'AI proponga tool incoerenti come LinkedIn anche quando l'utente lo vieta.

## Cause principali trovate

1. **La memoria conversazionale visibile non viene persistita davvero nel flusso corrente**
   - `useConversation` esiste e salva/legge `command_conversations` e `command_messages`.
   - Ma `CommandPage` usa solo `state.addMessage`, non `conv.addMessage` durante `sendMessage`.
   - Risultato: la chat locale funziona finché la pagina è aperta, ma lo storico DB non viene aggiornato in tempo reale e il sistema non ha un resume affidabile.

2. **La history passata ai modelli è troppo povera e rumorosa**
   - `useCommandHistory` passa solo gli ultimi 6 messaggi locali.
   - Dentro ci finiscono anche messaggi tecnici tipo `Ricerca AI · 12286`, non un riassunto strutturato dello stato.
   - Il modello vede testo, non uno stato operativo: non sa che “questi cinque” sono i 5 partner di Marsa filtrati da Malta.

3. **Il contesto strutturato salva solo tabella/filtri/righe, non il “working set”**
   - `QueryContext` contiene `table`, `filters`, `mode`, `lastResultRows`.
   - Non contiene una lista canonica di ID selezionati/risultanti, il nome del set, né vincoli negativi come `noLinkedIn`.
   - `resetForNewMessage()` cancella `liveResult` e `selectedIds`, quindi il target operativo sparisce a ogni nuovo invio.

4. **La selezione UI non è collegata al linguaggio naturale**
   - Il canvas consente selezione righe, ma `sendMessage()` non passa `selectedIds` né `liveResult` ai tool.
   - Quando l'utente dice “partner selezionati” o “questi cinque”, il planner deve indovinare dal testo invece di ricevere gli ID.

5. **Mismatch whitelist client/server sulle tabelle**
   - `ai-query-planner` server consente `partner_contacts` e `prospects`.
   - `allowedTables.ts` client non contiene `partner_contacts` né `prospects`.
   - Risultato: il planner può scegliere `partner_contacts`, ma il safe executor client la blocca o degrada; da qui messaggi tipo “non posso accedere a partner_contacts”.

6. **Il planner non supporta join o lookup relazionali**
   - La richiesta “verifica se questi cinque hanno contatti con email” richiede `partner_contacts.partner_id IN <5 ids>`.
   - L'attuale `QueryPlan` può interrogare una tabella alla volta, ma non eredita gli ID del set precedente né fa join/relazione.
   - Quindi ripiega su query generiche, spesso sbagliate.

7. **I tool di arricchimento richiedono un singolo UUID**
   - `enrichPartnerFromWebsiteTool` e `enrichPartnerFromWebTool` estraggono un solo `partnerId` dal prompt/payload.
   - Se il planner passa “questi 5 partner” senza UUID, il tool fallisce con `Partner ID non trovato. Specifica un UUID partner.`
   - Non esiste un batch enrichment tool che accetti `partnerIds[]` dal working set.

8. **Il sistema propone LinkedIn senza rispettare i vincoli espliciti**
   - I suggerimenti arrivano da `aiBridge` e `localResultFormatter` senza un registro dei vincoli conversazionali.
   - “No LinkedIn” non viene salvato come policy temporanea della sessione.
   - Per questo il sistema continua a proporre LinkedIn dopo un divieto esplicito.

9. **Pericolo bulk: il sistema può allargare da 5 a migliaia di record**
   - Nel caso “genera alias per questi partner”, la query è degradata fino a 12.286 record.
   - Non c'è un guardrail frontend che blocchi qualunque azione quando il working set atteso è 5 ma il piano produce 12.286.
   - I bulk cap hard esistono per tool di mutation, ma qui il danno nasce già nella fase di query/commento/preparazione.

10. **La memoria/RAG backend ha un errore reale**
   - Nei log edge `ai-assistant` risultano errori:
     - `ragSearchMemory RPC error: operator does not exist: extensions.vector <=> extensions.vector`
     - `ragSearchKb RPC error: operator does not exist: extensions.vector <=> extensions.vector`
   - Quindi parte della memoria globale/KB vettoriale non sta funzionando correttamente.

## Piano di rifondazione

### 1. Introdurre un vero `CommandSessionContext`
Creare uno stato strutturato unico, passato a planner, query planner, commentary e tool:

```text
CommandSessionContext
- currentWorkingSet:
  - entity: partners | partner_contacts | business_cards | imported_contacts
  - ids: string[]
  - label: "5 partner di Marsa, Malta"
  - sourceTable
  - filters
  - rowCount
  - rowsSnapshot
- constraints:
  - noLinkedIn: boolean
  - onlyOfficialWebsites: boolean
  - noExternalSearch: boolean
- lastSuccessfulTool
- lastUserIntent
- lastResultSummary
```

Obiettivo: “questi cinque”, “partner selezionati”, “loro”, “questi partner” devono sempre risolversi agli ID reali, non a una nuova query larga.

### 2. Persistenza reale della conversazione
Collegare `useCommandSubmit` a `conv.addMessage` oppure creare un adapter unico `addCommandMessage` che:

- aggiorna UI locale;
- salva in `command_messages`;
- salva i `tool_result` reali per i messaggi tool;
- aggiorna il contesto quando si ricarica una conversazione.

Questo rende il resume vero, non solo una chat locale temporanea.

### 3. Pulire la history passata all'AI
Sostituire gli ultimi 6 messaggi grezzi con:

```text
- ultimi N messaggi utente/direttore puliti
- esclusi messaggi Automation tecnici
- più CommandSessionContext serializzato
```

Il modello deve vedere: “working set attivo = 5 partner di Marsa, ids=[...]”, non solo “Ricerca AI · 5”.

### 4. Allineare whitelist e schema query
Allineare `allowedTables.ts` con `ai-query-planner`:

- aggiungere `partner_contacts`;
- valutare `prospects`/`prospect_contacts` se ancora usati;
- aggiungere priorità colonne e label per `partner_contacts`;
- impedire che il planner scelga una tabella che il client poi blocca.

### 5. Aggiungere query relazionali sicure per working set
Estendere il planner/executor per richieste come:

- “contatti dei partner selezionati”;
- “email aziendali di questi partner”;
- “biglietti collegati a questi partner”.

Prima versione senza join arbitrari:

- se `workingSet.entity === partners` e l'utente chiede contatti → query `partner_contacts` con `partner_id in workingSet.ids`;
- se chiede email aziendali → query `partners` con `id in workingSet.ids`;
- se chiede BCA → query `business_cards` con `matched_partner_id in workingSet.ids`.

### 6. Batch enrichment controllato per siti ufficiali
Creare/adeguare un tool che accetti `partnerIds[]` e non un solo UUID:

```text
enrich-selected-partners-websites
- input: partnerIds[], mode: official_website_only
- vieta LinkedIn se constraints.noLinkedIn=true
- richiede approvazione se > 1 partner
- mostra prima anteprima: aziende, siti, azione prevista
- esegue max 5 automatici o chiede conferma esplicita per più record
```

Nessuna ricerca LinkedIn deve essere proposta o invocata se il vincolo è attivo.

### 7. Guardrail anti-allargamento scope
Aggiungere un controllo centrale prima di ogni azione su set:

```text
if user refers to working set of 5
and planned target count > 5
then block and ask confirmation/re-scope
```

Esempio messaggio corretto:
“Mi fermo: stavo per operare su 12.286 record, ma il contesto attivo è 5 partner di Marsa. Vuoi limitare l'azione a quei 5?”

### 8. Suggerimenti coerenti con vincoli e contesto
Modificare `aiBridge` e `localResultFormatter` in modo che:

- ricevano `CommandSessionContext`;
- non propongano LinkedIn quando `noLinkedIn=true`;
- propongano azioni sui “5 partner selezionati”, non su tutto il paese;
- non inventino capacità non disponibili.

### 9. Fix memoria/RAG backend
Analizzare e correggere le RPC `match_kb_entries` / `match_ai_memory` o equivalenti, perché oggi il confronto vettoriale fallisce con tipo `extensions.vector`.

Obiettivo:
- memoria globale e KB devono tornare interrogabili;
- se RAG fallisce, il sistema deve loggare ma anche degradare in modo esplicito negli audit tecnici, non fingere memoria piena.

### 10. Test regressione sul caso Malta/Marsa
Aggiungere test mirati del flusso:

1. “Trova i partner di Malta” → 9 partner, working set Malta.
2. “filtra per città Marsa” → 5 partner, working set Marsa/Malta con 5 ID.
3. “verifica se questi cinque hanno contatti con mail” → query `partner_contacts` con `partner_id in <5 ids>`.
4. “non usare LinkedIn, cerca sui siti ufficiali” → constraint `noLinkedIn=true`, `onlyOfficialWebsites=true`.
5. “arricchisci questi 5” → batch tool con 5 IDs, approvazione, nessun LinkedIn.
6. “genera alias per questi partner” → massimo 5, mai 12.286.

## File principali da modificare in implementazione

- `src/v2/ui/pages/command/hooks/useCommandState.ts`
- `src/v2/ui/pages/command/hooks/useCommandSubmit.ts`
- `src/v2/ui/pages/command/hooks/useCommandHistory.ts`
- `src/v2/ui/pages/command/hooks/useQueryContext.ts`
- `src/v2/ui/pages/command/lib/queryContext.ts`
- `src/v2/ui/pages/command/lib/allowedTables.ts`
- `src/v2/ui/pages/command/lib/safeQueryExecutor.ts`
- `src/v2/ui/pages/command/tools/aiQueryTool.ts`
- `src/v2/ui/pages/command/tools/enrichPartnerFromWebsite.ts`
- `src/v2/ui/pages/command/aiBridge.ts`
- `supabase/functions/ai-query-planner/index.ts`
- `supabase/functions/ai-assistant/modeHandlers.ts`
- RPC/migrazioni memoria vettoriale se necessario

## Risultato atteso
Dopo l'intervento, la Command AI deve comportarsi come un operatore sequenziale:

- mantiene il working set;
- sa che “questi cinque” sono i 5 partner di Marsa;
- non allarga mai a migliaia di record senza blocco;
- non propone LinkedIn se vietato;
- usa `partner_contacts` quando l'utente chiede contatti dei partner;
- recupera la conversazione e il contesto anche dopo reload o riapertura.