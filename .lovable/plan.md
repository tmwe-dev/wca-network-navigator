## Obiettivo
Rendere la Command Page di nuovo affidabile: smalltalk, prompt AI, tool routing e fallback devono comportarsi in modo prevedibile senza rompere submit, memoria, TTS, planner, fast-lane e side-effect.

## Diagnosi preliminare
- Il caso che hai mostrato è riproducibile a livello codice: `"C'è qualcuno in ascolto"` viene intercettato da `detectSmalltalk()`, mentre `"c'è nessuno in ascolto"` e `"c'è nessuno"` non matchano il detector.
- Quando il detector non intercetta, il prompt scende al planner `planExecution`; il prompt non è un comando operativo, quindi l'edge `ai-assistant` può restituire `{ steps: [], summary: "Nessun piano possibile" }`.
- La Command Page mostra quel summary del modello come risposta utente, quindi sembra che “l’AI non funzioni”, anche se il problema immediato è routing conversazionale incompleto.
- Ho anche individuato un rischio di side-effect duplicato: nello smalltalk `useCommandSubmit` chiama `ttsSpeak()`, ma `CommandPage` ha già un effetto che legge ogni messaggio del `Direttore`; questo può causare doppia voce.

## Mappa impatto nodo critico
Nodo toccato: `src/v2/ui/pages/command/hooks/useCommandSubmit.ts` + `src/v2/ui/pages/command/lib/smalltalkDetector.ts`.

Cosa fa oggi:
```text
input utente
→ add user message + reset
→ detectSmalltalk(rawText)
  → se match: risposta Direttore, no planner
  → se no match: normalizzazione → composer → SuperMario opzionale → fast-lane → planExecution
→ se planner torna 0 step: mostra summary, incluso "Nessun piano possibile"
```

Cosa può rompersi se si interviene male:
- submit duplicati
- doppia persistenza messaggi
- doppia voce TTS
- comandi operativi erroneamente classificati come smalltalk
- fast-lane `ai-query` bypassata
- planner o approvazioni mutate senza necessità

## Piano di intervento minimo
1. **Correggere il detector smalltalk**
   - Ampliare solo i pattern di presenza/test microfono per includere:
     - `c'è nessuno`
     - `c'è nessuno in ascolto`
     - varianti con apostrofo/accènti/spazi: `ce nessuno`, `c e nessuno`, `c’è nessuno`
     - varianti già esistenti: `c'è qualcuno`, `mi senti`, `ci sei`, `prova`
   - Non trasformare query operative in smalltalk: niente match generici su parole come `partner`, `email`, `pipeline`, `audit`, `sistema`.

2. **Rimuovere il side-effect TTS duplicato**
   - Lasciare che sia solo `CommandPage` a parlare i messaggi del `Direttore`.
   - Eliminare la chiamata diretta `ttsSpeak(small.reply)` nel ramo smalltalk, così non ci sono due audio per la stessa risposta.

3. **Aggiungere una guardia finale conversazionale**
   - Nel ramo `plan.steps.length === 0`, prima di stampare `plan.summary`, ricontrollare il prompt con il detector smalltalk.
   - Serve come cintura di sicurezza se in futuro il flusso cambia o la normalizzazione modifica il testo.
   - Non cambia `ai-query`, composer, SuperMario, approvazioni o tool execution.

4. **Aggiungere test unitari mirati**
   - Nuovo test su `smalltalkDetector` per bloccare regressioni:
     - `C'è qualcuno in ascolto` → presence
     - `c'è nessuno in ascolto` → presence
     - `c'è nessuno` → presence
     - `mi senti?` → presence
     - `Mostrami i partner italiani senza email` → non smalltalk
     - `fai un audit completo del sistema` → non smalltalk
   - Test leggero, locale, senza DB, senza edge function.

5. **Audit operativo AI / tool / prompt**
   - Documentare nel risultato finale la catena effettiva:
     - smalltalk: `detectSmalltalk` → risposta locale
     - read query: `looksLikeSimpleQuery` → `aiQueryTool` → `planQuery` → safe executor
     - task complessi: `planExecution` → `ai-assistant` → `planRunner`
     - Super Mario: solo se flag `super_mario_enabled=true`
   - Evidenziare i prompt realmente coinvolti e i punti di fallback.

6. **Verifica finale**
   - Eseguire test selettivi sul detector.
   - Controllare che non ci siano nuovi side-effect duplicati:
     - submit OK
     - ordine messaggi OK
     - memoria/persistenza non duplicata
     - fallback OK
     - TTS non duplicato
     - planner non chiamato per smalltalk

## Cosa non farò
- Nessun refactor opportunistico della Command Page.
- Nessun cambio DB/RLS/auth.
- Nessuna modifica ai prompt commerciali o al Prompt Lab.
- Nessun cambio al comportamento di email, batch, deduplica, invii o pipeline.

## Risultato atteso
Le frasi di presenza tornano a rispondere subito con il Direttore, senza passare dal planner e senza mostrare `Nessun piano possibile`; i comandi veri continuano invece a usare fast-lane, planner e tool registry come oggi.