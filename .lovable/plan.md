## Obiettivo
Rendere il Co-pilot leggibile: "Modifica proposta" e "Chat" affiancate in due colonne dentro lo stesso pannello, con scivolamento automatico quando la sidebar sinistra si riduce. Aggiungere il diff visivo nelle proposte salvate.

## Cambiamenti UI

### 1. `PromptCopilotPanel.tsx` — layout interno orizzontale

Oggi: verticale (proposta sopra ~45%, chat sotto).
Nuovo: due colonne affiancate sotto l'header.

```text
┌─────────────────────────────────────────────────────────┐
│ HEADER (Blocco/Globale + selettore)                      │
├─────────────────────────┬───────────────────────────────┤
│  MODIFICA PROPOSTA      │  CHAT                          │
│  - rationale            │  - bubbles                     │
│  - diff before/after    │  - input + send                │
│  - risks/assumptions    │  - allega KB                   │
│  - bottoni Salva/Scarta │                                │
│  (50%)                  │  (50%)                         │
└─────────────────────────┴───────────────────────────────┘
```

Regole:
- Sotto 1024px di larghezza pannello: torna verticale (proposta sopra, chat sotto) per non comprimere troppo.
- Stato `expanded` (Maximize2 esistente) resta: in expanded le due colonne occupano tutta l'altezza disponibile.
- ScrollArea indipendente per ciascuna colonna.

### 2. `PromptReaderPage.tsx` — scivolamento alla compressione sidebar

Oggi: SwapPanels mostra Reader/Co-pilot in due pannelli a 50/50.
Nuovo: quando l'utente collassa la sidebar agenti/blocchi (controllo già esistente in pagina), il pannello Co-pilot riceve più larghezza e attiva automaticamente il layout a 2 colonne interno.

Tecnicamente:
- Ascoltare la larghezza del container del Co-pilot via `ResizeObserver`.
- Passare prop `compactWidth: boolean` a `PromptCopilotPanel` che decide colonne vs righe.
- Animazione 200ms (coerente con SwapPanels esistente).

### 3. Diff visivo nelle proposte (UX, non logica)

In `PromptCopilotPanel.savePromptProposal()`:
- Calcolare `diff_text` lato client con un diff semplice riga-per-riga (libreria `diff` già usata altrove o utility minima inline).
- Passarlo a `createPromptChangeProposal({ diff_text })`.

In `ProposalsReviewPage.tsx` (la pagina dove approvi):
- Render del diff con righe rosse/verdi, già supportato da `diff_text` nel record.

### 4. Anche dentro il Co-pilot: mostra diff nella colonna "Modifica proposta"
Oggi mostra solo `proposed_content` come blob unico. Aggiungere sopra (o in tab) un mini-diff before/after così vedi subito **cosa cambia** rispetto a `currentContent`, senza dover rileggere parola per parola.

## File toccati

| File | Modifica |
|---|---|
| `src/v2/ui/pages/prompt-lab/PromptCopilotPanel.tsx` | Layout 2 colonne responsive + render diff |
| `src/v2/ui/pages/prompt-lab/PromptReaderPage.tsx` | ResizeObserver → prop `compactWidth` |
| `src/v2/ui/pages/prompt-lab/ProposalsReviewPage.tsx` | Render `diff_text` se presente |
| `src/lib/textDiff.ts` (nuovo) | Utility `computeLineDiff(before, after)` minimale |

## Cosa NON cambio
- Logica edge function `prompt-copilot-chat` (resta intatta).
- Persistenza/RLS di `prompt_change_proposals` (campo `diff_text` già esiste).
- Sidebar agenti, lista blocchi, SwapPanels (drag&drop resta).
- KB consultate (27 va benissimo, rimosso dall'audit).

## Verifica
1. Apertura `/v2/prompt-reader` con sidebar aperta → Co-pilot resta verticale (poco spazio).
2. Collasso sidebar → Co-pilot scivola, attiva 2 colonne in 200ms.
3. Maximize Co-pilot → 2 colonne occupano tutta la pagina.
4. Generazione nuova proposta → colonna sinistra mostra diff before/after evidenziato.
5. Salvataggio proposta → record DB ha `diff_text` valorizzato.
6. `/v2/prompt-lab/proposals` → review mostra diff.

## Nessun rischio su nodi critici
Solo presentation (UI + utility diff client-side). Nessun tocco a edge function AI, RLS, auth, journalistReview, soft-delete.
