---
name: Esempi canonici delle 4 azioni Harmonizer
description: Un esempio reale per UPDATE, INSERT, MOVE, DELETE più anti-esempi. Letto quando l'Harmonizer è incerto su quale azione scegliere.
tags: [harmonizer, examples, actions]
---

# Esempi canonici delle 4 azioni

Ogni esempio mostra: **gap reale** → **decisione corretta** → **perché**.

## ✅ UPDATE — esempio canonico

**Gap**: nella libreria desiderata c'è la voce KB "Tono di voce per email a partner WCA First". Nel DB esiste già una `kb_entries` con `title="Tono di voce email partner WCA First"`, stessa categoria `sales_doctrine`, contenuto datato (parla ancora di stagione 2024).

**Decisione**: `action_type = UPDATE`, `target_type = kb_entry`, `target_id` = id della voce esistente.

**Perché UPDATE e non INSERT**: il blocco esiste già nello stesso posto (`kb_entries` + categoria `sales_doctrine`), il titolo combacia, l'intenzione è la stessa. Va solo riallineato il contenuto. Creare un nuovo blocco creerebbe un duplicato.

## ✅ INSERT — esempio canonico

**Gap**: nella libreria desiderata c'è "Playbook negoziazione Chris Voss per chiamate cold". Nel DB non esiste nulla che copra questo: nessun `commercial_playbook` con questo nome, nessuna `kb_entry` su Voss, nessun `operative_prompt` correlato.

**Decisione**: `action_type = INSERT`, `target_type = playbook`, `target_id = null`.

**Perché INSERT e non UPDATE**: nessun blocco esistente copre quel ruolo. Forzare un UPDATE su un playbook esistente diverso (es. "Playbook follow-up") deformerebbe la sua intenzione originale.

## ✅ MOVE — esempio canonico

**Gap**: nella libreria desiderata "Regole di compliance GDPR per email outreach" è classificata come `kb_entries` categoria `procedures`. Nel DB esiste già con identico contenuto, ma è dentro `system_doctrine`.

**Decisione**: `action_type = MOVE`, `target_type = kb_entry`, `target_id` = id esistente, `current_location = kb_entries/system_doctrine`, `proposed_location = kb_entries/procedures`.

**Perché MOVE e non UPDATE**: il contenuto è già giusto, va solo riallocato. UPDATE manterrebbe la categoria sbagliata. INSERT creerebbe duplicato.

## ✅ DELETE — esempio canonico

**Gap**: nel DB esistono **due** `kb_entries` con titoli simili: "Saluti formali email" e "Formula di apertura email formale", contenuto sovrapposto al 90%. La libreria desiderata ne prevede solo una, "Formula di apertura email formale".

**Decisione**: `action_type = DELETE` (soft, `is_active=false`), `target_type = kb_entry`, `target_id` = id della voce duplicata.

**Perché DELETE soft e non hard**: per policy del sistema, **mai** hard delete su `kb_entries`. Soft delete preserva tracciabilità storica.

## ❌ Anti-esempio 1 — sembrava UPDATE, era INSERT

**Gap**: la libreria descrive "Persona agente Bruce per UK". Nel DB esiste un agente "Bruce", ma con territori `[]` e role `outreach` generico, non specializzato UK.

**Decisione sbagliata**: UPDATE su Bruce esistente per cambiare territori e role.

**Decisione corretta**: dipende dal contesto. Se `41-agents-existing.md` mostra che Bruce è già usato attivamente per altri territori, allora **INSERT** di un nuovo agente "Bruce UK". Se Bruce non ha mai operato → UPDATE accettabile. **L'Harmonizer deve consultare lo snapshot agenti esistenti prima di decidere**.

## ❌ Anti-esempio 2 — sembrava INSERT, era MOVE

**Gap**: la libreria desiderata contiene "Tutorial: come configurare un nuovo agente". Cercando nel DB sembra non esserci nulla. Decisione naïve: INSERT in `kb_entries`.

**Decisione corretta**: prima cercare per fuzzy match. Esiste già "Setup agente" come `operative_prompt` di tipo `procedure`. Allora **MOVE** verso `kb_entries` (con UPDATE del titolo nella stessa proposta in dependencies), non INSERT.

## ❌ Anti-esempio 3 — DELETE proposto su tabella business

**Gap**: il modello vede un partner duplicato ("Acme Logistics" presente due volte in `partners`).

**Decisione sbagliata**: proporre DELETE.

**Decisione corretta**: **rifiutare la proposta**. `partners` è tabella business, **mai** DELETE da Harmonizer. Eventualmente registrare come `readonly_note` con `resolution_layer = code_policy` perché la dedup partner è una procedura operativa che richiede regole hard, non un riscritto testuale.