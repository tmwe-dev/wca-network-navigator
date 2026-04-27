
# Fase 1 "Gestione Manuale" — Allineamento finale al documento

## Stato attuale verificato

L'impalcatura del documento Claude è **già in piedi al 90%**:
- ✅ Orchestrator `ManualGroupingTab` (448 righe — sopra il target 200, da snellire)
- ✅ `EmailIntelligenceHeader` (search + counter + "+ Nuovo gruppo")
- ✅ `SenderActionBar` (6 azioni, già funzionanti via DAL `bulkUpdateAutoAction` / `bulkSetBlocked`)
- ✅ `SenderCard` compatta 200px con avatar iniziali, chip AI, ribbon "Selezionato", riga "Ultima"
- ✅ `SenderEmailPreviewPanel` 35% inline
- ✅ `GroupDropZone` con `isHighlighted`, "+ Associa", drag/drop, conteggio regole
- ✅ Sort bar A-Z / N. email / AI smart + Multi-selezione + counter
- ✅ Pill range alfabetico (Tutti / A-D / E-L / M-P / Q-Z) sopra la griglia
- ✅ Prompt AI bar in fondo (stub toast)
- ✅ `useGroupingData` carica `ai_suggested_group` + `is_blocked` + classifiedSenders separati
- ✅ DAL `bulkSetBlocked` con `is_blocked + auto_action='spam'` come da documento

**DB verificato**: `is_blocked`, `ai_suggested_group`, `ai_suggestion_confidence`, `ai_suggestion_accepted` esistono già (no migration necessaria). Su 1311 sender, **0 hanno suggerimenti AI popolati** → i chip AI sono vuoti perché la Fase 2 non ha ancora scritto la colonna.

## Le 5 discrepanze residue dal documento

### 1. `GroupDropZone` ha ancora altezza/larghezza fisse "vecchio stile"
Riga 98: `h-[20vh] w-full min-w-[240px] max-w-[420px]` → blocca il layout 2-colonne responsive del documento. Il documento chiede griglia fluida. Va sostituito con dimensione naturale che riempia la cella della grid `md:grid-cols-2` del parent.

### 2. Rail orizzontale: header del rail è verboso e ruba spazio
Le righe 281-289 di `ManualGroupingTab` mostrano "Mittenti (N) · Trascina su un gruppo · click per anteprima · click chip AI per evidenziare". Il documento mostra solo le card. Va rimosso o ridotto a una sola riga di hint compatta.

### 3. Header pagina V2: l'icona+titolo è ridondante con il tab "Gestione Manuale"
`EmailIntelligencePage.tsx` righe 77-82 hanno ancora "Email Intelligence" con icona. Il documento lo ammette nello shell, ma serve recuperare verticale: ridurre padding orizzontale o spostare il titolo sulla stessa riga dei tab. Lascio la struttura ma riduco i margini per recuperare ~30px.

### 4. `SenderEmailsDialog` ancora aperto al click su `<Mail>` icon nelle card
La card ha `onViewEmails` che apre un Dialog modale (`emailPreviewSender`). Ridondante: ora il preview panel inline a sinistra mostra le stesse email. Va rimosso il Dialog e l'icona Mail (o l'icona deve solo focalizzare il preview panel, non aprire un modale).

### 5. Snellire `ManualGroupingTab` (target ≤200 righe)
448 righe attualmente. Estrarre in 2 piccoli sub-componenti dello stesso file di pagina:
- `<SortBar />` — toggle sort + multi-select + counter (~35 righe)
- `<GroupGridPanel />` — header + pill range + griglia gruppi (~60 righe)
Restano ~180 righe nel file orchestrator.

## Piano di esecuzione

### File da MODIFICARE (4)

