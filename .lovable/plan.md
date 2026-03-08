

## Analisi Deframmentazione Progetto

### Stato attuale: il progetto è ben strutturato

Ho analizzato tutti i 292 file TypeScript/TSX del progetto. La maggior parte segue la regola delle 600 righe massime grazie alle precedenti operazioni di splitting. Ecco il quadro completo:

### File che superano la soglia (>600 righe) — da splittare

| File | Righe | Azione suggerita |
|---|---|---|
| `src/hooks/useAcquisitionPipeline.tsx` | **997** | Estrarre le funzioni di scraping, validazione e salvataggio in moduli separati (`lib/acquisition/`) |
| `src/pages/Import.tsx` | **982** | Estrarre la logica di stato e parsing in un hook `useImportWizard`, spostare i sotto-pannelli in componenti dedicati |

### File nella zona grigia (500-600 righe) — monitorare

| File | Righe | Note |
|---|---|---|
| `src/components/partners/PartnerDetailFull.tsx` | 575 | Già splittato in passato, sotto soglia |
| `src/pages/EmailComposer.tsx` | 571 | Già splittato (RecipientSelector estratto), sotto soglia |
| `src/pages/PartnerHub.tsx` | 529 | Già splittato (PartnerListItem estratto), sotto soglia |

### File auto-generati (non toccare)

| File | Righe | Note |
|---|---|---|
| `src/integrations/supabase/types.ts` | 2054 | Auto-generato dal backend, non modificabile |

### Il Cockpit è perfetto

Tutti i file del Cockpit sono ben sotto soglia:
- `Cockpit.tsx`: 276 righe
- `AIDraftStudio.tsx`: 264 righe  
- `TopCommandBar.tsx`: 160 righe
- `ContactStream.tsx`: 118 righe
- `CockpitContactCard.tsx`: ~170 righe
- `ChannelDropZones.tsx`: 88 righe

### Piano di deframmentazione (2 file)

**1. `useAcquisitionPipeline.tsx` (997 → ~3 file da ~330)**
- `src/hooks/useAcquisitionPipeline.tsx` — orchestratore principale (stato, effetti)
- `src/lib/acquisition/scrapeEngine.ts` — logica di scraping e retry
- `src/lib/acquisition/pipelineActions.ts` — azioni (start, pause, resume, save)

**2. `src/pages/Import.tsx` (982 → ~3 file da ~330)**
- `src/pages/Import.tsx` — layout e routing tab
- `src/hooks/useImportWizard.ts` — stato del wizard, step logic
- `src/components/import/ImportStepPanels.tsx` — pannelli dei singoli step

### Conclusione

Il progetto è **già ben ottimizzato** — solo 2 file su 292 superano la soglia. Tutto il resto, incluso il Cockpit, rispetta gli standard architetturali. La deframmentazione riguarda solo questi 2 file legacy.

