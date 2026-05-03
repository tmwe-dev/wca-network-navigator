## Cosa ho trovato (audit)

### 1. Stato sidebar Compose oggi
File: `src/components/global/filters-drawer/EmailComposeFiltersSection.tsx` + `BriefAccordion.tsx` + `OraclePanelSlim.tsx` + `oracleCoherence.ts`.

- **Tipo email** (Libero, Primo contatto, Follow-up, Richiesta info, Proposta, Partnership, Network espresso) → tile nella sidebar.
- **Tono** (4 voci: formale, professionale, amichevole, diretto) → tile.
- **Brief accordion** con 4 campi: Punti chiave / CTA / Da evitare / Lunghezza.
- **KB toggle** (on/off).
- **Obiettivo** (textarea) → resta dentro l'OraclePanelSlim a destra. Placeholder via `getCustomGoalPlaceholder(emailTypeId)` in `src/lib/oracleCoherence.ts` — è hard-coded e **non guarda il destinatario** (per questo a un partner cinese suggerisce "tratta Italia-USA").

### 2. Persistenza fra ingressi diversi (bug "mi resta la mail precedente")
- `ComposeAiConfigContext` salva tipo/tono/brief/customGoal in `localStorage` (`compose-ai-config-v1`) e li ricarica all'apertura della pagina, **anche se cambia il destinatario**. Quindi `customGoal` testato col partner precedente resta inchiodato sul nuovo.

### 3. Brief: cosa è davvero collegato
- I 4 campi del Brief vengono **concatenati come testo** dentro `customGoal` da `briefToText()` (es. `PUNTI CHIAVE: …`, `LUNGHEZZA: 5-7 righe`).
- A valle, `generate-email` riceve solo `goal` (stringa). Non c'è nessuna mappatura strutturata su `emailContract.length_target` né campi dedicati a key_points/CTA/avoid: l'AI li legge come testo libero. Quindi i tre campi extra (Punti chiave, CTA, Da evitare) duplicano l'obiettivo libero senza dare valore aggiuntivo, mentre **Lunghezza** è l'unico parametro che meriterebbe restare ma andrebbe agganciato in modo strutturato.

### 4. KB toggle: cosa fa davvero
- `useKB` viene letto dal payload (`use_kb`) ma nella sidebar è un on/off senza collegamento a Deep Search. La Deep Search vive in un trigger separato dentro l'OraclePanelSlim. Manca il legame esplicito "KB + Deep Search = email più ricca (e più costosa)" che il modello del prodotto promette.

### 5. Tono obbligatorio nei flussi bulk
- Nel Cockpit / mission wizard (`src/components/missions/steps/ToneStep.tsx`, `ConfirmStep.tsx`) il tono ha un default (`professionale`) e non c'è validazione che obblighi a sceglierne uno prima di lanciare un bulk. Funziona, ma è "scivoloso".

---

## Proposte

### A. Compose: pulizia sidebar
1. **Rimuovere dal Brief** i 3 campi non collegati alla pipeline:
   - Punti chiave
   - Call to Action
   - Da evitare
   
   Restano coperti dalla textarea Obiettivo, che è già libera e voice-friendly.
   
2. **Mantenere "Lunghezza"** ma promuoverla a controllo dedicato della sidebar (slider compatto Auto / Breve / Media / Lunga), e collegarla **in modo strutturato** a `generate-email` come `length_target` (oggi viaggia solo dentro la stringa goal).

3. **KB**: il toggle resta on/off ma lo si rende esplicito ("Email arricchita: usa KB + Deep Search → costo maggiore"). Quando ON, la Deep Search disponibile viene marcata come "consigliata" (badge), senza forzarla.

### B. Placeholder Obiettivo context-aware
- In `getCustomGoalPlaceholder` passare anche `recipientCountry` e `recipientCompany` (presi da `c.recipientsWithEmail[0]`).
- Esempio per partner cinese + Primo contatto: *"Es. Presentazione iniziale per esplorare collaborazione su tratta Italia-Cina con [Company]…"*.
- Se non c'è destinatario singolo, fallback al testo neutro attuale.

### C. Reset all'ingresso pagina
- In `EmailComposerPage`, al mount fare `reset()` di `ComposeAiConfigContext` (almeno di `customGoal` e `brief`). Tipo/tono/KB possono restare persistiti come preferenze utente, ma `customGoal` no — è specifico del destinatario.
- In alternativa: invalidare `customGoal` quando cambia l'ID del destinatario singolo.

### D. Audit "Tipo di email"
- Verificare che le 6 voci di default (`DEFAULT_EMAIL_TYPES`) abbiano ognuna: nome, prompt operativo nel Prompt Lab, struttura. Ad oggi alcune sono solo etichette UI senza ricaduta reale sul prompt.
- Output: tabellina (tipo → ha prompt op? → ha struttura? → KB categories?) e fix dei buchi nel Prompt Lab DB (`operative_prompts`).

### E. Tono obbligatorio nei bulk
- In `ToneStep` rimuovere il default e bloccare l'avanzamento finché tono e qualità non sono scelti esplicitamente (validazione step). Stesso pattern in eventuali altri entry-point bulk del Cockpit.

### F. Lunghezza realmente collegata
- Aggiungere `length_target` al payload di `generate-email` (oltre a tenerlo nel goal per retro-compatibilità) e farlo arrivare al `journalistReview` come parte del `resolved_brief`, così che il Giornalista possa rifiutare un draft fuori target.

---

## Dettagli tecnici (per chi implementa)

File toccati:
- `src/components/email/BriefAccordion.tsx` → ridotto a solo "Lunghezza" (rinominato `LengthControl` o inline nella sidebar).
- `src/components/global/filters-drawer/EmailComposeFiltersSection.tsx` → integra il controllo Lunghezza al posto del Brief, copy KB più esplicito.
- `src/lib/oracleCoherence.ts` → `getCustomGoalPlaceholder(typeId, ctx?: { country?, company? })`.
- `src/components/email/oracle/OraclePanelGoalInput.tsx` → riceve `recipientCountry`/`recipientCompany` per il placeholder.
- `src/components/email/OraclePanelSlim.tsx` → passa il destinatario al GoalInput.
- `src/contexts/ComposeAiConfigContext.tsx` → API `resetGoalAndBrief()`; persistenza solo per tipo/tono/KB.
- `src/v2/ui/pages/EmailComposerPage.tsx` → al mount/su cambio destinatario singolo: `resetGoalAndBrief()`.
- `src/hooks/email-composer/useEmailComposerState.ts` + `src/v2/hooks/useEmailForge.ts` → propagano `length_target` nel body.
- `supabase/functions/generate-email/index.ts` → legge `length_target`, lo passa a `resolved_brief` per `journalistReview` e nel prompt builder come hint strutturato.
- `src/components/missions/steps/ToneStep.tsx` + `ConfirmStep.tsx` → niente default, validazione obbligatoria.

Audit Prompt Lab "Email types" (proposta E) andrà fatto leggendo `operative_prompts` con `context = email_type_*` dopo l'approvazione del piano.

## Cosa NON tocco
- Pipeline `journalistReview` (resta intoccabile, ricevera solo un campo in più nel resolved_brief).
- Editor email, invio, queue, deep search runtime.
- Calligrafia injector.
- Logica auth/RLS.

## Aperto al feedback
Se vuoi, posso anche **eliminare la textarea Obiettivo** e tenere solo il dettato vocale + i tile, lasciando all'AI fare il resto basandosi su contesto + tipo + tono. Dimmelo e modifico il piano.
