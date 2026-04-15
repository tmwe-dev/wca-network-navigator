# Scripts

## seed:kb — Popola la Knowledge Base

Legge tutti i file `.md` da `public/kb-source/` (ricorsivamente) e li carica nella tabella `kb_entries` via upsert su `source_path`.

### Prerequisiti

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

### Uso

```bash
# 1. Sostituisci i placeholder in public/kb-source/ con i contenuti reali
# 2. Esegui il seed
npm run seed:kb
```

### Comportamento

- Ogni file viene inserito o aggiornato (upsert su `source_path`).
- Il `title` viene estratto dal primo heading `# ...` nel file, oppure dal frontmatter `title:`.
- I `tags` vengono estratti dal frontmatter `tags: [...]`.
- La `category` viene derivata dalla sottocartella (es. `workflow/` → category `workflow`).
- File già presenti vengono aggiornati, non duplicati.
