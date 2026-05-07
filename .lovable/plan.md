## Obiettivo

Riorganizzare in modo definitivo i contenuti della Knowledge Base (`kb_entries`) per eliminare ridondanze, contraddizioni numeriche, paragrafi monolitici e mancanza di indicizzazione. Il piano produce: (1) tassonomia canonica, (2) "Fatti Canonici" come Single Source of Truth, (3) procedura "Funny Mail" atomizzata in step, (4) tooling automatico per harmonize + drift check, (5) UI di governance.

Ambito: solo dati e governance KB. Nessuna modifica a flussi AI runtime, edge function di invio, auth o pipeline email.

---

## Stato attuale (rilevato)

- **221 entry attive**, 27 categorie eterogenee (`doctrine` 120, `agent_doctrine` 24, micro-categorie tipo `arsenale`, `chiusura`, `errori`, `filosofia` con 1-3 entry).
- ~41 entry su tema TMWE/Funny/network duplicate o sovrapposte (esempi rilevati: `7. Conversazione con il Responsabile Spedizioni — Metodo del Conquistatore` vs `7. Conversazione con il Responsabile Spedizioni (Il Conquistatore)`; `Frasi efficaci TMWE` vs `#FrasiEfficaciTMWE`; `LIBRERIA TMWE / FindAir` vs `KB Canonica TMWE` vs `Fatti Canonici TMWE`).
- Molte entry con `chapter=''` o `chapter='general'` e **0 tag**, quindi non recuperabili per intent.
- Paragrafi lunghi (>1.400 char) che mescolano marketing, procedura e numeri.
- Esiste già una "Single Source of Truth" parziale (`Fatti Canonici TMWE`) ma sotto-utilizzata: nessuna entry punta lì come riferimento canonico.

---

## Modello target

### 1. Tassonomia canonica (6 famiglie)

Allineata al doc `docs/governance/kb-index-map.md` e al COBRA charter:

```text
doctrine        → identità, valori, fatti canonici, guardrail (NON procedure)
procedures      → workflow operativi step-by-step (Funny Mail, outreach, escalation)
personas        → profili agenti (Aurora, Robin, Ambrogio, Luca…)
playbooks       → tecniche vendita/comunicazione (Voss, hook, chiusura, obiezioni)
glossary        → termini, sigle, dizionario pronuncia, KPI
data-schema     → mappa dati disponibili (WCA, partner fields, tool I/O)
```

Le 27 categorie attuali vengono mappate su queste 6 (es. `chris_voss`, `chiusura`, `obiezioni`, `hook`, `negoziazione`, `cold_outreach`, `persuasione`, `frasi_modello`, `tono`, `chiusura`, `arsenale`, `filosofia` → `playbooks`; `dati_partner`, `command_tools` → `data-schema`; `agent_doctrine` voci agente → `personas`, voci sistema → `doctrine`).

### 2. Single Source of Truth dei fatti

Un'unica entry `doctrine/canonical-facts/Fatti Canonici TMWE` contiene **tutti** i numeri (spedizioni/anno, partner, paesi, certificazioni). Le altre entry **non duplicano i numeri**: rimandano via `[[Vedi: Fatti Canonici TMWE]]`. L'harmonizer rileverà numeri "liberi" fuori da quell'entry e proporrà rimozione.

### 3. Procedura Funny Mail atomizzata

La descrizione monolitica diventa 6 entry brevi sotto `procedures/funnymail/`:

```text
01-deep-search.md        → cosa cercare sul mittente, cosa NON ripetere
02-classification.md     → tipo, urgenza, owner_role
03-summary.md            → contratto sintesi (campi obbligatori)
04-job-creation.md       → quando aprire job, owner, due_in_hours
05-assignment.md         → routing target_role + business_value
06-next-step.md          → R1/R2/R3 (mandatory/agenda/anticipation) — già coperti, qui solo riferimento
```

Ogni file: front-matter standard + ≤ 400 char + tag espliciti (`funnymail, inbound, classify, ...`).

### 4. Schema entry standard

Front-matter obbligatorio in ogni `kb_entries.content`:

```yaml
---
canonical_id: funnymail/01-deep-search
family: procedures
intent_tags: [funnymail, inbound, deep_search]
related: [doctrine/canonical-facts]
last_reviewed: 2026-05-07
---
```

`tags` DB = `intent_tags` + `family`. `chapter` = path canonico (es. `funnymail`).

