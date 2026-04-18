
Obiettivo reale: non “riapplicare alla cieca” J/K, ma chiudere il gap tra sorgente, runtime e modello dati, perché dal codice letto i fix REPAIR-J e REPAIR-K risultano presenti nel repository, mentre il comportamento che descrivi indica drift o integrazione rotta.

Diagnosi verificata dal codice:
- REPAIR-J è presente nei sorgenti:
  - `supabase/functions/whatsapp-ai-extract/index.ts` contiene prompt WA in italiano, schema ridotto, selezione modello condizionale `learnDom -> gemini-2.5-flash`.
  - `supabase/functions/linkedin-ai-extract/index.ts` contiene prompt LI in italiano, `threadUrl`, `direction`, timeout 30s e check auth header/apikey.
  - `public/whatsapp-extension/ai-extract.js` contiene `chatItemSamples`, `buttons`, `tabIndexElements`, `lang`.
  - `public/linkedin-extension/actions.js` contiene `convertLinkedInSchemaToOptimusPlan`, mapping `threadUrl`, `direction` e `mapOptimusThreadMessages`.
- REPAIR-K è presente nei sorgenti:
  - esistono `supabase/functions/_shared/cadenceEngine.ts` e `supabase/functions/_shared/stateTransitions.ts`
  - `generate-outreach`, `agent-autonomous-cycle` e `agent-execute` importano e usano già i blocchi K.

Quindi il problema probabile NON è “codice assente”, ma uno di questi:
1. funzioni backend pubblicate non allineate ai file locali;
2. ZIP estensioni serviti/non aggiornati o cache browser/CDN;
3. mismatch strutturale del modello stati: K usa `first_touch_sent / holding / engaged / qualified / archived`, mentre parti esistenti del prodotto usano ancora `new / contacted / in_progress / negotiation / converted / lost`. Questo è il bug architetturale più serio: anche con file presenti, K può risultare di fatto “non applicato” o non osservabile.

Piano correttivo che implementerò appena approvato:

1. Audit runtime verità unica
- Verificare ciò che è davvero servito in preview/pubblicato:
  - manifest e contenuto ZIP WA/LI correnti;
  - backend pubblicato di `whatsapp-ai-extract`, `linkedin-ai-extract`, `generate-outreach`, `agent-autonomous-cycle`, `agent-execute`.
- Confrontare runtime vs repository per individuare il punto esatto di drift.

2. Correzione drift deploy/asset
- Se runtime è vecchio: ridistribuire le edge function coinvolte.
- Se ZIP/manifest sono vecchi: rigenerare WA e LI dalle cartelle sorgente correnti e riallineare:
  - `public/chrome-extensions/catalog.json`
  - `src/lib/whatsappExtensionZip.ts`
  - alias root `public/whatsapp-extension.zip` / `public/linkedin-extension.zip`
- Invalidare fallback incoerenti e verificare che i download puntino solo agli asset correnti.

3. Correzione strutturale REPAIR-K
- Riallineare il cadence/state engine alla tassonomia lead già esistente nel prodotto.
- Opzione che seguirò salvo tuo veto: NON introdurre nuovi `lead_status` sparsi; invece:
  - usare gli stati canonici esistenti per trigger e sequencing;
  - oppure isolare i nuovi stati in un campo separato se davvero indispensabili.
- Aggiornare `cadenceEngine.ts`, `stateTransitions.ts`, `generate-outreach`, `agent-autonomous-cycle` e ogni punto che oggi assume stati non canonici.

4. Hardening osservabile
- Aggiungere logging esplicito su:
  - cadence violation;
  - transizioni proposte/applicate;
  - sequence step creati;
  - reason codes per blocchi WA/LI AI extraction.
- Così il prossimo audit non dipende da supposizioni o summary falsi.

5. Verifica finale obbligatoria
- Test puntuali delle 5 funzioni backend coinvolte.
- Verifica del contenuto reale dei ZIP correnti.
- Verifica end-to-end:
  - WA/LI learnDom e mapping Optimus;
  - `generate-outreach` che blocca con 422 quando viola cadenza;
  - `agent-autonomous-cycle` che crea task `state_transition` e `sequence_step`;
  - `agent-execute` che li gestisce davvero.

Risultato atteso:
- eliminiamo il falso “0 fix applicati” distinguendo codice presente vs runtime reale;
- REPAIR-J resta attivo anche a runtime;
- REPAIR-K smette di essere nominalmente presente ma semanticamente incompatibile con gli stati del CRM;
- download estensioni, backend e agent loop tornano coerenti tra loro.
