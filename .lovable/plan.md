## Analisi del tuo ultimo commento

Hai ragione: il sistema è stato corretto solo in parte. Il problema non è solo una regex mancante; è che ci sono ancora diversi punti del codice che decidono prima dell’AI e restringono la sua libertà di interpretazione.

## Cosa ho trovato

1. **Prompt del planner ancora troppo prescrittivo**
   - In `ai-assistant/modeHandlers.ts` il prompt dice “interpreta semanticamente”, però subito dopo contiene esempi rigidi tipo:
     - `scrivi/manda/prepara mail/email a...`
     - `quanti partner abbiamo...`
     - follow-up tipo `riducile`, `mostrameli`, ecc.
   - Questo è ancora un comportamento “keyword-driven mascherato da AI”.

2. **Tool `compose-email` ancora pieno di hard-code semantico**
   - `COUNTRY_MAP` contiene una lista manuale di paesi.
   - `detectCountryCode()` usa regex.
   - `isCountryWideIntent()` usa regex per capire “tutti quanti / loro / partner di...”.
   - `extractPersonAndCompany()` prova a capire persona/azienda con pattern testuali.
   - Quindi il tool non sta davvero ricevendo una decisione semantica già strutturata dall’AI: continua a reinterpretare la frase da solo.

3. **Fast-lane e `ai-query` bloccano ancora il ragionamento AI**
   - `usePromptAnalysis.ts`, `queryContext.ts` e `aiQueryTool.ts` contengono liste di verbi di lettura/scrittura per decidere se andare su query, planner o compose.
   - Questo può ancora creare casi in cui una richiesta viene incanalata nel ramo sbagliato prima che il planner AI possa ragionare.

4. **Problema serio dopo l’approvazione**
   - Quando un tool write richiede approvazione, `planRunner.ts` si ferma correttamente.
   - Però al resume (`executeApprovedStep`) non passa più `originalPrompt`, `contextHint` e `history` al tool.
   - Questo può spiegare perché una sequenza corretta “quanti partner in Arabia Saudita?” → “scrivi una mail a tutti” perda controllo dopo la conferma o dopo il passaggio operativo.

5. **Prompt/performance troppo pesante**
   - Dai log: `ai-assistant` invia circa **55k caratteri di system prompt**, **56 tool**, e fallisce anche due ricerche RAG vector prima della chiamata AI.
   - Questo appesantisce il sistema e aumenta il rischio che il modello perda il focus operativo.

## Piano di riparazione

### 1. Separare “AI decide” da “tool esegue”
Rendere il planner responsabile della comprensione semantica e far arrivare ai tool parametri già strutturati.

Esempio target:
```text
Utente: “scrivi una mail a tutti quanti”
Contesto: ultima query = partners, country_code=SA, count=...
Planner AI produce:
{
  toolId: "compose-email",
  params: {
    mode: "batch_from_context",
    target: { table: "partners", countryCode: "SA" },
    userIntent: "scrivi una mail a tutti i partner appena trovati"
  }
}
```

Il tool non deve più indovinare “tutti quanti” con regex: deve solo eseguire il target già deciso.

### 2. Ridurre i prompt hard-coded a principi generali
Sostituire gli esempi rigidi nel planner con regole operative astratte:

- interpreta la richiesta nel contesto conversazionale;
- se l’utente fa riferimento a risultati appena mostrati, usa quel contesto;
- se serve scrivere/modificare/inviare, richiedi approvazione;
- ritorna sempre parametri strutturati, non testo da reinterpretare.

Gli esempi specifici non vanno eliminati ovunque, ma devono stare nella KB/Prompt Lab come linee guida, non nel codice come gate deterministici.

### 3. Introdurre un `CommandContext` unico
Unificare i contesti attuali:

- ultimo risultato query;
- ultimo batch composer;
- canvas attivo;
- ultimo tool usato;
- righe/partner selezionati;
- TTL;
- operazioni possibili sul contesto.

Così l’AI non riceve solo “un batch attivo”, ma una fotografia operativa standard.

### 4. Riparare il resume dopo approvazione
Modificare il flusso approval per preservare:

- `originalPrompt`;
- `contextHint`;
- `history`;
- `activeContext`;
- parametri AI strutturati.

Questo evita che dopo “OK procedi” il sistema perda il contesto Arabia Saudita / partner appena trovati.

### 5. Alleggerire il planner
Ridurre carico e latenza:

- non passare sempre 56 tool completi;
- costruire una shortlist di tool candidati per categoria, lasciando comunque all’AI la decisione finale;
- correggere o disattivare il fallback RAG vector che ora produce errori `operator does not exist: extensions.vector <=> extensions.vector`;
- separare prompt “routing breve” da prompt “ragionamento operativo”.

### 6. Standardizzare rendering e conferme senza affidarsi al prompt
La formattazione non deve dipendere dalla buona volontà dell’AI.

- Il renderer deve visualizzare sempre markdown/canvas in modo standard.
- Le operazioni write devono mostrare sempre approval panel.
- Il testo AI può seguire una grammatica consigliata, ma la UI deve comunque formattare in modo coerente.

## Risultato atteso

Dopo questa correzione, il flusso sarà:

```text
Domanda utente
  ↓
CommandContext standardizzato
  ↓
Planner AI semantico produce piano + parametri strutturati
  ↓
Approval costante se write
  ↓
Tool esegue senza reinterpretare con regex
  ↓
Canvas/rendering standardizzato
```

Questo risolve il punto centrale che hai evidenziato: non aggiungere altre parole chiave, ma togliere dal codice la responsabilità di interpretare linguisticamente al posto dell’AI.