### 5. Tabelle/colonne DB

- Aggiungere colonna `canonical_id text UNIQUE` a `kb_entries` (idempotency per re-import).
- Aggiungere colonna `superseded_by uuid REFERENCES kb_entries(id)` per archiviare duplicati senza perderli (soft-link, niente delete fisica — rispetta memoria `no-physical-delete`).
- Vista `v_kb_active_canonical` che esclude `superseded_by IS NOT NULL`.

---

## Esecuzione (5 step)

### Step 1 — Snapshot + audit automatico
- Edge function `kb-doctrine-audit` (estende quello già fatto 2026-05-02): produce report markdown in `/mnt/documents/kb-audit-2026-05-07.md` con:
  - duplicati esatti (hash content normalizzato)
  - duplicati semantici (cosine similarity ≥ 0.92 su `embedding`)
  - numeri/cifre fuori da `canonical-facts`
  - entry senza `tags` o senza `chapter`
  - mapping proposto categoria → famiglia canonica.

### Step 2 — Migration schema (`canonical_id`, `superseded_by`, view)
- Una migration singola, RLS invariata, indici aggiuntivi.
- Trigger che vieta scrittura libera di numeri canonici (warning, non block) tramite funzione `kb_validate_canonical_facts()`.

### Step 3 — Riorganizzazione contenuti
Tutto come **proposte** in `kb_entry_proposals` (rispetta memoria `prompt-copilot-and-kb-index`), zero scritture dirette:
1. Creare/aggiornare `Fatti Canonici TMWE` con numeri unici e tag `[canonical_facts, numbers]`.
2. Creare 6 entry `procedures/funnymail/*` partendo dal monolite esistente.
3. Per ogni gruppo di duplicati: scegliere "winner", marcare gli altri `superseded_by=winner_id`.
4. Riassegnare `category` alle 6 famiglie canoniche per tutte le 221 entry (mapping deterministico in `_shared/kbCategoryMapper.ts`).
5. Popolare `tags` mancanti via prompt operativo `KB Tagger` (in `operative_prompts`, context=`harmonize`).

### Step 4 — UI governance (KB Supervisor)
Estendere `/v2/kb-supervisor` (già esistente) con:
- Tab **Famiglie**: vista per famiglia canonica, conteggi, duplicati pendenti.
- Tab **Audit**: ultimo report `kb-doctrine-audit` con bottoni "Approva proposta" che applicano `superseded_by` o aggiornano `canonical_id`.
- Tab **Drift**: confronto con `public/kb-source/libreria-tmwe.md` (sorgente desiderata già prevista).

### Step 5 — Drift guard continuo
- Cron `pg_cron` settimanale che esegue `kb-doctrine-audit` e apre proposta se trova: numero in entry non-canonical, entry con tag vuoti, similarità ≥ 0.92.
- Memoria `mem://features/kb-canonical-governance.md` documenta il protocollo.

---

## Cosa NON viene toccato

- Loader prompt operativi e logica AI (`assemblePrompt`, `loadKbContext`).
- Pipeline Funny Mail runtime (`classify-inbound-content`, `funnemail-auto-route`).
- Auth, RLS esistenti, soft-delete trigger.
- Edge function di invio email/WA/LI.

---

## Acceptance criteria

- 0 entry con numeri canonici fuori da `Fatti Canonici TMWE` (verificato dall'audit).
- 100% entry attive con `category ∈ {doctrine, procedures, personas, playbooks, glossary, data-schema}`.
- 100% entry attive con almeno 2 `tags`.
- Procedura Funny Mail recuperabile via 6 entry distinte ognuna ≤ 600 char.
- Duplicati semantici ≥ 0.92 ridotti a 0 (winner + `superseded_by`).
- KB Supervisor mostra report drift e permette approvazione 1-click.
- `kb-doctrine-audit` schedulato e funzionante.

---

## Domanda di chiusura

Prima di partire serve confermare due scelte:

1. **Politica duplicati**: archivio via `superseded_by` (preferibile, niente delete) **oppure** soft-delete tramite trigger esistente.
2. **Esecuzione contenuti**: tutte le riassegnazioni passano da `kb_entry_proposals` con tua approvazione 1-click in KB Supervisor (sicuro), **oppure** auto-apply per le modifiche meccaniche (rename categoria, tag) e proposta solo per merge/superseded.
