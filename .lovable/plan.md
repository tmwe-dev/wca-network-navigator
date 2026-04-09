

# Piano: Oracolo Universale — Fix Layout, Contesto Reale, Campo Goal con Dettatura Vocale

## Problemi da risolvere

1. **Spazio nero sopra Opzioni AI**: ScrollArea con `flex-1` nel tab Tipi si espande oltre il contenuto
2. **Standalone mode cieco**: quando il Composer ha un destinatario con `partnerId` reale, non carica dati dal DB (history, enrichment, tipo interlocutore)
3. **Manca campo Goal libero**: l'utente vuole poter scrivere istruzioni specifiche ("ci siamo incontrati a Genova, parlato di pezzi di ricambio...") che guidino l'AI
4. **Manca dettatura vocale**: il campo goal deve supportare registrazione microfono con trascrizione automatica

## Modifiche

### 1. OraclePanel.tsx — Fix layout + Campo Goal con microfono

**Fix spazio nero**: Cambiare il tab Tipi da `flex-1` a dimensione naturale con overflow scroll solo se necessario.

**Nuovo campo Goal** sopra la lista tipi:
- Textarea con placeholder "Descrivi l'obiettivo o il contesto della comunicazione..."
- Pulsante microfono (🎙️) a destra per dettatura vocale
- Il goal viene passato a `onGenerate` insieme al tipo selezionato
- Se c'e' sia goal scritto che tipo selezionato, entrambi vengono iniettati nel prompt

**Dettatura vocale**: Usa la Web Speech API (`SpeechRecognition`) nativa del browser — zero costi, zero API key. Quando l'utente clicca il microfono:
- Inizia la registrazione continua
- Il testo trascritto si appende al campo goal in tempo reale
- Click di nuovo per fermare

**Aggiornare `OracleConfig`** per includere `customGoal: string`.

### 2. EmailComposer.tsx — Passare il customGoal + caricare partner reale

**Custom Goal**: `handleAIGenerate` usa `config.customGoal` come goal primario. Se presente sia customGoal che emailType.prompt, li combina: `"${emailType.prompt}\n\nISTRUZIONI SPECIFICHE: ${customGoal}"`.

**Partner reale in standalone**: Quando c'e' un solo destinatario con `partnerId` valido (non UUID generato):
- Passare `partner_id` nel payload a `generate-email`
- Rimuovere `standalone: true` per quel caso
- L'edge function carichera' partner reale, history, enrichment, guard

### 3. generate-email/index.ts — Supporto partner_id senza activity_id

Aggiungere una terza modalita' oltre "standalone" e "activity":
- Se `partner_id` e' presente e `standalone` e' true → caricare partner reale dal DB, contacts, history, enrichment
- Usare la stessa logica del mode "activity" ma senza richiedere un'attivita' CRM
- Questo unifica il ragionamento AI: dal Composer hai lo stesso contesto del Cockpit

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/email/OraclePanel.tsx` | Fix ScrollArea, aggiungere campo goal con textarea + microfono, aggiornare OracleConfig |
| `src/pages/EmailComposer.tsx` | Passare customGoal, usare partner_id reale quando disponibile |
| `supabase/functions/generate-email/index.ts` | Aggiungere mode "standalone con partner_id" per caricare dati reali |

## Ordine di esecuzione

1. Fix OraclePanel (layout + campo goal + microfono)
2. Aggiornare EmailComposer per passare customGoal e partner_id
3. Aggiornare Edge Function per supportare il nuovo mode

