

# Piano: Download Corpo Email + Allegati con deno-imap

## Situazione

La libreria `@workingdevshero/deno-imap` supporta nativamente:
- `bodyStructure: true` nel fetch per ottenere la struttura MIME
- `hasAttachments()` / `findAttachments()` per individuare allegati
- `decodeAttachment()` per decodificarli
- Fetch di sezioni MIME specifiche (es. `BODY[1]` per text/plain, `BODY[1.1]` per HTML)

Attualmente il fetch usa `body: true` ma il corpo arriva vuoto perché serve il fetch per sezione MIME specifica.

## Modifiche

### 1. Edge Function `check-inbox/index.ts`

- Importare le utility: `hasAttachments`, `findAttachments`, `decodeAttachment`
- Prima fetch: ottenere `envelope` + `bodyStructure` per tutti i messaggi
- Analizzare la bodyStructure per trovare le sezioni text/plain e text/html
- Seconda fetch per UID: richiedere `BODY[sezione]` per il testo e per ogni allegato
- Per ogni allegato: decodificare con `decodeAttachment()`, uploadare su Storage bucket `workspace-docs` nel path `email-attachments/{userId}/{messageId}/{filename}`
- Salvare `body_text` e `body_html` in `channel_messages`
- Registrare ogni allegato nella nuova tabella `email_attachments`
- Limiti di sicurezza: max 10 allegati per email, max 10MB per file

### 2. Migrazione SQL — Nuova tabella `email_attachments`

```sql
CREATE TABLE public.email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES channel_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email_attachments"
  ON public.email_attachments FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 3. Flusso per ogni messaggio

```text
1. fetch(uids, { envelope, bodyStructure })
2. Per ogni msg:
   a. Trova sezione text/plain → fetch BODY[sezione] → body_text
   b. Trova sezione text/html → fetch BODY[sezione] → body_html
   c. Se hasAttachments(bodyStructure):
      - findAttachments() → lista {filename, section, encoding, size}
      - Per ogni allegato ≤10MB:
        fetch BODY[section] → decodeAttachment() → upload Storage
        insert in email_attachments
3. Upsert channel_messages con body_text + body_html
```

### File coinvolti

| File | Azione |
|------|--------|
| `supabase/functions/check-inbox/index.ts` | Aggiungere import utility, fetch bodyStructure, estrarre corpo e allegati, upload su Storage |
| Migrazione SQL | Creare tabella `email_attachments` con RLS |

### Note tecniche

- La libreria è la stessa (`@workingdevshero/deno-imap`), nessun cambio di dipendenze
- Il bucket `workspace-docs` esiste già (privato) — perfetto per gli allegati
- La colonna `body_html` esiste già in `channel_messages` ma non viene popolata — ora lo faremo
- Il fetch per sezione MIME potrebbe richiedere fetch individuali per UID (un fetch per sezione per messaggio), quindi per evitare timeout limitiamo a 20 messaggi per sync invece di 50

