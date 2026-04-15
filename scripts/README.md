# Scripts

## seed:kb — Popola la Knowledge Base

Legge tutti i file `.md` da `public/kb-source/` (ricorsivamente) e li carica nella tabella `kb_entries` via upsert su `source_path`.

Supporta `public/kb-source/index.json` come fonte autoritativa di metadati (title, tags, slug, category, priority). Se assente, fallback a frontmatter e path.

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

### Formato index.json

```json
{
  "version": 1,
  "entries": [
    {
      "path": "01-intro.md",
      "slug": "intro",
      "title": "Introduzione al Sistema",
      "tags": ["intro", "overview"],
      "category": "general",
      "priority": 10
    }
  ]
}
```

### Comportamento

- Ogni file viene inserito o aggiornato (upsert su `source_path`).
- Se `index.json` è presente, title/tags/category/priority vengono da lì.
- Altrimenti: `title` dal primo heading `# ...`, `tags` dal frontmatter, `category` dalla sottocartella.
- File già presenti vengono aggiornati, non duplicati.
