# AUDIT_METHOD.md

## Base

- **SHA HEAD analizzato**: `9bfcb627ce574a78cc67ecd34e4444c2507baeb9`
- **SHA richiesta**: `b5de1e7994b74fd22a489eecb883188df1e74582`
- **Delta**: HEAD is 2 commits ahead of requested base (b5de1e7 → 9bfcb62). Audit performed at HEAD; delta is 2 non-runtime commits (b15415594 Changes, 9bfcb627c 'Esposso errore upstream AI' — 1-line edit to whatsapp-ai-extract error payload).
- Motivazione: git checkout non è consentito nel sandbox (git state gestito internamente). L'analisi è a HEAD; il delta rispetto alla base richiesta è di 2 commit non-runtime (unico impatto: allargamento payload d'errore in `supabase/functions/whatsapp-ai-extract/index.ts` — non modifica il perimetro strutturale).

## Comandi determinanti

- `git ls-files` → 4130 file (denominatore inventario, 100% coverage).
- `/tmp/manifest.py` → costruisce `inventory.jsonl` (1 riga JSON per file).
- `/tmp/analyze.py` → deriva import graph, orfani, duplicati, fan-in/out, overlap v1/v2, aggregati debito.
- `/tmp/findings.py` → applica 14 regole strutturali su `inventory.jsonl` e produce `line-findings.jsonl`.

## Metriche per file (calcolate per ogni file testuale non binario/vendor/generated)

- righe totali / codice / commento / vuote (parser rigato, block-comment aware)
- linguaggio da estensione, area (`src_v2`, `edge_functions`, `db_migrations`, …)
- funzioni/classi contate via regex, `longest_function_name/_lines` via brace-matching
- ciclomatica _stimata_: conteggio `if/else/for/while/case/catch/&&/||/?:/return`
- max nesting per profondità di `{`
- import: regex `IMPORT_RE` (import statici + `import()` dinamico + `require`)
- fingerprint: SHA1 dei primi 8k caratteri normalizzati (whitespace collassato) → duplicati approssimati
- SHA1 file completo → duplicati esatti
- accessi: `supabase.from|rpc|functions.invoke`, `invokeEdge`, `invokeAi`, `Deno.env.get`, `import.meta.env`, `fetch(`
- marker: `TODO|FIXME|HACK|@deprecated|: any|@ts-ignore|eslint-disable|console.*`

## Import graph

- risoluzione: relativa (`./`, `../`) + alias `@/` → `src/`, con probe di estensione (`.ts/.tsx/.js/.jsx`) e `index.*`.
- fan-in / fan-out calcolati sull'import graph statico _dei soli file semantici_.
- **Limitazione riconosciuta**: import dinamici stringa-costruiti, route string-based, riflessioni SQL/RPC non risolvibili staticamente ⇒ possibili falsi orfani. Per contenere il rischio: nessun orphan è marcato come "da rimuovere"; sono candidati a **verifica manuale**.

## Denominatore semantico

Esclusi da metriche di complessità (ma inclusi nell'inventario):

- binari (png/jpg/woff/…, 167 file)
- generated: `src/integrations/supabase/types.ts`, `.lovable/mcp/manifest.json`, lockfiles
- vendor/dist (nessuno versionato)
- area `public_asset`, `archive`, `docs_memory`, `ci_config`, `other`, `supabase_other`
- lang `svg`, `markdown`, `text`, `json`, `env`, `lock`

Scope semantico effettivo: **3445 file / 426729 righe**.

## Copertura audit

- File inventariati / totali: **4130 / 4130 (100.00%)**
- Righe totali inventariate: **545596**
- File letti con errore: **0**
- Righe analizzate semanticamente (aree runtime + test + edge + migration + script): **426729 / 545596 (78.21%)**
- Righe non analizzate semanticamente: differenza (asset/binari/doc/archive/generated) → esclusione **intenzionale e motivata**, elencata sopra.

## Validazione

- `inventory.jsonl` è JSONL parsabile (una entry per riga, ognuna JSON valido) → verificato da `analyze.py` e `findings.py` che lo consumano.
- `git ls-files | wc -l` = 4130 = `files_in_manifest` (uguaglianza esatta).
- **Nessuna modifica** fuori `.lovable/audits/complexity/`. Nessun deploy, migration, edit runtime.

## Limitazioni oneste

- La ciclomatica è **stimata** (regex, non AST) → utile per ranking relativo, non per numeri assoluti.
- Import graph solo statico → orfani sono _candidati_, non conferme.
- Nessuna analisi di runtime (bundle-size effettivo, code-splitting Vite) — richiede build che qui è vietata.
- Nessuna analisi RLS/SQL semantica per file `.sql` (solo LOC/marker).
- Findings su regole di soglia (size/cyclo) sono deterministiche ma non sostituiscono ispezione manuale sui top hotspot.
