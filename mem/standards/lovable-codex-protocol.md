---
name: Lovable Codex Protocol
description: Quando l'utente scrive `codex`, `applica codex`, `modalità codex` o `quick codex` applico il protocollo in docs/governance/lovable-quick-codex.md. Per CRITICAL leggo anche docs/governance/lovable-codex.md. Output sempre con `CLASSE | OBIETTIVO` in cima e `CHANGELOG` con registri `[VERIFICATO]/[ATTESO]/[ASSUNTO]` in fondo per STANDARD/CRITICAL.
type: preference
---

**Trigger di attivazione**: l'utente scrive una di queste parole/frasi nel messaggio:
- `codex`
- `applica codex`
- `modalità codex`
- `quick codex`

**Default permanente** (anche senza trigger): per ogni intervento classificato CRITICAL il protocollo è automaticamente attivo.

**Cosa fare quando attivo**:
1. Leggo `docs/governance/lovable-quick-codex.md` come riferimento.
2. Per CRITICAL leggo anche `docs/governance/lovable-codex.md`.
3. Classifico l'intervento (TRIM / STANDARD / CRITICAL) usando §1 del Quick Codex.
4. In dubbio tra due classi → scelgo la superiore.
5. Applico la checklist della classe (§2 Quick Codex).
6. Output:
   - **TRIM**: 1 riga di chiusura.
   - **STANDARD/CRITICAL**: prima riga `CLASSE: ... — OBIETTIVO: ...`. Ultima sezione `CHANGELOG` con voci marcate `[VERIFICATO]`, `[ATTESO]` o `[ASSUNTO]`. Per CRITICAL: blocco ROLLBACK scritto.
7. Se incertezza CRITICA emerge → STOP, formulo domanda specifica, non procedo.
8. Se vedo un secondo problema durante il lavoro → lo registro in DEBITO RESIDUO, non lo correggo.
9. Mai dire "dovrebbe funzionare", "ho già fixato" senza verifica, "ne approfitto per…" → riformulo o sposto in DEBITO RESIDUO.

**Regole inviolabili attive sempre** (anche fuori protocollo): vedi §11 del Codex completo. Le 14 memorie Core del progetto + 8 regole Codex Cobra. L'utente può chiedere deroga solo con conferma esplicita.

**Why**: l'utente ha richiesto un protocollo Codex Cobra adattato per evitare regressioni silenti, "ho fixato" non veri, refactor opportunistici e violazioni dei nodi critici (DAL, AI Charter, journalistReview, soft-delete, edge AI, RLS).

**How to apply**: per ogni messaggio utente con uno dei trigger, oppure per ogni intervento auto-classificato CRITICAL, seguo il protocollo. Per gli altri casi (TRIM/STANDARD senza trigger) mantengo le regole inviolabili ma posso usare output sintetico standard.