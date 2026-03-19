

# Piano Completo di Correzione e Code Quality — WCA Network Navigator

Il piano è organizzato in 6 fasi sequenziali per massimizzare l'impatto e minimizzare i rischi di regressione.

---

## Fase 1 — Console Cleanup (86 console.log + 161 console.warn/error)

Rimuovere tutti i `console.log` di debug. Mantenere solo i `console.error` nei catch block critici (GlobalErrorBoundary, download pipeline).

| File | Azione |
|------|--------|
| `src/hooks/useWcaSession.ts` | Rimuovere 12 console.log di step logging |
| `src/pages/Import.tsx` | Rimuovere 5 console.log di mapping debug |
| `src/hooks/useDownloadProcessor.ts` | Rimuovere 1 console.log |
| `src/hooks/useDownloadJobs.ts` | Rimuovere 2 console.log |
| `src/lib/wcaCheckpoint.ts` | Rimuovere 1 console.log |

I `console.error` nei catch (GlobalErrorBoundary, ImportAssistant, GlobalChat, CSVImport, etc.) restano — sono logging legittimo di errori.

---

## Fase 2 — N+1 Query Fix (CardSocialIcons)

**Problema**: `CardSocialIcons` esegue una query `useSocialLinks(partnerId)` per ogni card nella lista partner — N+1 classico.

**Fix**: Creare un hook `useBatchSocialLinks(partnerIds: string[])` che carica tutti i social links in una singola query con `.in("partner_id", ids)`, poi distribuisce i risultati per partner_id. `CardSocialIcons` riceve i link come prop invece di fare fetch autonomo.

| File | Modifica |
|------|----------|
| `src/hooks/useSocialLinks.ts` | Aggiungere `useBatchSocialLinks(ids)` |
| `src/components/partners/shared/CardSocialIcons.tsx` | Accettare `links` come prop, rimuovere hook interno |
| Callers di CardSocialIcons | Passare link dal batch hook |

---

## Fase 3 — Null Safety (crash preventions)

Aggiungere optional chaining e guard dove ci sono accessi non sicuri su valori potenzialmente null/undefined.

| File | Fix |
|------|-----|
| `src/hooks/usePartnerListStats.ts:48-66` | `(p.enrichment_data as any)?.deep_search_at` — già safe con `?.`, ma rimuovere `as any` con tipo appropriato |
| `src/components/partners/CountryWorkbench.tsx:28,77,278` | Stesso pattern `enrichment_data as any` |
| `src/components/import/CompactContactCard.tsx:65-66` | `(c as any).position` → tipizzare prop |
| `src/components/download/JobDataViewer.tsx:98` | `entry.members as any[]` → tipizzare |

---

## Fase 4 — Riduzione `as any` nei file principali

663 occorrenze in 53 file. Priorità ai file con più utilizzi e impatto maggiore.

**Strategia**: Per i cast `supabase.from("table" as any)` — questi sono causati da tipi Supabase auto-generati che non includono tutte le tabelle. Non possiamo modificare `types.ts`. La soluzione è creare helper tipizzati per le tabelle mancanti in un file `src/lib/supabaseHelpers.ts`.

| Gruppo | File principali | Fix |
|--------|----------------|-----|
| Supabase casts | `useEmailDrafts.ts`, `useSortingJobs.ts`, `useActivities.ts` | Creare type assertion helper: `typedFrom<T>(table)` |
| Enrichment data | `CountryWorkbench.tsx`, `usePartnerListStats.ts` | Definire `EnrichmentData` interface in `src/lib/partnerUtils.ts` |
| Component props | `CompactContactCard.tsx`, `Contacts.tsx` | Tipizzare le props correttamente |
| Workspace | `Workspace.tsx:179` | `v as any` → tipizzare `sourceTab` |

---

## Fase 5 — Splitting Componenti Grandi

### 5A. `AcquisizionePartner.tsx` (1.234 righe → ~4 file)

```text
src/pages/AcquisizionePartner.tsx          (~200 righe — orchestrator)
src/hooks/useAcquisitionPipeline.ts        (~400 righe — state + logic)
src/hooks/useAcquisitionResume.ts          (~150 righe — resume/recover logic)  
src/components/acquisition/PipelineControls.tsx (~200 righe — UI bottoni/toolbar)
```

### 5B. `Settings.tsx` (851 righe → ~5 file)

```text
src/pages/Settings.tsx                     (~100 righe — tabs container)
src/components/settings/GeneralSettings.tsx (~150 righe — email, API keys)
src/components/settings/WcaSettings.tsx    (~100 righe — WCA credentials)
src/components/settings/RASettings.tsx     (~80 righe — ReportAziende)
src/components/settings/DataManagement.tsx (~200 righe — export/import/danger zone)
```
I componenti `SubscriptionPanel`, `AIProfileSettings`, `BlacklistManager`, `TemplateManager`, `ContentManager` sono già estratti.

### 5C. `PartnerHub.tsx` (692 righe → ~3 file)

```text
src/pages/PartnerHub.tsx                   (~150 righe — layout + state)
src/components/partners/PartnerListView.tsx (~250 righe — list rendering)
src/hooks/usePartnerHubState.ts            (~200 righe — filters, sorting, selection)
```

### 5D. `EmailComposer.tsx` (656 righe → ~3 file)

```text
src/pages/EmailComposer.tsx                (~150 righe — page container)
src/components/campaigns/DraftEditor.tsx   (~250 righe — form + preview)
src/components/campaigns/RecipientSelector.tsx (~200 righe — recipient logic)
```

---

## Fase 6 — Lock File + Varie

| Issue | Fix |
|-------|-----|
| Due lock file (`package-lock.json` + `bun.lockb`) | Rimuovere `bun.lockb` (il progetto usa npm) |
| `handleConfirmMapping` in Import.tsx | Già fixato nella sessione precedente |
| Portal target in Campaigns.tsx | Aggiungere guard `document.getElementById` |

---

## Riepilogo Esecuzione

| Fase | Scope | File stimati | Rischio |
|------|-------|-------------|---------|
| 1 — Console cleanup | 5 file | 5 | Basso |
| 2 — N+1 query | 3 file + callers | 4-5 | Medio |
| 3 — Null safety | 4 file | 4 | Basso |
| 4 — Type safety | 10-15 file | 15 | Medio |
| 5 — Component splitting | 4 pagine → ~15 file | 15 | Alto |
| 6 — Varie | 2 file | 2 | Basso |

**Totale**: ~45 file modificati/creati, in 6 fasi implementative.

Le fasi 1-3 sono a basso rischio e verranno eseguite per prime. Le fasi 4-5 richiedono attenzione per evitare regressioni.

