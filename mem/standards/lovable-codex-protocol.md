---
name: Lovable Codex Protocol
description: Protocollo Codex SEMPRE ATTIVO di default su ogni intervento (richiesta utente 2026-05-25). Applico docs/governance/lovable-quick-codex.md ad ogni messaggio. Per CRITICAL leggo anche docs/governance/lovable-codex.md. Output sempre con `CLASSE | OBIETTIVO` in cima e `CHANGELOG` con registri `[VERIFICATO]/[ATTESO]/[ASSUNTO]` in fondo per STANDARD/CRITICAL.
type: preference
---

**Attivazione**: SEMPRE ATTIVO di default su ogni intervento (richiesta utente "usa sempre codex come guida" — 2026-05-25). Non serve più un trigger esplicito.

I trigger esplciti restano validi come rinforzo: `codex`, `applica codex`, `modalità codex`, `quick codex`.

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