
# Fix Chunk #0 "Risposta vuota" — Piano definitivo

## Diagnosi confermata (riletti i file)

`unified-assistant` → `ai-assistant` (scope `kb-supervisor`, `mode=conversational`):
- `selectFallbackModels` per `isConversational=true` ignora completamente `scope.model`/`scope.temperature` e forza la coppia `["google/gemini-2.5-flash", "openai/gpt-5-mini"]`. Buona notizia: il modello effettivo è già `gemini-2.5-flash`. Cattiva notizia: nessun `max_tokens`, nessuna `temperature`, e se il prompt esplode il modello restituisce stringa vuota → 200 OK ma `content=""` → l'analyzer lancia "risposta vuota".
- `aiCallHandler.makeAiCall` accetta già `temperature`/`max_tokens` ma `callAiWithFallback` non li propaga.
- Sul lato frontend: `gapsText` usa `slice(0, 500)` per gap × cap 20 = ~10 KB solo per i gap, + `entitiesList` cap 30, + `factsTop` cap 15, + KB injection (`buildHarmonizerKbContext`) variabile (5–10 KB). Su chunk #0 (Doctrine/Foundation) la KB injection è molto ricca → totale ~25–30 KB → `gemini-2.5-flash` saltuariamente restituisce body vuoto.

## I 5 fix (senza creare nuovi pattern, solo aggiunte minime)

### 1. `supabase/functions/_shared/scopeConfigs.ts`
Aggiungo a `case "kb-supervisor"`:
```ts
model: "google/gemini-2.5-flash",
temperature: 0.2,
```
(così è esplicito anche per chiamate non conversational, ma soprattutto serve come fonte di verità).

### 2. `supabase/functions/ai-assistant/aiCallHandler.ts`
- `callAiWithFallback`: leggere `scope.temperature` e `scope.max_tokens` da `getScopeConfig(scope)`. Se `scope === "kb-supervisor"` → forzare `max_tokens: 8000` di default.
- Propagare `temperature` e `max_tokens` a `makeAiCall` per ogni tentativo della catena di fallback.
- `makeAiCall`: dopo il parse JSON, se `data.choices?.[0]?.message?.content` è una stringa vuota / null → restituire `{ ok: false, status: 599, errorText: "empty_content" }` così la catena di fallback prova il modello successivo invece di restituire silenziosamente `content=""`.
- Aggiungere log `console.log("[AI]", { model, scope, systemChars, userChars, totalChars, max_tokens })` prima del `fetch`.

### 3. `src/v2/ui/pages/prompt-lab/harmonizer/harmonizerLibraryAnalyzer.ts`
- Ridurre i cap nel prompt:
  - `factsTop`: 15 → 10
  - `conflictsList`: 10 → 5
  - `entitiesList`: 30 → 15
  - aggiornare le label dei titoli sezione (`top 30/20/50`) coerentemente.
- **Compressione adattiva `gapsText`**: budget di 12 000 caratteri totale per la sezione gap. Allocazione = `floor(12000 / cap.length)` per gap; il `desired.content` viene troncato dinamicamente a `max(150, allocPerGap - 250)` invece del fisso `slice(0, 500)`.
- **`callWithRetry` a 3 livelli**:
  1. Full prompt + KB context.
  2. Empty → retry senza KB context (`TMWE_INGESTION_BRIEFING` da solo).
  3. Ancora empty → riprovare con `gapsText` ricompresso a budget `6000` (50 %) e senza KB.
- Tutti i livelli loggano `[libraryAnalyzer] retry level=N reason=empty`.

### 4. `src/v2/ui/pages/prompt-lab/harmonizer/useHarmonizerLibraryIngestion.ts`
`bootstrapEntitiesFromDb`:
- Limitare il risultato a 80 record totali (top 80 per `created_at` desc se disponibile, altrimenti `slice(0, 80)` dopo il filter).
- Il limite riduce il payload `bootstrap_entities` salvato in `harmonizer_sessions` e quindi il body `session.entities_created` che il prompt costruisce.

### 5. Deploy
Ridepoyare `unified-assistant` e `ai-assistant` dopo gli edit.

## Cosa NON tocco
- Nessuna modifica a `harmonizerLibraryCollector.ts`, `tmweChunks.ts`, `tmwe-ingestion-briefing`, `harmonizerKbInjector`. La parte di parsing/scoping è già corretta.
- Nessuna modifica al test esistente (`harmonizeCollector.test.ts`) perché il placeholder detector è ortogonale a questo fix.

## Verifica post-deploy
1. Guardare i log di `ai-assistant` cercando `[AI]` con `totalChars`. Atteso < 18 000 per chunk #0 dopo i fix (vs ~30 000 attuali).
2. Rilanciare "Armonizza tutto → Ingestione documento grande" sul file reale.
3. In caso di empty residuo: il log mostrerà `retry level=2` o `level=3`; se anche il livello 3 fallisce → è un vero rate limit / outage AI gateway, non più un problema di prompt size.

Confermi e procedo?
