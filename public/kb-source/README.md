# Knowledge Base Source

Inserisci qui i file `.md` della KB operativa e il file `index.json` con i metadati.

Struttura prevista:
```
kb-source/
  index.json          ← metadati (title, tags, slug) per ogni doc
  01-intro.md
  02-workflow.md
  ...
  workflow/
    wf-create-campaign.md
    wf-partner-onboard.md
    ...
```

Dopo aver inserito i file, esegui:
```bash
npm run seed:kb
```
