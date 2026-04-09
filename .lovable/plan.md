

# Piano: Auto-Apprendimento Stile Email dall'Editing Utente

## Concetto

Quando l'utente modifica un draft generato dall'AI e clicca "Invia", il sistema intercetta la differenza tra il testo originale AI e quello finale modificato. Un'analisi semantica rapida (via Edge Function) identifica i pattern di modifica (tono più informale, testo accorciato, struttura cambiata) e propone all'utente di salvare queste preferenze come memoria L1 → futura promozione a L2/L3.

Il tutto avviene con un **dialog di conferma pre-invio** — non blocca il flusso, l'utente può ignorarlo e inviare direttamente.

## Flusso

```text
AI genera draft → utente modifica → click "Invia"
  ↓
[isEditedAfterGeneration = true?]
  ↓ sì
Calcolo diff (% riduzione, cambi strutturali)
  ↓
Se diff significativo (>15% testo o >3 modifiche semantiche):
  → Mostra dialog "Apprendimento Stile"
    • Mostra: "Hai ridotto il testo del 30%", "Tono più informale"
    • Opzioni: [Salva preferenza] [Ignora e invia] [Invia senza salvare]
  ↓
Se [Salva]: chiama Edge Function → analisi semantica → salva in ai_memory L1
  ↓
Procedi con invio normale
```

## Dettaglio tecnico

### 1. Edge Function `analyze-email-edit` (nuova)

Riceve `{ original_html, edited_html, recipient_country, email_type }` e restituisce:
- `length_change_pct`: percentuale riduzione/aumento testo
- `tone_shift`: es. "formal→informal", "neutral→friendly"
- `structural_changes`: es. "removed_greeting", "simplified_cta", "shortened_paragraphs"
- `suggested_memory`: frase sintetica da salvare come memoria (es. "L'utente preferisce email brevi e informali per contatti italiani")
- `significance`: "low" | "medium" | "high"

Usa un modello leggero (gemini-2.5-flash-lite) per l'analisi — costo minimo per invio.

### 2. Dialog `EmailEditLearningDialog.tsx` (nuovo)

Appare **solo** quando `isEditedAfterGeneration = true` e la diff è significativa.
Mostra:
- Badge con le modifiche rilevate (es. "−30% testo", "Tono informale")
- Il suggerimento di memoria proposto dall'AI
- 3 pulsanti: **Salva e invia** / **Invia senza salvare** / **Annulla**

Se l'utente salva, inserisce in `ai_memory` con:
- `level: 1`, `tag: "style_preference"`, `source: "email_edit_learning"`
- `content`: la frase suggerita dall'AI
- `context_key`: tipo email + paese destinatario (per preferenze granulari)

### 3. Integrazione in `EmailComposer.tsx`

- `handleEnqueue` già ha accesso a `isEditedAfterGeneration`, `aiGeneratedBody`, `htmlBody`
- Prima di procedere con l'invio, se `isEditedAfterGeneration`:
  1. Chiama `analyze-email-edit`
  2. Se `significance >= "medium"`, mostra il dialog
  3. Dopo la scelta utente, procede con l'invio esistente

### 4. Consumo delle preferenze nel prompt AI

In `generate-email` Edge Function, le memorie con tag `style_preference` vengono iniettate nel prompt come regole addizionali, così l'AI genera direttamente nel tono preferito dall'utente.

## File coinvolti

| File | Azione |
|------|--------|
| `supabase/functions/analyze-email-edit/index.ts` | Nuova — analisi semantica diff via AI |
| `src/components/email/EmailEditLearningDialog.tsx` | Nuovo — dialog conferma apprendimento |
| `src/pages/EmailComposer.tsx` | Intercettare pre-invio, mostrare dialog se diff significativa |
| `supabase/functions/generate-email/index.ts` | Iniettare memorie `style_preference` nel prompt |

## Ordine di esecuzione

1. Creare Edge Function `analyze-email-edit`
2. Creare `EmailEditLearningDialog`
3. Integrare nel flusso di invio di EmailComposer
4. Aggiornare `generate-email` per consumare le preferenze salvate

