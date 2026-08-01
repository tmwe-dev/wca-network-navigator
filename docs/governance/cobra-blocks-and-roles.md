# COBRA — Blocchi prompt + 4 ruoli AI (complemento ADR 0004)

Sintesi del documento "GUIDA COMPLETA Sistema COBRA Prompt Lab" adattata al nostro contesto.

## Blocchi prompt — mapping con il nostro standard 5-sezioni

| Blocco COBRA       | Nostra sezione (`docs/prompt-standard.md`)         | Tabella DB            |
|--------------------|----------------------------------------------------|-----------------------|
| `role.md`          | Identità                                            | `operative_prompts.context` |
| `mission.md`       | Obiettivo                                           | `operative_prompts.objective` |
| `constraints.md`   | Guardrail                                           | `operative_prompts.criteria` |
| `tools.md`         | (capabilities)                                      | `agent_capabilities` |
| `workflow.md`      | Metodo                                              | `operative_prompts.procedure` |
| `output_format.md` | Output                                              | `operative_prompts.criteria` (sez. output) |
| `examples.md`      | Esempi                                              | `operative_prompts.examples` |
| `refusal_policy.md`| Guardrail (sez. rifiuti)                            | `operative_prompts.criteria` |

I blocchi vivono in **DB**, non su filesystem. Il versionamento avviene tramite `prompt_versions` (snapshot immutabile).

## 4 ruoli AI separati

1. **Architect** — diagnosi strutturale del prompt. Non scrive nulla. Output: JSON con `risk_points`, `missing_sections`, `recommendations`.
2. **Editor** — modifica chirurgica di **un solo blocco**. Output: diff + motivazione + rischi + assunzioni. Non riscrive l'intero prompt.
3. **Global Improver** — riscrittura completa. Alto rischio, raro. Richiede test completo + approvazione manuale.
4. **Test Runner + Evaluator** — esegue prompt su golden set, valuta con rubriche. Deterministico, no scritture.

Regola: **questi ruoli non si fondono.** La chat copilota del Prompt Reader implementa Architect + Editor in due modalità distinte (`mode='diagnose' | 'edit'`).

## Regola di approvazione

`candidate_score ≥ active_score AND candidate_score ≥ 80 AND no blocking failures`.

## Anti-pattern vietati (già nostri)

1. Riscrivere tutto il prompt per una modifica piccola.
2. Modifica e deploy senza test.
3. Valutazione "a sentimento" senza rubriche.
4. Sovrascrittura del prompt attivo (no rollback).
5. Deploy senza changelog.

## Cosa NON adottiamo dalla guida

- File-system per blocchi (`role.md`, `mission.md`...): noi siamo DB-first.
- 6 edge function indipendenti (`architect-analyze`, `build-prompt`, ...): unificate nel **Prompt Change Kernel** (ADR 0004) per evitare bypass governance.