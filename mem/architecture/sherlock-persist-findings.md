---
name: Sherlock — persistenza completa findings su partner
description: A fine run Sherlock (agenticEngine.finishRun + sherlockEngine.runSherlock) persistSherlockFindings(partnerId, consolidated) scrive website/phone/email/address sui campi colonna SOLO se vuoti, e merge additivo di tutti gli altri findings in partners.enrichment_data.sherlock con timestamp _last_run_at. UI invalidation già coperta da invalidateEnrichmentCaches in useSherlock.
type: feature
---
**Why:** prima venivano scritti solo `website` e `linkedin_url`, tutto il resto (emails, phones, services, team, ecc.) restava nel record investigation e le card del Network non si aggiornavano.

**How to apply:** non sovrascrivere mai campi colonna già popolati. Tutto il resto va in enrichment_data.sherlock come merge additivo. Helper in `src/data/partners.ts::persistSherlockFindings`.
