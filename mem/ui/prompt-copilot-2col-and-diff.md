---
name: Prompt Co-pilot — 2 colonne + Diff Viewer
description: Layout responsive del Co-pilot del Prompt Reader (proposta SX, chat DX) con ResizeObserver soglia 720px; DiffViewer riutilizzabile per before/after; diff_text persistito in prompt_change_proposals.
type: feature
---
- `src/v2/ui/pages/prompt-lab/PromptCopilotPanel.tsx`: prop `compactWidth` decide row vs col. Sopra 720px due colonne 50/50; sotto torna verticale (proposta sopra, chat sotto).
- `src/v2/ui/pages/prompt-lab/PromptReaderPage.tsx`: `ResizeObserver` sul wrapper del Co-pilot misura larghezza pannello e propaga `compactWidth`. Re-evaluato a ogni cambio `expandedPanel`/`sidebarOpen`.
- `src/lib/textDiff.ts`: utility `computeLineDiff(before, after)` (LCS) + `buildDiffText` per persistenza.
- `src/v2/ui/pages/prompt-lab/components/DiffViewer.tsx`: render line-by-line con righe rosse/verdi; statistiche `+N −N`; max-h 420px scrollabile.
- Co-pilot mostra il diff PRIMA del testo completo (collassato in `<details>`) → si vede subito cosa cambia.
- `savePromptProposal()` ora popola `diff_text` su `prompt_change_proposals` via `buildDiffText`.
- `ProposalsReviewPage` mostra il `DiffViewer` sotto il confronto a 2 colonne (sempre calcolato runtime; il campo DB è ridondante ma utile per audit/export).
