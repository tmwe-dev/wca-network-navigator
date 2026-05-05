---
name: Prompt Governance Doctrine
description: Runtime Bundle versionato + Change Kernel + Rubric Engine + Coverage Matrix come unica via di modifica agenti
type: constraint
---

**Doctrine vincolante** (vedi `docs/adr/0004-prompt-governance-runtime-bundle.md`):

1. L'unità versionabile è il **Runtime Bundle** (prompt + persona + KB snapshot + capabilities + routing + system prompt + guards + model + temperature), non il singolo prompt.
2. Edge function `prompt-change-kernel` è l'**unico** punto autorizzato a creare candidate version e fare deploy. Pipeline: `change_request → diff → candidate_bundle → test_run → rubric_eval → approval → deploy → rollback_target`.
3. Tutti gli strumenti del Prompt Lab (Lab Agent Chat, Global Improver, Harmonizer v2, Improve Briefing, Suggest Rule, Split Block Editor, Scheduled Improver, Manual Editor) producono **solo** `change_request` o `suggestion`. Mai scrittura diretta sull'attivo.
4. **Rubric Engine** deterministico (regex/JSON schema/presenza), LLM-judge solo come fallback con temp 0. Almeno 2-3 rubriche bloccanti per agente.
5. Auto-approval consentito sse: tutte le delta rubriche ≥0, nessuna bloccante fallita, diff su singolo blocco, bundle identico tranne il prompt.
6. **Coverage Matrix** (agent × scope × KB × golden_input × rubric) e **KB Health Dashboard** sono parte della governance, non opzionali.
7. **Runtime Truth Viewer**: Prompt Reader, Simulator e runtime devono usare lo stesso assemblatore. Divergenza = bug strutturale, fix immediato.

**Anti-pattern**: nuovi tool nel Lab prima del kernel, migrazione parallela, Rubric Engine prima del Bundle, qualunque porta che bypassa il kernel.

**Why**: oggi 17 strumenti modificano in modo indipendente componenti che in runtime sono un bundle composito; valutazione interpretativa senza gating. Senza questa doctrine la governance resta illusoria.

**How to apply**: ogni nuova feature sui prompt si valuta contro questa doctrine PRIMA di scrivere codice. Implementazione fasata in 8 settimane (W1 schema → W2 kernel → W3-5 migrazione tool → W6 rubric+golden → W7-8 coverage+KB health).