| File | Modifica |
|---|---|
| `src/components/email-intelligence/management/GroupDropZone.tsx` | Rimuovere `h-[20vh] w-full min-w-[240px] max-w-[420px]` dal wrapper. Sostituire con `h-full` per riempire la cella grid. Adattare `CardContent` per altezza dinamica. |
| `src/components/email-intelligence/ManualGroupingTab.tsx` | (a) Estrarre `SortBar` e `GroupGridPanel` come componenti locali nel file. (b) Rimuovere header verboso del rail (righe 281-289), tenere solo "Mittenti (N)" sottile. (c) Rimuovere `emailPreviewSender` state + `SenderEmailsDialog` import e JSX (righe 432-439). (d) Rimuovere `onViewEmails` dalla SenderCard. |
| `src/components/email-intelligence/management/SenderCard.tsx` | Rimuovere prop `onViewEmails` e icona `<Mail>` button (righe 192-201). Il preview panel inline gestisce la visualizzazione email del sender focalizzato. |
| `src/v2/ui/pages/EmailIntelligencePage.tsx` | Ridurre padding pagina da `p-3 md:p-4 gap-3` a `p-2 md:p-3 gap-2`. Compattare l'header (rimuovere il box icona, ridurre h1 a `text-sm`). |

### File da NON toccare (già conformi al documento)
- `EmailIntelligenceHeader.tsx`, `SenderActionBar.tsx`, `SenderEmailPreviewPanel.tsx`
- `useGroupingData.ts`, `useFilterAndSort.ts`, `useDragAndDrop.ts`, `useGroupAssignment.ts`, `useSelectionState.ts`
- `data/emailAddressRules.ts` (DAL `bulkSetBlocked` + `bulkUpdateAutoAction` già conformi)
- `ExportSendersDialog.tsx`, `CreateCategoryDialog.tsx`, `BulkEmailActions.tsx`, `RulesConfiguration.tsx`
- `AISuggestionsTab`, `SmartInboxView`, `RulesAndActionsTab` (Fase 2/3)

### File da NON creare
- ~~SenderAIPromptBar.tsx separato~~ → resta inline nell'orchestrator come stub (decisione del documento, opzione "a")
- ~~Nuove migration~~ → DB già conforme

## Risultato atteso visivo

```
┌──────────────────────────────────────────────────────────────────┐
│ Email Intelligence │ [Gestione Manuale|Suggerimenti AI|Auto|Regole] │  ← compattato
├──────────────────────────────────────────────────────────────────┤
│ [🔍 Cerca]                                          [+ Nuovo]    │
│ Azioni per MSC: [Regole][Lette][Elimina][Esporta][Blocca][Prompt]│
│ [A-Z][N.email][AI smart] ☐Multi  ·  N da smistare · M classificati│
├──────────────────────────────────────────────────────────────────┤
│ ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐ ← rail orizzontale, no header verboso│
│ └──┘└──┘└──┘└──┘└──┘└──┘└──┘                                      │
├──────────────┬───────────────────────────────────────────────────┤
│ Email da MSC │ Gruppi (N)              [A→Z ▾]                   │
│ ▸ Booking…   │ [Tutti][A-D][E-L][M-P][Q-Z]                       │
│ ▸ Rate…      │ ┌──────────┐ ┌──────────┐                          │
│              │ │Operativo │ │Commerc.  │  ← griglia 2 col fluida  │
│              │ │  18      │ │  24      │                          │
│              │ └──────────┘ └──────────┘                          │
│              │ ┌──────────┐ ┌──────────┐                          │
│              │ │Amminis.  │ │Dogana    │                          │
│              │ │  12      │ │  8       │                          │
│              │ └──────────┘ └──────────┘                          │
├──────────────────────────────────────────────────────────────────┤
│ ✨ Chiedi all'AI di analizzare un mittente…       [Analizza]    │
└──────────────────────────────────────────────────────────────────┘
```

## Note importanti

- **I chip AI restano vuoti finché la Fase 2 non popola `ai_suggested_group`**. Verificato sul DB: 0/1311 sender hanno suggerimento. La label "Nessun suggerimento AI" è il comportamento corretto attuale.
- **Niente nuove tabelle, niente migration, niente edge function**.
- **Nessuna modifica a `EmailIntelligencePage` oltre a compattazione visuale** — i 4 tab restano.
- Verifica finale con `tsc --noEmit` prima di chiudere.
