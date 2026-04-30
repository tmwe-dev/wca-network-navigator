## Principio guida

Spostare l'intelligenza **dal codice all'AI**. Nessuna regex deve interpretare cosa vuole l'utente: serve solo a istradare il prompt all'AI con il **contesto giusto**. L'AI legge contesto + cronologia + KB e decide. Il codice fornisce strumenti e formattazione standard, non interpretazione semantica.

Tre fix indipendenti, allineati a questo principio.

---

## Fix 1 — Eliminare `isRegenerateIntent` (regex) → contesto-aware AI routing

**Problema attuale**: `composeEmail.ts > match()` usa `isRegenerateIntent()`, una regex che cerca parole chiave fisse (`riscrivi`, `più breve`, `mostrameli`…). "Riduci a 4-5 righe", "compattali", "fammele più sintetiche" non matchano → il prompt cade nel router AI generico che non sa nulla del composer attivo → sceglie `ai-query` invece di rigenerare.

**Soluzione**:

1. **Rimuovo** `isRegenerateIntent` dalla regex match di `composeEmail.ts`. Resta solo il match per il primo trigger ("scrivi/componi una mail a…").
2. **Espongo il contesto attivo al router**: quando esiste `getLastComposerContext()` (TTL 5 min), `useCommandSubmit` aggiunge alla chiamata `decideToolFromPrompt` un campo `activeContext` che descrive lo stato vivo:
   ```json
   {
     "activeContext": {
       "type": "composer-batch",
       "toolId": "compose-email",
       "description": "C'è un batch di N bozze email per partner di Malta, tono professionale, generate 30 secondi fa. L'utente può chiedere modifiche (lunghezza, tono, contenuto) o riapertura del canvas.",
       "ttlSecondsLeft": 270
     }
   }
   ```
3. **Aggiorno il system prompt** di `ai-assistant` mode `tool-decision` (`supabase/functions/ai-assistant/`) con la regola:
   > "Se `activeContext` è presente e l'utente fa riferimento — anche implicito — a quel contesto (modifiche, rivisitazioni, riapertura, conferme, follow-up senza nuova entità nominata), scegli `activeContext.toolId`. Solo se l'utente cambia chiaramente argomento, scegli un altro tool."

   Esempi di addestramento nel prompt:
   - "riducimele" + composer attivo → `compose-email`
   - "4-5 righe massimo" + composer attivo → `compose-email`
   - "mostrameli" + composer attivo → `compose-email`
   - "quanti partner ho a Malta?" + composer attivo → `ai-query` (cambio chiaro)

4. **`composeEmail.execute()`**: quando viene invocato e c'è un `lastContext`, decide LUI in base al prompt + AI sub-call (modello fast, scope `compose-router`) se è un follow-up o una nuova richiesta. Dato che ormai il router principale ha già scelto `compose-email` *consapevolmente*, qui basta una semplice euristica leggera: se non c'è una nuova entità (azienda/email nuova) e c'è `lastContext`, è un follow-up.

**Risultato**: l'utente può scrivere in qualsiasi modo naturale; finché c'è un batch attivo, l'AI capisce che si parla di quello.

---

## Fix 2 — `MessageContent` con markdown standardizzato sempre

**Problema attuale**: `CommandThread.tsx` riga 88-94 fa solo `whitespace-pre-line` + parsing di `**bold**`. Niente heading, liste, separatori, tabelle. Quando l'AI restituisce 5 bozze formattate, escono come blob.

**Soluzione**: la libreria `react-markdown` + `remark-gfm` è **già installata** nel progetto.

1. **Nuovo componente** `src/v2/ui/pages/command/components/MessageContent.tsx`:
   - Usa `react-markdown` con plugin `remark-gfm` (tabelle, liste, separatori `---`).
   - **Whitelist tag custom** mappati al design system del Command (no colori HSL hard-coded, tutto via tokens `text-foreground`, `text-primary`, `text-muted-foreground`):
     - `h1/h2/h3` → titoli light, primary, dimensioni 14/13/12 px
     - `ul/ol` → liste con bullet primary, indent coerente
     - `code` inline → mono, bg `muted/30`, padding 0.5
     - `pre` → blocco mono con bg, scroll orizzontale
     - `blockquote` → border-left primary, italic muted
     - `hr` → separatore primary/20
     - `strong` → primary mono (mantenuto pattern attuale)
     - `a` → primary underline
     - `table` → border, header bg muted/30
   - **Sicurezza**: `react-markdown` non esegue HTML grezzo by default (no `rehype-raw`), quindi è XSS-safe.
2. **Aggiorno `CommandThread.tsx`** per usare `<MessageContent content={msg.content} />` invece dello split manuale.
3. **Aggiorno il system prompt di `ai-assistant`** (mode `default`, scope `command`): dichiara la grammatica di formattazione ufficiale e impone l'uso. Estratto:
   > "Quando rispondi presenti testi (bozze, riepiloghi, elenchi), usa SEMPRE markdown standard:
   > - `### Titolo` per intestazioni di sezione
   > - `- ` per elenchi puntati  
   > - `**testo**` per evidenziare termini chiave
   > - `---` per separare blocchi indipendenti (es. bozze multiple)
   > - blocco di codice triplo backtick per testi citati lunghi (es. corpo email)
   > 
   > Non incollare mai più di un testo lungo senza heading e separatore. Esempio bozze multiple:
   > ```
   > ### Bozza 1 — Acme Logistics
   > **Oggetto**: ...  
   > Corpo: ...
   > 
   > ---
   > 
   > ### Bozza 2 — Beta Cargo  
   > ...
   > ```"

