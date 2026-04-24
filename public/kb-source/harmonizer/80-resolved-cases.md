---
name: Memoria storica dei casi risolti
description: Casi reali di gap risolti dall'Harmonizer con before/after/decisione. Si arricchisce automaticamente ogni volta che una proposta viene approvata ed eseguita con successo. Letto per coerenza con decisioni passate.
tags: [harmonizer, memory, history, learning]
---

# Casi risolti — memoria storica dell'Harmonizer

Questo file si **auto-aggiorna**: ogni proposta `executed` con esito ok aggiunge un caso qui (loop di apprendimento, vedi Lavoro 8 del piano).

## Convenzione di voce

```markdown
## YYYY-MM-DD — <breve descrizione>
**Gap originale**: <cosa mancava o non quadrava>
**Decisione**: action_type=X, target_type=Y, resolution_layer=Z
**Perché**: <ragionamento sintetico>
**Esito**: executed / executed_partial / rolled_back
**Lezione**: <eventuale principio generalizzabile>
```

## Casi seed (curati a mano per il primo bootstrap)

### 2026-04-24 — Voce KB "Tono di voce email partner WCA First" obsoleta
**Gap originale**: contenuto datato (parla di stagione 2024), libreria desiderata aggiornata.
**Decisione**: `action_type=UPDATE`, `target_type=kb_entry`, `resolution_layer=text`.
**Perché**: blocco esiste nello stesso posto corretto, contenuto va riallineato.
**Esito**: executed.
**Lezione**: Quando il blocco è già nella sede naturale e il contenuto è solo datato, UPDATE diretto. Non spezzare in DELETE+INSERT.

### 2026-04-24 — Playbook negoziazione Chris Voss assente
**Gap originale**: libreria desiderata richiede playbook Voss per cold call, nessun blocco coincidente nel DB.
**Decisione**: `action_type=INSERT`, `target_type=playbook`, `resolution_layer=text`.
**Perché**: nessun blocco esistente copre il ruolo. Forzare UPDATE su altro playbook deformerebbe l'intenzione.
**Esito**: executed.
**Lezione**: INSERT è giusto solo dopo aver verificato fuzzy match su titolo + categoria. Mai INSERT preventivo.

### 2026-04-24 — Regola GDPR in categoria sbagliata
**Gap originale**: "Regole compliance GDPR per email outreach" presente in `kb_entries` con `category=system_doctrine`, libreria la vuole in `procedures`.
**Decisione**: `action_type=MOVE`, `target_type=kb_entry`, `resolution_layer=kb_governance`.
**Perché**: contenuto già giusto, sede sbagliata. UPDATE manterrebbe categoria sbagliata, INSERT creerebbe duplicato.
**Esito**: executed.
**Lezione**: MOVE è la scelta corretta quando contenuto = giusto, contenitore = sbagliato.

### 2026-04-24 — Duplicato KB "Saluti formali email"
**Gap originale**: due `kb_entries` con titoli simili e contenuto sovrapposto al 90%, libreria ne vuole una sola.
**Decisione**: `action_type=DELETE` (soft), `target_type=kb_entry`, `resolution_layer=text`, sulla voce duplicata. UPDATE sull'altra in proposta separata con dependencies.
**Perché**: dedup richiede DELETE soft del duplicato; il "merge" implicito si rappresenta come DELETE+UPDATE coordinati.
**Esito**: executed.
**Lezione**: Merge non è un'azione canonica. Si rappresenta sempre come combinazione di azioni canoniche.

### 2026-04-24 — Richiesta "auto-blacklist se 3 bounce" → code_policy
**Gap originale**: libreria desiderata richiede transizione automatica `→ blacklisted` dopo 3 bounce email.
**Decisione**: `action_type=INSERT`, `target_type=readonly_note`, `resolution_layer=code_policy`.
**Perché**: la logica di transizione lifecycle è cablata in trigger DB e in `automated-bounce-management`. Riscrivere testo non aggiunge la logica. Va segnalato a sviluppatore.
**Esito**: registrato in `harmonizer_followups`, non eseguito.
**Lezione**: Se il gap richiede una transizione di stato automatica → sempre `code_policy`, mai `text`.

### 2026-04-24 — Campo `recipient_country` mancante in EmailBrief
**Gap originale**: la libreria desiderata propone "personalizza saluto in base al paese", ma `EmailBrief` non ha `recipient_country`.
**Decisione**: `action_type=INSERT`, `target_type=readonly_note`, `resolution_layer=contract`, `missing_contracts=[{contract_name:'EmailBrief', field_name:'recipient_country'}]`.
**Perché**: prima va aggiunto il campo nel contratto runtime. Poi si potrà scrivere il template che lo usa. Non si può scrivere prima un template che usa una variabile inesistente.
**Esito**: registrato in `harmonizer_followups`.
**Lezione**: Se una variabile usata nel testo proposto non esiste in nessun contratto → blocca, segnala come `contract`.

---

## Casi appresi automaticamente

(Sotto questa riga il sistema aggiunge nuovi casi via append automatico dopo ogni run di esecuzione.)