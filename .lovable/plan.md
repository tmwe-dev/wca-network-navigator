## Obiettivo

Aggiungere a Settings due pulsanti di **Download** (Prompt + Knowledge Base), eliminare i duplicati evidenti tra gli agenti, e definire lo **standard "professore"** che useremo per riscrivere ogni prompt — solo dopo tua approvazione caso per caso.

Nessuna riscrittura ora. Solo: estrazione, pulizia duplicati agenti, e documento dello standard.

---

## 1. Download da Settings (priorità immediata)

In `Settings → Prompt & KB` (sezione nuova, o dentro un tab esistente del Prompt Lab) aggiungo due pulsanti:

**A) Scarica tutti i Prompt**
- Sorgenti unite in un unico archivio `.zip`:
  - `operative_prompts/` — un file `.md` per ogni record DB (i 13 attivi + gli inattivi, separati in due cartelle), con frontmatter (name, context, priority, tags) + sezioni Objective / Procedure / Criteria / Examples.
  - `core-prompts/` — i 10 file `src/v2/agent/prompts/core/*.ts` esportati come `.md` (estratto il template string).
  - `agents/` — un `.md` per ogni record `agents` (system_prompt + knowledge_base inline).
  - `INDEX.md` — tabella riassuntiva con conteggi e mappa "dove viene usato" (quale edge function lo carica).
- Formato anche `.json` opzionale (toggle) per chi vuole reimportare.

**B) Scarica tutta la KB**
- `.zip` con:
  - `kb_entries/{category}/{slug}.md` — un file per entry, frontmatter completo (category, chapter, tags, priority, is_active).
  - `INDEX.csv` — riga per entry con: id, title, category, chapter, priority, char_count, used_by (lista di agentId/edge function che la caricano in base al filtro `kbCategories`).
  - `DUPLICATES.md` — coppie di entry con titolo identico o contenuto sovrapposto >80% (similarity via trigram, server-side).
  - `ORPHANS.md` — entry attive ma non incluse da nessuno dei filtri noti (`DEFAULT_KB_CATEGORIES`, `DOMAIN_KB_CATEGORIES`, super-mario, kbAssembler, command help, ecc.).

Entrambi i download girano lato client (DAL già esistente per `operative_prompts` e `kb_entries`) + una piccola edge function `export-prompts-and-kb` che zippa server-side per evitare blob enormi nel browser.

---

## 2. Pulizia duplicati agenti

Stato DB: **53 agenti**, di cui:
- **Luca**: 4 record con nome esatto "Luca" + 2 "Luca — Director" → 6 totali per stessa identità.
- **Marco**: 5 record ("marco" + 4 "Marco").
- **Sara**: 2.
- **Robin**: 2 + 1 "PROMPT ROBIN…" + 1 "ROBIN — Sales…".
- **TMWE S.r.l.**: 4 record (chiaramente KB cards finite per errore nella tabella `agents`).
- **Numeri di performance**: 2.
- **Certificazioni & Network**: 2.
- Vari record che sono KB cards travestite da agenti ("11. Glossario rapido", "5. Dizionario pronuncia", "8. Conoscenze di Base…", "Fatti Canonici TMWE", "LIBRERIA TMWE…").

**Procedura:**
1. Genero in `/mnt/documents/agents-cleanup-proposal.md` la lista completa con:
   - per ogni cluster di duplicati, qual è il record canonico proposto (più recente con `system_prompt` non vuoto), e quali finiscono in soft-delete;
   - per i record che sono KB cards (non agenti veri), spostamento in `kb_entries` con categoria appropriata prima del soft-delete.
2. Tu lo leggi.
3. Quando dai OK, eseguo i soft-delete in **un'unica transazione** tramite migration (il trigger `no_physical_delete` converte in `deleted_at`, quindi è reversibile).

Nessuna eliminazione fisica. Nessun touch su agenti dubbi: solo nomi identici o KB cards palesi.