**Risultato**: ogni risposta dell'AI è formattata in modo consistente, leggibile, sempre uguale. Niente blob, niente "a caso".

---

## Fix 3 — Conferma "OK / Annulla" sempre presente per write

**Problema attuale**: `live-approval` esiste come stato ma non è renderizzato in `CommandOutput.tsx` (manca branch JSX). Inoltre la decisione "serve conferma" è hand-coded in `useToolExecution.ts` solo per alcuni casi.

**Soluzione "ridondanza sicura"** (come hai scelto):

1. **Auto-approval per write tools** (guardrail di piattaforma, sempre):
   - `WRITE_TOOL_IDS` esiste già in `registry.ts` (è la lista `requiresApproval: true`).
   - In `useToolExecution.ts`, prima di `tool.execute()`, controllo `TOOL_METADATA[tool.id].requiresApproval`. Se sì: setto `liveResult` di tipo `approval` con summary del cosa sta per fare e attendo OK utente prima di procedere. **Questo già esiste parzialmente** — completo i casi mancanti e standardizzo.
2. **AI-driven approval esplicito**:
   - Aggiungo al `ToolResult` un kind `confirmation` opzionale che qualsiasi tool può restituire prima dell'azione finale.
   - L'AI può anche, nel suo `suggestedActions`, includere un'azione "Conferma" che apre `live-approval`.
3. **Renderizzo `live-approval` nel canvas** (branch JSX mancante):
   - In `CommandOutput.tsx` E `CommandCanvas.tsx` (i due componenti paralleli — antipattern già esistente, fuori scope rifondere) aggiungo:
     ```tsx
     {canvas === "live-approval" && liveResult?.kind === "approval" && (
       <ApprovalPanel
         title={liveResult.title}
         summary={liveResult.summary}
         details={liveResult.details}
         onApprove={() => onApprovalConfirm()}
         onReject={onClose}
       />
     )}
     ```
   - `ApprovalPanel` esiste già in `@/components/workspace/ApprovalPanel`.
4. **Tipo `ToolResult` esteso** (`tools/types.ts`) con il kind `approval`/`confirmation` se non già presente.

**Risultato**: ogni operazione di scrittura mostra OK/Annulla, sempre, anche se l'AI dimentica di chiederlo. L'AI può comunque richiederlo esplicitamente per azioni sensibili.

---

## File modificati

```text
src/v2/ui/pages/command/
├── components/
│   ├── CommandThread.tsx              [mod] usa MessageContent
│   ├── CommandOutput.tsx              [mod] branch live-approval
│   ├── CommandCanvas.tsx              [mod] branch live-approval
│   └── MessageContent.tsx             [new] markdown render standard
├── tools/
│   ├── composeEmail.ts                [mod] rimuove isRegenerateIntent dal match
│   ├── registry.ts                    [mod] passa activeContext al router
│   └── types.ts                       [mod] kind: "approval" se manca
├── lib/
│   └── composerContext.ts             [mod] expose summary per router (no più isRegenerateIntent)
├── hooks/
│   ├── useCommandSubmit.ts            [mod] include activeContext in resolveTool
│   └── useToolExecution.ts            [mod] auto-approval per WRITE_TOOL_IDS
└── (deprecato) — isRegenerateIntent rimossa, file aggiornato

src/v2/io/edge/aiAssistant.ts          [mod] decideToolFromPrompt accetta activeContext

supabase/functions/ai-assistant/
└── index.ts (o sub-file system prompt) [mod] regola activeContext + grammatica markdown
```

---

## Cosa NON faccio

- Non rifondo i due canvas paralleli (`CommandCanvas` vs `CommandOutput`): debito esistente, fuori scope.
- Non installo nuove librerie: `react-markdown` e `remark-gfm` sono già nel progetto.
- Non tocco la pipeline `generate-email` lato edge.
- Non aggiungo regex più larghe come fallback: l'unica via è AI con contesto. Niente compromessi.

---

## Verifica post-fix

1. "Scrivi mail ai partner di Malta" → composer canvas con N bozze.
2. **"Riducile a 4-5 righe"** → AI legge `activeContext`, sceglie `compose-email`, rigenera, canvas riappare con nuovi testi più brevi. **Senza che il codice sappia che "riduci" significa "più breve"**.
3. **"Compattale"**, **"più sintetiche"**, **"meno formali"**, **"un po' meno lunghe"** — tutte funzionano per lo stesso motivo.
4. Risposta AI con `### Bozza 1\n**Oggetto**: ...\n---\n### Bozza 2` → renderizzata con sezioni distinte, separatori, heading, sempre uguale.
5. Qualsiasi tool write (invio, modifica DB) → `ApprovalPanel` con OK/Annulla appare automaticamente, anche al 5° giro.
6. AI può anche dire esplicitamente "Confermi?" e si apre lo stesso pannello (ridondanza).

Confermi che procedo con i 3 fix in quest'ordine?
