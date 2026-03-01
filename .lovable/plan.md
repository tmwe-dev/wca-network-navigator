

## Piano: Sistema di Livelli di Qualità per la Generazione Email

### Concetto
Tre livelli di qualità che controllano **cosa viene incluso nel prompt** e **quale modello viene usato**, riducendo drasticamente i token per le email di routine.

### I 3 Livelli

| Livello | Modello | Sales KB | Profilo partner | Docs/Links | Token input stimati | Costo stimato |
|---|---|---|---|---|---|---|
| **Rapida** | `gemini-2.5-flash-lite` | Solo sez. 1+5 (~500 parole) | Solo dati base (nome, paese, network) | No | ~2.000 | ~3 crediti |
| **Standard** | `gemini-3-flash-preview` | Sez. 1-8 (~3.000 parole) | Dati base + descrizione + servizi | Solo se presenti | ~6.000 | ~8 crediti |
| **Premium** | `gemini-3-flash-preview` | Tutte le 14 sezioni (~7.000 parole) | Tutto + raw_profile_markdown + LinkedIn | Si, con scraping Firecrawl | ~12.000-18.000 | ~15-20 crediti |

### Modifiche tecniche

**1. Edge Function `generate-email/index.ts`**
- Nuovo parametro `quality`: `"fast"` | `"standard"` | `"premium"` (default: `"standard"`)
- Funzione `getKBSlice(fullKB, quality)` che estrae solo le sezioni rilevanti
- Selezione modello in base al livello
- Troncamento profilo partner (0/800/1500 chars) in base al livello
- Skip Firecrawl e documenti per livello "fast"

**2. Hook `useEmailGenerator.ts`**
- Aggiungere `quality` al tipo parametri di `generate()`

**3. UI — `EmailCanvas.tsx` e `Workspace.tsx`**
- Selettore a 3 opzioni (icone: Zap/Sparkles/Crown) accanto al bottone "Genera"
- Per la generazione batch in Workspace, il livello si applica a tutte le email della sessione
- Mostrare il costo stimato per livello

**4. Sales KB `salesKnowledgeBase.ts`**
- Aggiungere commenti marcatori `<!-- SECTION:N -->` tra le sezioni per permettere il parsing programmatico nella edge function

### File da modificare
1. `src/data/salesKnowledgeBase.ts` — aggiungere marcatori sezione
2. `supabase/functions/generate-email/index.ts` — logica quality tiers
3. `src/hooks/useEmailGenerator.ts` — parametro quality
4. `src/components/workspace/EmailCanvas.tsx` — selettore qualità singola email
5. `src/pages/Workspace.tsx` — selettore qualità batch

