---
name: WCA Bridge Functions Preserved
description: Le 4 edge function WCA (save-wca-cookie/contacts, process-download-job, get-wca-credentials) NON sono morte: sono il backbone del download WCA Navigator via estensione. Mai cancellare.
type: constraint
---
Le seguenti edge function sono usate ESCLUSIVAMENTE dall'estensione Chrome WCA Navigator (non dall'app o dall'AI):
- `save-wca-cookie` — estensione salva cookie sessione
- `save-wca-contacts` — ingestion contatti scaricati dall'estensione
- `process-download-job` — tracker stato job download
- `get-wca-credentials` — estensione fetch credenziali utente

**Why:** sembrano morte perché non hanno caller nell'app, ma cancellarle rompe il WCA Navigator bridge. Sono protette da `requireExtensionAuth`.

**How to apply:** non includerle nei test del pannello diagnostico (`src/hooks/diagnostics/types.ts`) perché senza header dell'estensione restituiscono 401 → falso `Failed to fetch`. Le 3 funzioni `scrape-wca-*` invece NON esistono: rimosse dalla diagnostics il 2026-05-15.