---

## 3. Standard "professore" (documento, niente codice)

Creo `docs/prompt-standard.md` con la forma canonica che applicheremo a TUTTI i prompt (operative_prompts DB + core/*.ts).

**Schema fisso (max ~40 righe utili):**

```text
1. IDENTITÀ          chi sei, in 2 righe
2. OBIETTIVO         cosa devi ottenere, 1 frase
3. METODO            il "professore":
                     a) analizza richiesta + contesto fornito
                     b) consulta memoria/storico (cosa è già stato detto/fatto)
                     c) consulta KB pertinente (titoli iniettati, no full dump)
                     d) usa gli strumenti disponibili per investigare
                     e) produci diagnosi + piano azioni numerato
                     f) eseguilo o proponilo per approvazione
4. GUARDRAIL         cosa NON puoi fare (in negativo, no ricette)
5. OUTPUT            forma minima richiesta dall'UI (JSON shape o testo libero)
```

**Vietato (e segnalato in audit):**
- Codice inline (snippet TS/SQL nel prompt).
- Liste di frasi proibite/obbligatorie ("non dire mai…", "inizia sempre con…").
- Lunghezze fisse ("80-150 parole").
- Step procedurali rigidi che ripetono regole già nel DB.
- Doctrine duplicate tra prompt TS e operative_prompts DB.

**Mappa applicazione (proposta, NON eseguita):**
Per ogni prompt esistente produco un diff in `/mnt/documents/prompt-rewrite-proposals/{name}.md` con: versione attuale a sinistra, versione "professore" a destra, motivazioni delle modifiche. Tu approvi uno alla volta. Nessuna scrittura su DB o file `core/*.ts` senza tuo OK esplicito sul singolo prompt.

---

## 4. Audit KB (167 entry "doctrine" + 26 categorie)

Output, scaricabile insieme al pacchetto KB del punto 1.B:

- **Cluster semantico**: raggruppo le 167 entry doctrine per similarity di contenuto (trigram + cosine su embeddings esistenti se disponibili, altrimenti solo trigram). Output: gruppi di N entry candidate al merge.
- **Mappa utilizzo**: per ogni entry indico quali agenti/edge function la caricano davvero. Cross-reference con:
  - `assemblePrompt` (`DEFAULT_KB_CATEGORIES`, `DOMAIN_KB_CATEGORIES`)
  - `super-mario/kbAssembler`
  - `useCommandPromptsAndKb` (Command)
  - eventuali altri loader trovati con ripgrep
- **Orphans**: entry attive che non vengono caricate da nessun agente.
- **Categorie inconsistenti**: es. 26 categorie diverse, di cui molte con 1-3 entry; propongo accorpamento in 6-8 categorie canoniche allineate alla doctrine "Cognitive Memory L1-L3".

Nessuna entry viene cancellata o modificata in questa fase. Solo report.

---

## Ordine di esecuzione (passo dopo passo)

1. **Pulsanti download in Settings** + edge function `export-prompts-and-kb` → tu scarichi e leggi.
2. **Proposta pulizia agenti** in `/mnt/documents/agents-cleanup-proposal.md` → tu approvi → eseguo soft-delete.
3. **Documento standard "professore"** in `docs/prompt-standard.md` → tu lo leggi e ne validi la forma.
4. **Cartella `/mnt/documents/prompt-rewrite-proposals/`** con un diff per ogni prompt → approviamo uno per uno.
5. **Report audit KB** (cluster + mappa + orphans + categorie) incluso nello zip del punto 1.

---

## Cosa NON faccio (per essere chiari)

- Non riscrivo nessun prompt esistente prima del tuo OK sul singolo diff.
- Non cancello nessuna entry KB.
- Non tocco la pipeline editoriale (sanitizer, normalizer, injection guard, giornalista, post-send).
- Non tocco gli agenti di cui non sono certo che siano duplicati esatti o KB-cards-mascherate.
