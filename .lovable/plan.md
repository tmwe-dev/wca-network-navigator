## Obiettivo

Quando chiedi di scrivere una mail "amichevole, come vecchi compagni di scuola" ai partner di Malta, il Canvas deve mostrare **9 bozze pre-personalizzate sfogliabili** (una per partner). Quando dici "rifai più amichevole", la bozza visibile nel Canvas deve aggiornarsi **in-place** con il nuovo tono — senza ripartire da zero, senza perdere il contesto Malta, senza ritornare "0 partner trovati".

## Cosa NON tocco

- `CommandPage.tsx` (layout, voce, sidebar, FloatingDock, briefing). 
- `useCommandSubmit`, `useCommandState` (orchestrazione conversazione).
- Edge function `generate-email` (la pipeline ufficiale resta quella che è).
- `compose-email` come tool ID e i suoi label/governance.

Tutti i fix sono **interni** ai file di logica del tool e al Canvas Composer.

## Diagnosi dei 3 bug attuali

1. **Canvas mostra 1 sola bozza** invece di 9 → `composeEmail.ts` (ramo country-wide) chiama `generate-email` 1 volta su un partner-campione e mostra la lista degli altri 8 come testo nel dossier.
2. **"Non vedo le nuove versioni" dopo "rifai amichevole"** → `ComposerCanvas` usa `useState(initializer)` per montare i valori iniziali (riga 47-56). L'initializer **non rigira mai** quando arrivano nuovi `initialSubject`/`initialBody` da un secondo turno: il Canvas resta inchiodato al primo testo.
3. **"0 partner trovati" al 3° turno** → al messaggio "fammele vedere nel canvas", il match di compose-email triggera ma `detectCountryCode` non vede "Malta" e `extractPersonAndCompany` non trova azienda → cade nel ramo "single partner" → 0 risultati. Il tool **non eredita il contesto** del turno precedente (paese + lista partner).
4. **Tono sempre "professionale"** → `oracle_tone: "professionale"` è hardcoded sia in `composeEmail.ts` (riga 220, 367) sia in `ComposerCanvas.handleGenerate` (riga 79). Il tono richiesto dall'utente nel `goal` non viene mai estratto né passato come parametro.

## Cosa cambio

### 1. Tono dinamico estratto dal prompt utente

Nuovo modulo `src/v2/ui/pages/command/lib/toneDetector.ts`:
- Funzione `detectTone(prompt: string): "amichevole" | "professionale" | "diretto" | "informale"`.
- Pattern: "amichevole / vecchi compagni / informale / colloquiale / scuola / familiare" → `amichevole`; "diretto / breve / no fronzoli" → `diretto`; default `professionale`.
- 6 unit test (vitest).

Userò `detectTone(prompt)` in `composeEmail.ts` e in `ComposerCanvas.handleGenerate` al posto del valore hardcoded.

### 2. Bozze multiple pre-personalizzate (ramo country-wide)

In `composeEmail.ts`, ramo `if (country && isCountryWideIntent(prompt))`:

