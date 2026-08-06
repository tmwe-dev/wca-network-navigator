# Fonte autorevole unica per prompt, knowledge base e memoria

Fase 2 del piano di consolidamento. Scopo: eliminare l'ambiguità che rende
instabili le risposte degli agenti. Due domande uguali devono produrre lo
stesso comportamento, indipendentemente dal punto di ingresso.

## Mappa delle sorgenti oggi attive

| Sorgente                                     | Dove vive                                                                                        | Ruolo stabilito                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `operative_prompts` (database)               | letto da `src/data/operativePrompts.ts` e `supabase/functions/_shared/operativePromptsLoader.ts` | **Autorevole** per i prompt operativi                  |
| `agent_personas` (database)                  | `src/data/agentPersonas.ts`, `_shared/agentPersonaLoader.ts`                                     | **Autorevole** per persona e tono                      |
| `kb_entries` (database)                      | `src/data/kbEntries.ts`, `_shared/kbSlice.ts`, `_shared/kbCategoryMapper.ts`                     | **Autorevole** per la knowledge base                   |
| `ai_memory` (database)                       | `src/data/aiMemory.ts`                                                                           | **Autorevole** per la memoria                          |
| `src/v2/agent/prompts/core/*`                | codice frontend                                                                                  | **Fallback** se il database non risponde               |
| `src/constants/agentPromptsParts/*`          | codice frontend                                                                                  | **Fallback** legacy, in dismissione                    |
| `supabase/functions/_shared/prompts/*`       | codice edge                                                                                      | **Fallback** lato server                               |
| `_shared/commercialDoctrine.ts`              | codice edge                                                                                      | **Fallback** della dottrina commerciale                |
| Prompt Lab (`src/v2/ui/pages/prompt-lab/**`) | UI                                                                                               | **Editor** delle sorgenti autorevoli, non una sorgente |

## Gerarchia non ambigua

1. Database (prompt operativi, personas, dottrina, KB, memoria).
2. Registro dei prompt (`_shared/edgeFnPromptRegistry.ts`) per la risoluzione per nome.
3. Costante nel codice, usata **solo** quando i livelli 1 e 2 non rispondono.

Regole:

- Nessun prompt nuovo nasce nel codice. Nasce nel database e il codice porta
  al massimo una copia di emergenza, marcata come tale.
- Il Prompt Lab scrive sul database: non è una quarta sorgente.
- Ogni fallback nel codice deve dichiarare in testa quale riga di database
  sostituisce, così una divergenza è visibile durante la lettura.
- Il sanitizzatore (`_shared/promptSanitizer.ts`) resta obbligatorio su ogni
  contenuto che arriva dall'esterno, indipendentemente dalla sorgente.

## Runtime unico dell'agente

Percorsi di esecuzione presenti: `ai-assistant`, `agent-execute`,
`generate-email`, `super-mario`. La direzione è un solo orchestratore che
riceve prompt e KB dai loader condivisi in `_shared/`; gli altri punti di
ingresso restano ma delegano, senza costruirsi il contesto per conto proprio.

Criterio di verifica: la stessa domanda posta da Command e da un agente
programmato deve produrre la stessa selezione di prompt, KB e memoria.

## Gate automatico (Fase 2)

`npm run audit:prompt-sources` (attivo in CI) conta le costanti di prompt
definite nel codice che **non** dichiarano la riga di database che
sostituiscono. Il marcatore richiesto, nei commenti del file, è:

```ts
/**
 * Copia di emergenza del prompt. La sorgente autorevole è il database.
 * @fallback-of operative_prompts/<chiave>
 */
```

È un ratchet: il baseline (`scripts/.prompt-sources-baseline.json`) scende da
solo quando si marca o si migra un prompt, e la CI fallisce se sale. Un prompt
nuovo scritto direttamente nel codice, senza marcatore, rompe la build: va
creato nel database.
