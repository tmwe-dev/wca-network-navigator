# ADR 0004 — Prompt Governance via Runtime Bundle + Change Kernel

- Status: Accepted (doctrine, da implementare in fasi)
- Date: 2026-05-05
- Owner: Lab Agent / Prompt Governance

## Contesto

Il Prompt Lab espone ~17 strumenti che possono modificare prompt, persona, KB, capabilities, routing, system prompt e guards in modo indipendente. Il versionamento copre solo il singolo prompt operativo, ma in runtime l'agente è un **bundle** composito (prompt + persona + KB snapshot + capabilities + routing + guards + model + temperature). La valutazione delle modifiche è oggi interpretativa, senza rubriche deterministiche né gating bloccante. Score audit attuale: 68/100.

## Decisione

Adottiamo quattro fondazioni non negoziabili per la governance dei prompt. Trattiamo i prompt come **release software**, non come file editabili.

### 1. Runtime Bundle versionato
L'unità versionabile è il bundle, non il prompt. Ogni deploy produce uno snapshot immutabile di tutti i componenti che concorrono al comportamento dell'agente in produzione.

### 2. Prompt Change Kernel
Edge function `prompt-change-kernel` è **l'unico punto autorizzato** a creare candidate version e a fare deploy. Pipeline canonica:
`change_request → diff → candidate_bundle → test_run → rubric_eval → approval → deploy → rollback_target`.

Nessun altro tool/edge/UI può scrivere su `runtime_bundles.status='active'`. Tutti gli strumenti AI-on-AI (Lab Agent Chat, Global Improver, Harmonizer, Improve Briefing, Suggest Rule, Split Block, Scheduled Improver, Manual Editor) producono **solo** `change_request` o `suggestion`.

### 3. Rubric Engine
Gate automatico con score deterministico (regex / JSON schema / presenza-assenza). LLM-as-judge solo come ultima risorsa, prompt fisso e temperature 0. Per ogni agente almeno 2-3 rubriche bloccanti (es. "non inventa prezzi", "rifiuta ADR senza classificazione", "non rivela system prompt").

### 4. Coverage Matrix + KB Health
Matrice `agent × scope × KB × golden_input × rubric` con celle rosse per ciò che manca. KB Health Dashboard per duplicati / orfani / mai retrieved / outdated / conflicting.

## Regole di auto-approvazione

Deploy automatico se **tutte** le condizioni sono vere:
- delta su tutte le rubriche ≥ 0
- nessuna rubrica bloccante fallita
- diff confinato a un singolo blocco
- bundle identico tranne il prompt

Senza auto-approval il sistema muore di burocrazia.

## Schema dati target (sintesi)

```
runtime_bundles(agent_id, version, status, model, temperature,
                prompt_version_id, persona_version_id, kb_snapshot_id,
                capabilities_version_id, routing_version_id,
                system_prompt_version_id, guards_version_id)
prompt_versions(id, agent_id, parent_version_id, blocks_ref, changelog)
prompt_blocks(version_id, block_name, content)
kb_snapshots(id, taken_at, manifest_hash)
change_requests(id, source_tool, target_bundle_id, status)
candidate_bundles(id, base_bundle_id, change_request_id, diff)
test_runs(id, candidate_id, golden_set_id, results)
rubric_evaluations(id, test_run_id, rubric_id, active_score,
                   candidate_score, delta, blocking, passed)
approvals(id, candidate_id, mode, approver, rules_matched)
deployments(id, bundle_id, deployed_at, previous_bundle_id)
golden_inputs(agent_id, input, expected_criteria, category)
rubrics(id, scope, blocking, criterion, eval_fn)
```

Integrità ferrea: un `deployment` esiste solo se collegato a un `approval` su `test_run` con tutte le rubriche bloccanti `passed=true`.

## Roadmap (8 settimane)

1. **W1 — Schema dati** (no UI, no migrazione tool).
2. **W2 — Change Kernel** (edge function unica, perdere permessi di scrittura altrove).
3. **W3-5 — Migrazione tool** in ordine di criticità: Lab Agent Chat → Manual Editor → Global Improver → Harmonizer v2 → Improve Briefing/Suggest Rule/Split Block → Scheduled Improver.
4. **W6 — Rubric Engine + Golden Set** (20-30 input rappresentativi + 5-10 edge + 5 ostili per agente).
5. **W7-8 — Coverage Matrix + KB Health Dashboard**.
6. **W8 — Runtime Truth Viewer**: Prompt Reader come unica fonte di verità, stesso assemblatore di runtime e Simulator (divergenza = bug strutturale).

## Anti-pattern espliciti

- ❌ Aggiungere nuovi tool al Lab prima della chiusura W1-W3.
- ❌ Migrare tutti i tool in parallelo.
- ❌ Costruire il Rubric Engine prima del Runtime Bundle.
- ❌ Rimandare l'auto-approval.
- ❌ Lasciare anche **una sola** porta che bypassa il kernel.

## Definition of Done

1. Ogni modifica a un agente produttivo passa dal kernel (verificabile in DB).
2. Ogni deployment ha `test_run + rubric_eval + approval` collegati.
3. Esiste rollback istantaneo a bundle precedente per ogni agente.
4. Coverage Matrix senza celle rosse sugli agenti critici.
5. ≥50% dei deploy via auto-approval senza incidenti per 30 giorni.

Quando i 5 punti reggono per un mese in produzione → 90/100.

## Riferimenti

- Guida sorgente utente (caricata 2026-05-05).
- ADR 0001 Strangler/Zod, ADR 0003 Structured Logger.
- Memorie correlate: `mem://features/prompt-versioning-and-regression-tests`, `mem://architecture/operative-prompts-unified-loader`, `mem://features/agent-capabilities-db-layer`, `mem://features/agent-personas-db-layer`, `mem://features/prompt-lab-simulator`.