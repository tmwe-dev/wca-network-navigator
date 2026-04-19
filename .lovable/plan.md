

L'utente vuole aggiungere nella stessa sezione "Backup & Export" la capacità di **importare documenti** (PDF, DOCX, TXT, MD) che vengano:
1. Analizzati / estratti
2. Spezzettati (chunking)
3. Embeddati
4. Inseriti in `kb_entries` (con embedding) in modo da essere richiamabili via `match_kb_entries` (RAG).

E vuole sapere **dove sta** e **come si chiama** il sistema che oggi processa i dati per la KB e i prompt dinamici.

## Cosa esiste già nel sistema (mappa)

Dalla ricognizione che ho fatto in precedenza e dai file in contesto:

**Pipeline RAG già esistente:**
- `supabase/functions/_shared/embeddings.ts` — wrapper embeddings via Lovable AI Gateway (`text-embedding-3-small`, 1536 dim) + `ragSearchKb()` che chiama la RPC `match_kb_entries`.
- Tabella `kb_entries` con colonna `embedding vector(1536)` e RPC `match_kb_entries` (filtro per categoria, soglia, priorità).
- DAL `src/data/kbEntries.ts` per CRUD KB.
- Tabella `workspace_documents` (con `extracted_text`) + DAL `src/data/workspaceDocs.ts` — esiste già una pipeline di upload documenti separata, ma NON alimenta automaticamente `kb_entries`.
- Edge function `ai-backup` (export tecnico) e nuovo `AIExportPanel` (export ZIP leggibile) appena creati.

**Manca:** un'edge function che faccia il ciclo completo *Upload → Estrazione testo → Chunking → Embedding → INSERT in `kb_entries`*.

Il "sistema che processa i dati per i prompt dinamici" che l'utente cerca è quindi composto da due pezzi:
- **`_shared/embeddings.ts`** (generazione vettori + retrieval RAG)
- **RPC `match_kb_entries`** (recupero rilevanti) usata dagli agenti per assemblare il contesto nei prompt dinamici (vedi `ai-gateway-and-budgeting` in memoria)

Oggi però non c'è un **ingester** end-to-end per documenti caricati dall'utente. Lo costruiamo.

## Piano implementazione

### 1. Edge function `kb-ingest-document`

Nuovo file `supabase/functions/kb-ingest-document/index.ts`:
- Input: `{ fileName, mimeType, content (base64 o testo), category?, chapter?, priority?, tags? }`
- Estrazione testo:
  - `text/plain`, `text/markdown` → uso diretto
  - `application/pdf` → `pdf-parse` via npm: `npm:pdf-parse`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX) → `npm:mammoth`
- Chunking: ~1000 caratteri con overlap 150 (split per paragrafi/frasi)
- Embedding batch via `_shared/embeddings.ts` (`embedBatch`)
- INSERT multipla in `kb_entries` con: stesso `category` (default `imported_documents`), `chapter` = nome file, `title` = `nomefile — chunk N/Tot`, `content` = chunk, `embedding`, `tags` = `[...userTags, 'auto-imported']`, `priority` (default 5), `user_id`, `source_path` = nome file.
- Ritorna `{ chunks_created, total_chars, kb_ids }`.
- CORS, JWT validation, `securityHeaders.ts`.

### 2. Componente UI `KBIngestPanel.tsx`

Nuovo `src/components/settings/KBIngestPanel.tsx`:
- Drop zone / file input (multi-file: PDF, DOCX, TXT, MD; max 10MB ciascuno)
- Form per ogni file: categoria (dropdown con quelle esistenti + free text), capitolo, priorità (1-10), tags
- Bottone "Analizza e indicizza" → per ogni file:
  1. Legge come base64
  2. Chiama edge function `kb-ingest-document`
  3. Mostra progress + n. chunks creati
- Toast finale + invalidazione `queryKeys.v2.kbEntries()` per ricaricare l'elenco KB.

### 3. Mount in `BackupExportTab.tsx`

Aggiungo il `KBIngestPanel` come terza card sopra a `AIExportPanel` e `AIBackupPanel`, in sezione dedicata "Importa Knowledge Base".

### 4. Risposta alla domanda dell'utente (in chat)

Spiego che il sistema che processa i dati è:
- **`supabase/functions/_shared/embeddings.ts`** (genera vettori, fa retrieval RAG)
- **RPC `match_kb_entries`** (recupera schede rilevanti per la query)
- **`kb_entries.embedding`** (colonna `vector(1536)` su cui viene calcolata la similarità)
- Gli agenti pescano da qui via `ragSearchKb()` quando assemblano il contesto del prompt dinamico.

## Struttura risultante

```text
Settings → Backup & Export
  ├─ [NUOVO] Importa Knowledge Base (KBIngestPanel)
  │     • Carica PDF/DOCX/TXT/MD
  │     • Estrae → chunk → embedda → salva in kb_entries
  ├─ Esporta tutto leggibile (AIExportPanel) — già fatto
  └─ Backup tecnico JSON (AIBackupPanel) — già fatto
```

## File toccati / creati

- **CREA** `supabase/functions/kb-ingest-document/index.ts` (~180 LOC, sotto budget)
- **CREA** `src/components/settings/KBIngestPanel.tsx` (~200 LOC)
- **MODIFICA** `src/components/settings/BackupExportTab.tsx` (aggiungo card KBIngestPanel in cima)

Nessuna migration DB necessaria: `kb_entries.embedding` esiste già, RPC `match_kb_entries` esiste già.

## Dipendenze

Solo lato edge function (Deno, via `npm:` specifier):
- `npm:pdf-parse@1.1.1`
- `npm:mammoth@1.7.0`

Nessuna dipendenza nuova lato client.

