# Conversazione AI Command — Fix sintesi multi-turno

## Cosa è successo nel test dell'utente

```
T1  Utente:    "trova la transport management"
T1  Sistema:   fast-lane → kb_entries (5 voci trovate) ✅
            → salva queryContext { table: kb_entries, filters: [...], ttl 5min }

T2  Utente:    "Cosa dice la knowledge base di transport management in sintesi"
T2  Sistema:   ❌ matcha 'kb' come domain noun → fast-lane di nuovo
            → query DB con contextHint che eredita i filtri del T1
            → planner aggiunge ulteriori filtri restrittivi → 0 righe
            → "Non ho trovato voci KB" + "Riprova senza l'ultimo filtro"
```

L'utente non voleva una nuova query: voleva una **sintesi conversazionale** dei 5 risultati appena ottenuti. Il router non distingue "sintetizza/spiega ciò che hai già" da "ricerca questo nel DB".

## Cause radice

1. **Intent di sintesi non riconosciuto.** `looksLikeSimpleQuery` instrada al fast-lane qualsiasi prompt che contenga un domain-noun (`kb`, `partner`, ecc.), anche quando il verbo è `dice/sintesi/spiega/riassumi`. `ANALYSIS_KEYWORDS` in `localResultFormatter` esiste ma viene consultato **dopo** la query, non prima del routing.
2. **Contesto come "shape DB", non come "risultato".** `queryContext` salva solo tabella+filtri della query precedente, non le righe restituite. Non c'è modo di rispondere "in base ai 5 record che ti ho appena mostrato" senza re-interrogare.
3. **Eredità troppo aggressiva del contextHint.** Anche quando l'utente cambia argomento o intento, il planner riceve "EREDITA i filtri del turno precedente" e produce query iper-restrittive.

## Piano (UI/orchestrazione, nessuna modifica DB/edge)

### Step 1 — Detector "intent di sintesi/analisi" pre-routing
File: `src/v2/ui/pages/command/lib/intentDetector.ts` (nuovo, ~40 righe).
- Esporta `isSynthesisIntent(prompt)` con regex unificata (riassumi, sintesi/sintetizza, in sintesi, in breve, spiega, dice, cosa contiene, cosa c'è, di cosa parla, riassunto, summary, tldr, in sostanza).
- Riusa `ANALYSIS_KEYWORDS` di `localResultFormatter` come base, ampliato.

### Step 2 — Salvare snapshot risultati nel queryContext
File: `src/v2/ui/pages/command/lib/queryContext.ts`.
- Estendere `QueryContext` con:
  - `lastResultRows?: ReadonlyArray<Record<string, unknown>>` (max 20 righe, già troncate)
  - `lastResultTitle?: string`
- Nuovo helper `buildContextWithRows(plan, rows)` usato da `useQueryContext.updateQueryContextFromLastPlan`.
- Nessun cambio TTL (resta 5 min).

### Step 3 — Branch "synthesis" in useCommandSubmit
File: `src/v2/ui/pages/command/hooks/useCommandSubmit.ts`.
- All'ingresso di `sendMessage`, **prima** del check fast-lane:
  - Se `isSynthesisIntent(text)` AND `queryContext` fresco AND ha `lastResultRows`:
    - Saltare DB. Costruire un prompt al modello del tipo:  
      `"L'utente chiede una sintesi. Ecco le {N} voci recuperate al turno precedente da {table}: {JSON troncato}. Rispondi in modo conciso, in italiano, con bullet point se utile."`
    - Riusare `commentOnResult` (o un nuovo `synthesizeRows`) per generare la risposta via `useResultCommentary`.
    - Non aggiornare il queryContext (resta valido per altre follow-up).
- Mostrare in UI uno step audit `synthesis · ai-comment` invece di `Ricerca AI · 0`.

### Step 4 — Disinnescare l'eredità filtri quando l'intent cambia
File: `src/v2/ui/pages/command/hooks/useCommandSubmit.ts` + `lib/queryContext.ts`.
- `buildContextHint(ctx, currentPrompt)` accetta il prompt corrente.
- Se il prompt contiene un nome proprio nuovo, un'altra entità di dominio diversa, o un verbo di sintesi → ritorna stringa vuota (no eredita).
- `isElliptical` resta come trigger fast-lane solo se l'intent NON è sintesi.

### Step 5 — UI: messaggio "0 risultati" più onesto
File: `src/v2/ui/pages/command/lib/localResultFormatter.ts`.
- Quando count=0 e `queryContext` aveva risultati al turno precedente, mostrare anche l'azione  
  `💬 Sintetizza i risultati precedenti` → invia il prompt `"riassumi i {word} del turno precedente"`.

## Sezione tecnica

- Nessuna chiamata edge function aggiuntiva: la sintesi riusa `useResultCommentary` (già wrappa `aiAssistant`/commentary).
- Limite hard: max 20 righe e max 8KB JSON nello snapshot per non gonfiare il context window.
- Audit trace: nuovo phase `synthesis` in `startTrace`, driver `ai-comment`.
- Test:
  - `intentDetector.test.ts`: 6 casi (sintesi vs query vs ellittica).
  - Aggiornare `useCommandSubmit` test esistenti con caso "T1 query → T2 sintesi non rifa DB".
- Hard guards e RLS invariati.

## Cosa NON cambia

- Nessuna modifica a edge function `ai-assistant`/`agent-execute`.
- Nessuna modifica RLS, nessuna nuova tabella.
- I 17 network WCA, BCA, outreach: nessun impatto.
- Memoria progetto (queryKeys, DAL, AI Invocation Charter): rispettata.

## Risultato atteso sul caso utente

```
T1  "trova la transport management" → 5 voci KB ✅ (uguale)
T2  "Cosa dice la KB di transport management in sintesi"
    → branch synthesis: AI legge le 5 voci snapshot e risponde con un riassunto
      ("La KB descrive Transport Management come... 3 punti chiave: ...")
    → niente più "Non ho trovato voci KB"
T3  "scrivi a chi ha aperto le ultime email" → torna al planner normale
```