- Generare **9 bozze in parallelo** con `Promise.allSettled` su `generate-email` (cap a 10 per tutela costi, già rispetta i guard).
- Ogni bozza con `partner_id` reale e `recipient_name` reale (primo `partner_contacts` con email del partner).
- Aggiungere al risultato `composer` un nuovo campo `drafts: Draft[]` (vedi sotto in "Dettagli tecnici"). La bozza visibile inizialmente resta `initialSubject/initialBody` (= prima bozza dell'array).

### 3. Canvas sfogliabile

In `ComposerCanvas.tsx`:

- Nuovo prop opzionale `drafts?: ReadonlyArray<{ partnerId, partnerName, contactName, contactEmail, subject, body }>`.
- Se `drafts.length > 1`: header del composer mostra `‹ 1/9 ›` con frecce + nome azienda corrente. Cliccando la freccia, cambia `recipients/subject/body` con la bozza selezionata.
- Bottone "**Rigenera tutte**" oltre al "Genera con AI": rifà l'array intero col nuovo tono (vedi punto 4).
- Bottone "**Invia tutte (9)**" se `drafts.length > 1` → trasforma le bozze in una mini-campagna (riusa `enqueueOutreach` esistente in `src/v2/io/supabase/mutations/outreach-queue.ts`), oppure invia 1 a 1 in loop con `send-email` se l'utente preferisce; resta dietro `ApprovalPanel` come oggi.

### 4. FIX BLOCCANTE: sync `initialSubject/initialBody` quando arrivano nuovi valori

In `ComposerCanvas.tsx`:

- Sostituire l'`useState(() => ...)` iniziale con un `useEffect([initialSubject, initialBody, drafts])` che scrive i nuovi valori nel composer **ogni volta che cambiano**.
- Senza questo fix, qualunque rigenerazione resta invisibile nel Canvas.

### 5. Contesto conversazionale per compose-email

Estendere `useCommandState` con un piccolo store `lastComposerContext: { country?, partnerIds?, tone? } | null` (analogo a `queryContext` già esistente). 

In `composeEmail.ts`:
- Se il prompt non contiene paese/azienda MA il `lastComposerContext` è fresco (TTL 5 min, riusa la stessa logica di `queryContext`), **eredita** `country.code` e `partnerIds` per rigenerare le 9 bozze col nuovo tono.
- Se l'utente dice "rifai amichevole / più breve / più formale", il tool detecta il tono nuovo e rigenera le 9 bozze sui partner ereditati invece di tornare 0 risultati.

In `ComposerCanvas.handleGenerate`:
- Se ci sono `drafts` con più di un elemento, rigenera tutte e 9 le bozze in parallelo con il nuovo tono detectato dal `promptHint` aggiornato (oppure da un piccolo input "tono" già nella toolbar — opzionale, posso ometterlo per semplicità).

### 6. Messaggio del Direttore corretto

In `useToolExecution.ts` (ramo `if (result.kind === "composer" && result.dossier)`), se `drafts.length > 1` cambiare il messaggio Oracolo da "Bozza pronta nel composer" a:

> "9 bozze pronte nel canvas (sfoglia con le frecce). Tono: amichevole. Vuoi rivedere o invio?"

### 7. Test

- `composeEmail.test.ts`: country-wide → ritorna `drafts.length === N`; follow-up senza paese eredita contesto.
- `toneDetector.test.ts`: 6 casi (amichevole / vecchi compagni / breve / formale / default).
- `ComposerCanvas.test.tsx`: re-render con nuovi `initialSubject` aggiorna il body; navigazione frecce cambia bozza; `Rigenera tutte` chiama `generate-email` 9 volte.

## Dettagli tecnici (per i tecnici)

```ts
// composeEmail.ts — nuovo shape ToolResult composer
type ComposerDraft = Readonly<{
  partnerId: string;
  partnerName: string;
  contactName: string | null;
  contactEmail: string;
  subject: string;
  body: string;
  status: "ok" | "no_email" | "ai_error";
  errorMessage?: string;
}>;

interface ComposerToolResult {
  kind: "composer";
  // ...campi esistenti...
  drafts?: ReadonlyArray<ComposerDraft>; // NEW: solo per batch country-wide
  detectedTone: "amichevole" | "professionale" | "diretto" | "informale"; // NEW
}
```

```ts
// ComposerCanvas.tsx — fix critico
useEffect(() => {
  if (initialSubject) composer.setSubject(initialSubject);
  if (initialBody) composer.setBody(initialBody);
}, [initialSubject, initialBody]);

useEffect(() => {
  if (drafts && drafts[currentIndex]) {
    composer.setSubject(drafts[currentIndex].subject);
    composer.setBody(drafts[currentIndex].body);
    composer.clearRecipients();
    composer.addRecipient({
      email: drafts[currentIndex].contactEmail,
      name: drafts[currentIndex].contactName ?? drafts[currentIndex].partnerName,
    });
  }
}, [currentIndex, drafts]);
```

```ts
// useCommandState — nuovo store contesto
const [lastComposerContext, setLastComposerContext] = useState<{
  countryCode: string;
  partnerIds: string[];
  tone: string;
  ts: number;
} | null>(null);
// TTL: 5 min, riusa isContextFresh(...)
```

```ts
// composeEmail.ts — eredità contesto
if (!country && !company && !email) {
  const ctx = getLastComposerContext(); // singleton modulo come getLastSuccessfulQueryPlan
  if (ctx && isFresh(ctx)) {
    // Rigenera N bozze sugli stessi partnerIds con tone aggiornato
  }
}
```

## Files toccati

- `src/v2/ui/pages/command/tools/composeEmail.ts` (modifica ramo country-wide + ramo follow-up)
- `src/v2/ui/pages/command/canvas/ComposerCanvas.tsx` (frecce + sync useEffect + invio batch)
- `src/v2/ui/pages/command/lib/toneDetector.ts` (nuovo, ~40 righe)
- `src/v2/ui/pages/command/lib/composerContext.ts` (nuovo, store + helper, ~30 righe, stesso pattern di `aiQueryTool.getLastSuccessfulQueryPlan`)
- `src/v2/ui/pages/command/tools/types.ts` (estendere `ComposerToolResult` con `drafts` e `detectedTone`)
- `src/v2/ui/pages/command/hooks/useToolExecution.ts` (testo messaggio Oracolo se `drafts.length > 1`)
- 3 file di test sotto `src/v2/ui/pages/command/__tests__/`

Nessuna modifica a `CommandPage.tsx`, alla pipeline `generate-email`, all'auth, al DAL, ai prompt operativi del Prompt Lab. Zero impatti su altre pagine.

## Stima

~250 righe nuove, ~80 modificate. Una sola sessione di build, test verdi prima di consegnare.