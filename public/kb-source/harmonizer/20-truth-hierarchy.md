---
name: Gerarchia di verità del sistema
description: I 4 livelli di verità del WCA Network Navigator con esempi reali e indicazione di quale resolution_layer scegliere quando una regola è nel posto sbagliato.
tags: [harmonizer, doctrine, hierarchy, resolution-layer]
---

# Gerarchia di verità (NON NEGOZIABILE)

Quattro livelli, dal più forte al più debole. Una regola di livello superiore **vince sempre** su una di livello inferiore.

## Livello 1 — Policy hard nel codice

Regole codificate in TypeScript che bloccano azioni a runtime. Non discutibili, non aggirabili dall'AI.

**Esempi reali nel WCA Network Navigator**:
- `src/v2/agent/policy/hardGuards.ts` → `FORBIDDEN_TABLES` (auth.users, vault.secrets, ecc.) e `AI_WRITABLE_TABLES` (whitelist).
- `src/v2/agent/policy/hardGuards.ts` → `assertNotDestructive()` impedisce qualsiasi DELETE/DROP/TRUNCATE.
- `src/v2/agent/policy/hardGuards.ts` → `MAX_BULK_CAP_HARD = 100` cap assoluto bulk.
- `mem://constraints/no-physical-delete` → trigger DB intercetta DELETE business e lo trasforma in soft delete.
- `mem://constraints/no-wca-download-ai` → agenti AI non possono orchestrare download/scansioni WCA.
- `mem://constraints/email-download-integrity` → codice email sync intoccabile.

**Se l'Harmonizer trova un gap che richiederebbe di toccare una di queste regole** → `resolution_layer = code_policy`. Crea una `readonly_note`, **non scrive testo**.

## Livello 2 — Costituzione / KB doctrine

Regole di business e dottrina commerciale, vivono in `kb_entries` con categorie `system_doctrine`, `sales_doctrine`, `doctrine`. Modificabili dall'Harmonizer ma con cautela e **mai senza evidenza forte**.

**Esempi reali**:
- "Politica visibilità contatti condivisi" — tutti i contatti sono visibili a tutti gli operatori (vedi `mem://business/shared-contacts-visibility-policy`).
- "Same-Location Guard" — un lead ha un unico agente assegnato (vedi `mem://business/commercial-strategy-rules`).
- "Workflow commerciale standard a 6 fasi" (`sales_standard`) — Discovery → Qualification → ...
- "Holding pattern governance" — progressione automatica via lead status.
- Tassonomia 9 stati lead (vedi `30-business-constraints.md`).

**Se l'Harmonizer trova una regola di livello 2 nel posto sbagliato** (es: una regola di doctrine scritta in un prompt core, o una procedura messa in doctrine) → `resolution_layer = kb_governance`. Proponi **MOVE**.

## Livello 3 — Prompt core leggeri

System prompt degli agenti, persona templates, operative prompts strutturati. Vivono in `agents.system_prompt`, `agent_personas.custom_tone_prompt`, `operative_prompts.objective/procedure/criteria`.

**Esempi reali**:
- Tono di voce di Luca (Director) — asciutto, referente strategico.
- Persona Bruce — outreach commerciale.
- Operative prompt "Cold call apertura" — script con objective, procedure, criteria.

**Modificabili dall'Harmonizer** con `resolution_layer = text` (testo da riscrivere) o `kb_governance` (se vanno spostati).

## Livello 4 — Input libero dell'utente

Testo composto in chat dall'operatore, parametri di una mission, note libere su un contatto. **Non gestito dall'Harmonizer**: l'Harmonizer non legge i messaggi degli utenti finali, non legge note operative.

## Decisione: come scegliere il resolution_layer

Tabella di decisione:

| Cosa hai trovato | resolution_layer | Cosa fai |
|---|---|---|
| Una regola che richiede vincolo runtime (es: "blocca invio se non c'è approvazione") | `code_policy` | `readonly_note` per dev, no scrittura DB |
| Un campo backend mancante (es: "manca `recipient_country` in EmailBrief") | `contract` | `readonly_note` con `missing_contracts: [...]` |
| Una regola di business in `kb_entries` ma in categoria sbagliata | `kb_governance` | MOVE proposto |
| Un testo in `kb_entries` o prompt che va solo riscritto | `text` | UPDATE o INSERT testuale |

## Errori da evitare

- ❌ Mai "riscrivere meglio" un problema di livello 1 in testo. Esempio: se un blocco dice "permetti DELETE su partners se admin", **non riscriverlo**, segnalalo come `code_policy`.
- ❌ Mai inventare contratti. Se un campo non esiste in nessuno dei contratti esistenti (vedi `70-runtime-contracts.md`), segnala come `contract` missing.
- ❌ Mai contraddire la tassonomia 9 stati o la Costituzione commerciale (vedi `30-business-constraints.md`).