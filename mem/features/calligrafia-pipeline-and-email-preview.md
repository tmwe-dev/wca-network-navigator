---
name: Calligrafia Pipeline Visibility + Email Preview
description: Stage Calligrafia visibile in EmailPipelineBadge (compose-email tool) e pulsante Anteprima email read-only in ComposerCanvas (DOMPurify, no invio)
type: feature
---
**Calligrafia.** KB entry `kb_entries.category='calligrafia'` iniettata da `_shared/calligrafiaInjector.ts` (`buildCalligrafiaSection`) in `generate-email`, `generate-outreach`, `improve-email`. Modifica via `/v2/prompt-lab` (Knowledge Base, categoria `calligrafia`), live senza redeploy.

**UI.** Stage `calligrafia` aggiunto in `composeEmail.ts → buildEmailPipeline()` tra Prompt Lab e Giornalista. Status segue `generationOk`. Solo cosmetico.

**Anteprima.** `EmailPreviewDialog.tsx`: modal Dialog shadcn, sanitizza body con DOMPurify, mostra A/Oggetto/Corpo come renderizzato, toggle HTML grezzo. Disclaimer "firma e footer aggiunti server-side". Pulsante Eye in toolbar di `ComposerCanvas`. Pure read, nessuna mutazione.
