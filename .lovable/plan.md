

## Diagnosi del percorso reale (dal network log appena registrato)

Domanda utente: *"senti quanti parlano abbiamo in Spagna e in Francia"*

Sequenza misurata sui timestamp delle network requests:

```text
17:27:38  utente invia
17:27:42  POST ai-assistant (mode=plan-execution)        → 4.1s
          risposta: 1 step ai-query, params={query:"Seleziona il numero..."}
17:27:46  POST ai-query-planner                          → ~1s
          risposta: { table:"partners", filters:[country_code in (ES,FR)], limit:1 }
17:27:47  GET  /partners?select=country_code&...&limit=1 → 0.3s (DB)
          count=383, sample 1 riga
17:27:53  POST ai-assistant (mode=tool-result-comment)   → 6s
          risposta: messaggio finale + spokenSummary + suggestedActions
17:27:59  POST tts (sintesi vocale)                      → 1-2s
~17:28:00 messaggio mostrato in chat
```

**Tempo totale ≈ 22 secondi**, di cui:
- 4.1s plan-execution (LLM)
- 1.0s query-planner (LLM)
- 0.3s query DB reale
- 6.0s commento finale (LLM)
- 1-2s TTS

Il DB ci mette **300ms su 22s totali**. Il resto è tutto LLM in serie.

### Cosa sta succedendo davvero

1. **Fast lane non scattata.** La domanda era una read-only banale ("quanti partner in ES+FR"), ma è passata comunque dal `plan-execution` (Atto 1 della scorsa sessione). La normalizzazione lessicale ha lasciato "parlano" → l'euristica fast-lane non ha riconosciuto "partner" → fallback su pipeline lenta.
2. **Doppio LLM su una query banale.** plan-execution + query-planner = 5s solo per decidere che dobbiamo fare `SELECT count(id) WHERE country_code IN (ES,FR)`.
3. **Commento finale ancora da LLM (6s)** anche per un risultato che è "1 numero".
4. **Plan ridondante.** plan-execution genera `params:{query:"Seleziona il numero..."}` poi il query-planner riparte da zero: due AI fanno la stessa cosa.
5. **STT typo non gestito**: "parlano" → "partner". Il normalizer attuale non copre questo caso.
6. **Bug minore nel planner**: ha messo `limit:1` su una query di conteggio (vede 1 sola riga, ma il count Postgrest restituisce comunque 383 dall'header).

### Anche un altro spreco
Le chiamate `GET /profiles?select=id&limit=1` ogni 30s sono heartbeat, non c'entrano con la lentezza percepita ma popolano il network log.

## Strategia: 3 interventi mirati

Obiettivo: query semplici read-only sotto i **3 secondi** end-to-end.

### Intervento 1 — Fast lane più aggressiva e robusta

File: `src/v2/ui/pages/command/hooks/useCommandSubmit.ts`

- Estendere `lexicalNormalizer.ts`:
  - "parlano / partnar / parnter / partn" → "partner"
  - "spagnoli / francesi" → mantenuti ma il planner sa già che sono nazionalità
- Cambiare il detector fast-lane:
  - **prima** prova a riconoscere come `ai-query` qualunque prompt che contenga: "quant*", "mostr*", "elenc*", "trov*", "lista", "cerca", + un sostantivo del dominio (partner, contatto, attivit*, email, agente, biglietto, campagna, prospect)
  - se match → salta plan-execution → vai diretto a `aiQueryTool`
- Effetto: **−4s** (eliminata 1 chiamata LLM)

### Intervento 2 — Commento locale per query semplici (skip ultimo LLM)

File: `src/v2/ui/pages/command/tools/aiQueryTool.ts` + nuovo `src/v2/ui/pages/command/lib/localResultFormatter.ts`

- Quando il risultato è:
  - count puro (1 numero) → "Abbiamo X partner in [paesi]" + 3 suggested actions standard locali
  - lista corta (<5 righe) → riepilogo template
- L'AI commenter (mode=tool-result-comment) viene chiamata **solo** se:
  - risultato complesso (>5 righe), oppure
  - utente ha disattivato "fast mode", oppure
  - il prompt richiede analisi ("analizza", "spiegami", "perché")
- Le suggested actions semplici sono pre-compilate da template locali parametrizzati sui filtri del query plan (es. paesi, città presenti).
- Effetto: **−6s** sulle query semplici (eliminata seconda chiamata LLM)

### Intervento 3 — Telemetria visibile dei tool/step (chiesta dall'utente)

File: nuovo `src/v2/ui/pages/command/lib/toolTrace.ts` + integrazione nel `MessageList.tsx` o nel pannello "Step"

- Ogni invocazione registra: `{ step, tool, model?, durationMs, source: "fast-lane"|"planner"|"comment" }`
- Salvataggio in stato locale + log su `console.info("[command-trace]", trace)` in dev
- Esposizione opzionale in UI: pannello collassabile sotto la risposta del Direttore tipo:
  ```
  ⚡ 1.8s • fast-lane → ai-query (DB: 280ms) → local-comment
  ```
- In modalità "trace verbose" mostra anche modello LLM, token count se disponibile, payload sintetico.
- Persistenza opzionale (futura): tabella `command_traces` per audit. Per ora solo client-side.

### Bonus rapido (5 minuti)

- `ai-query-planner`: per query di conteggio (rilevate dal prompt: "quanti", "totale", "numero di") → forzare `limit: null` e `columns: ["id"]`, evitando l'orderby `rating.desc` che oggi spreca un index scan inutile.
- `useCommandSubmit.ts`: chiamata TTS in **parallelo** con il render del messaggio invece che dopo (oggi i 1-2s di TTS si percepiscono perché la spunta finale del messaggio ritarda).

## Verifica post-intervento

1. "quanti partner abbiamo in Spagna e Francia?" → ≤ 3s (target 2.5s)
2. "e a Madrid?" → ≤ 2.5s (segue la fast lane + context)
3. "parlano in Spagna" (typo STT) → riconosciuto come "partner in Spagna"
4. "analizzami il portafoglio USA" → ancora 2-3 hop AI (giusto, è analisi)
5. Pannello trace mostra: step / tool / durata per ogni messaggio
6. Console log: `[command-trace] { steps: [{tool:"ai-query", ms:280}, ...], totalMs: 2400 }`

## File toccati (sintesi)

| # | File | Cambiamento |
|---|---|---|
| 1 | `src/v2/ui/pages/command/lib/lexicalNormalizer.ts` | +typo "parlano/partnar/parnter" |
| 2 | `src/v2/ui/pages/command/hooks/useCommandSubmit.ts` | fast-lane robusta + TTS parallelo |
| 3 | `src/v2/ui/pages/command/tools/aiQueryTool.ts` | branch local-comment per risultati semplici |
| 4 | `src/v2/ui/pages/command/lib/localResultFormatter.ts` | **nuovo** — template count/lista corta |
| 5 | `src/v2/ui/pages/command/lib/toolTrace.ts` | **nuovo** — tracciamento tool + durata |
| 6 | `src/v2/ui/pages/command/components/MessageList.tsx` (o equivalente) | pannello trace collassabile |
| 7 | `supabase/functions/ai-query-planner/index.ts` | count detection → no order, columns:[id] |

## Cosa NON tocco

- DB / RLS / schema partners
- Edge function `ai-assistant` (resta uguale, semplicemente la chiamiamo meno)
- TTS, auth, hard guards
- Le doctrine KB (intervento precedente)

