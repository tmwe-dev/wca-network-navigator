
## Verifiche fatte

Ho letto il flusso reale di `/v2/command` e il problema è chiaro.

### Pipeline attuale
Per una domanda semplice come “quanti partner abbiamo negli Stati Uniti?” il sistema oggi fa:

```text
utente
→ ai-assistant (plan-execution)
→ planRunner
→ aiQueryTool
→ ai-query-planner
→ safeQueryExecutor
→ ai-assistant (commento finale)
→ risposta chat
```

Quindi per una query banalissima ci sono **3 passaggi AI distinti** prima della risposta finale.

## Problemi trovati

### 1. Bug architetturale nel passaggio prompt → tool
In `src/v2/ui/pages/command/planRunner.ts` il tool riceve:

```ts
const promptText = JSON.stringify(resolvedParams);
tool.execute(promptText, { payload: resolvedParams })
```

Ma `src/v2/ui/pages/command/tools/aiQueryTool.ts` **ignora il payload** e ripianifica usando `promptText`.

Quindi l’AI Query Planner spesso non riceve più la domanda naturale dell’utente, ma un JSON tipo:

```json
{"city":"New York","count_only":true}
```

Questo spiega bene perché il primo caso USA può andare e il follow-up su New York no: il planner perde contesto e intenzione conversazionale.

### 2. Nessuna memoria strutturata del contesto query
La seconda domanda “a New York quanti ne abbiamo?” non eredita in modo affidabile il contesto “stiamo parlando dei partner USA”.
C’è history testuale, ma non c’è uno **state/query context** strutturato del tipo:

```text
entity=partners
country_code=US
mode=count
```

Quindi il follow-up è fragile.

### 3. Lentezza reale
Per una read query semplice il sistema è pesante:
- 1 chiamata AI per pianificare
- 1 chiamata AI per trasformare in query
- 1 chiamata AI per commentare il risultato

È normale che sembri lento e poco fluido.

### 4. Robustezza lessicale insufficiente
Nel transcript c’è “quanti pane abbiamo a New York”.
Per un CRM verticale, il sistema dovrebbe tollerare errori come:
- pane → partner
- stati uniti / usa / america → US
- ny / new york city / nyc → New York

Oggi non vedo un layer dedicato di normalizzazione intent/domain.

## Piano di intervento

### 1. Correggere il contratto tra `planRunner` e `aiQueryTool`
Obiettivo: se il planner ha già deciso `ai-query`, il tool deve ricevere il **prompt utente originale** oppure un **QueryPlan strutturato**, non un JSON serializzato ambiguo.

Interventi:
- `src/v2/ui/pages/command/planRunner.ts`
- `src/v2/ui/pages/command/tools/aiQueryTool.ts`
- `src/v2/ui/pages/command/tools/types.ts`

Approccio:
- far supportare ad `aiQueryTool.execute()` il `context.payload`
- se `payload` contiene già intento/query plan, usarlo direttamente
- non ripianificare su `JSON.stringify(params)`

Questo è il fix più importante.

### 2. Aggiungere contesto conversazionale strutturato per le query
Obiettivo: follow-up come “e a New York?” devono agganciarsi all’ultima query compatibile.

Interventi:
- `src/v2/ui/pages/command/hooks/useCommandState.ts`
- `src/v2/ui/pages/command/hooks/useCommandSubmit.ts`
- eventuale nuovo helper tipo `queryContext.ts`

Da salvare:
- tabella/entity (`partners`)
- filtri attivi (`country_code=US`)
- tipo richiesta (`count`, `list`, `top-rated`)
- eventuale colonna focus (`city`)

Regola:
- se il nuovo prompt è ellittico ma compatibile, si fa merge col contesto precedente
- es.: “quanti partner abbiamo negli USA?” → poi “a New York?” = `partners + country_code=US + city ilike New York`

### 3. Fast lane per query di lettura semplici
Obiettivo: rendere `/v2/command` fluido come V2 classica.

Interventi:
- `src/v2/ui/pages/command/hooks/useCommandSubmit.ts`
- `src/v2/ui/pages/command/tools/registry.ts`
- `src/v2/ui/pages/command/aiBridge.ts`

Approccio:
- se il prompt matcha chiaramente `ai-query` e non richiede workflow multi-step:
  - saltare `plan-execution`
  - eseguire direttamente `aiQueryTool`
  - opzionalmente saltare anche il commento AI finale e usare un commento locale leggero per count/list semplici

Effetto:
- da 3 hop AI a 1 hop AI nelle query semplici.

### 4. Rafforzare il planner con esempi su città e follow-up
Interventi:
- `supabase/functions/ai-query-planner/index.ts`
- `src/v2/agent/prompts/core/query-planner.ts`
- se serve allineamento: `src/v2/agent/kb/dbSchema.ts`

Da aggiungere:
- esempi espliciti:
  - “quanti partner abbiamo a New York”
  - “quanti partner USA abbiamo a New York”
  - “e a Miami?”
  - “solo HQ a Los Angeles”
- regola chiara: se si parla di `partners`, per la città usare `city ilike`
- se il turno precedente era su `partners` stesso dominio, eredita i filtri geografici compatibili

### 5. Normalizzazione lessicale minima, non invasiva
Obiettivo: tollerare errori senza hardcodare mezzo sistema.

Interventi:
- piccolo preprocessor prima della pianificazione in `useCommandSubmit.ts` oppure in `aiQueryTool.ts`

Esempi:
- pane → partner
- partnera / patner → partner
- usa / stati uniti / america → US
- nyc / new york city → New York

Deve essere:
- leggero
- limitato a un vocabolario business/domain
- senza irrigidire l’AI

### 6. Verifica end-to-end
Dopo l’implementazione verificherei questi casi:

1. “quanti partner abbiamo negli Stati Uniti d’America” → 1080
2. “a New York quanti ne abbiamo?” subito dopo → conteggio corretto
3. “e a Miami?” → nuovo conteggio corretto usando il contesto
4. “quanti HQ abbiamo a Los Angeles?” → filtro città + office_type corretto
5. typo: “quanti pane abbiamo a New York” → interpretato come partner
6. latenza percepita: forte riduzione su query semplici
7. nessuna regressione sui task multi-step reali

## Priorità consigliata

### Fase 1 — urgente
- fix `planRunner` ↔ `aiQueryTool`
- fast lane read-only per `/v2/command`

### Fase 2 — subito dopo
- query context strutturato per follow-up
- esempi/planner city-aware

### Fase 3 — rifinitura
- normalizzazione typo/domain terms
- commento locale leggero per risultati semplici

## Esito secco

Sì, hai ragione: abbiamo fatto passi avanti, ma `/v2/command` **non è ancora fluido né affidabile nei follow-up query-based**.

Il problema principale non è il database.
Il problema è il **flusso di orchestrazione**:
- troppo lungo
- troppo AI-centrico anche quando non serve
- con perdita di contesto tra pianificazione ed esecuzione

Se approvi, il prossimo intervento corretto è questo:
1. sistemare il passaggio prompt/query plan,
2. introdurre contesto query conversazionale,
3. tagliare una o due chiamate AI nelle query semplici.
