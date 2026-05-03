## Obiettivo

Replicare nel **ComposerCanvas** la stessa logica che già usi nel Command (badge "🔧 tools/fonti" sopra il messaggio): un banner orizzontale con le **tappe della pipeline mail**, sempre visibile sopra l'editor, così sai a colpo d'occhio quali controlli sono stati eseguiti per produrre la bozza.

## Cosa vedrai

Sopra "Destinatari/Oggetto/Corpo" compare una striscia compatta:

```text
Pipeline mail · 5 step · 2.34s
[✓ Oracolo] → [✓ Architetto KB·3] → [✓ Prompt Lab·2] → [✓ Giornalista] → [✓ Bozza pronta]
   partner       fonti consultate     prompt applicati     review            tono · modello
```

- Ogni chip è un **badge tracciabile**: stato (✓/⚠/✗), nome dello stadio, sottotitolo con dettaglio (es. "KB·3", "Prompt Lab·2", "Modello: gpt-5-mini", "Tono: professionale").
- Hover/click su un chip apre un mini-tooltip con i dettagli (lista prompt operativi applicati, sezioni KB consultate, eventuali warning di Oracolo/Giornalista).
- In modalità **batch** (es. 9 partner Malta) la stessa striscia mostra "9/9 bozze · Giornalista superato 9/9" con conteggi aggregati.
- In modalità **single** mostra le 5 tappe specifiche del partner corrente.

## Le 5 tappe rappresentate

| # | Stadio | Cosa mostra |
|---|--------|-------------|
| 1 | **Oracolo** (DB lookup) | Partner risolto, lead_status, holding pattern, blacklist guard |
| 2 | **Architetto** (KB + contesto) | N° sezioni KB consultate, playbook attivo |
| 3 | **Prompt Lab** | Lista prompt operativi applicati (versione) |
| 4 | **Giornalista** (review) | Editorial review eseguito (obbligatorio per email) |
| 5 | **Bozza** | Modello AI usato + tono detectato + lingua |

Stato per tappa: `ok` (verde), `warn` (ambra, es. partner senza email), `failed` (rosso, es. AI fail), `skipped` (grigio).

## Sezione tecnica (per chi smanetta)

### File toccati (solo UI/presentation, niente business logic nuova)

1. **Nuovo componente** `src/v2/ui/pages/command/canvas/EmailPipelineBadge.tsx`
   - Riceve un prop tipato `pipeline: EmailPipelineStage[]` con `{ id, label, status, detail?, tooltip? }`.
   - Render orizzontale con chip + freccia, responsive (wrap su mobile), usa solo design tokens (`bg-success/10`, `text-warning`, ecc.).

2. **Estensione tipi** `src/v2/ui/pages/command/tools/types.ts`
   - Aggiungo `pipeline?: ReadonlyArray<EmailPipelineStage>` al tipo `ComposerResult` e a `ComposerDraft` (per il batch).

3. **Popolamento pipeline** `src/v2/ui/pages/command/tools/composeEmail.ts`
   - Sia in `executeSingle` (riga ~722-841) sia in `generateOneDraft`/`buildBatchComposerResult` (riga ~201-360) costruisco l'array `pipeline` partendo dai dati che **già abbiamo**: `_context_summary` (kb_sections, operative_prompts_applied, model, playbook_active), guard rail Oracolo, esito generate-email, tono detectato. Nessuna chiamata extra al backend.
   - Per il Giornalista mappo l'esito già implicito in `generate-email` (se body ritornato → `ok`, se warning → `warn`).

4. **Render** `src/v2/ui/pages/command/canvas/ComposerCanvas.tsx`
   - Aggiungo `pipeline?: EmailPipelineStage[]` alle props e monto `<EmailPipelineBadge>` in cima al pannello (sopra "Batch navigation header" se presente, altrimenti sopra "Destinatari").
   - In modalità batch sincronizzo i chip con `currentDraft.pipeline` quando si naviga tra le bozze (effetto già esistente).

5. **Wiring** `src/v2/ui/pages/command/components/CommandOutput.tsx` (o dove si renderizza `ComposerCanvas`)
   - Passo `pipeline={liveResult.pipeline}` / `currentDraft.pipeline`.

### Cosa NON tocco

- `generate-email` edge function (i dati arrivano già da `_context_summary`).
- `useEmailComposerV2`, governance, send pipeline.
- `MessageAuditPanel` (resta com'è per l'audit della query AI sopra; questo nuovo badge è specifico del *composer email*).
- Nessuna nuova chiamata di rete, nessun cambiamento DAL/DB.

### Stima

- 1 nuovo file (~120 righe), 3 file editati (~50 righe totali aggiunte).
- Zero migrazioni, zero modifiche backend.

## Conferma

Dimmi solo:
- "Vai" → procedo con l'implementazione esattamente come sopra.
- Oppure se vuoi **chip diversi** (es. aggiungere "Sherlock", "Enrichment Snapshot", "Compliance check") o cambiare l'**ordine**.
