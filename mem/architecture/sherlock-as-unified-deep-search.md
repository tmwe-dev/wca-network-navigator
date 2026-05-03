---
name: Sherlock motore unico Deep Search
description: Sherlock (Scout/Detective/Sherlock) è l'unico motore Deep Search. Edge deep-search-* cancellate. Tool AI agent restituiscono snapshot read-only e dirottano a Email Forge.
type: constraint
---
# Sherlock = motore unico Deep Search

## Stato (2026-05-03)
- **Sherlock** (`src/v2/services/sherlock/` + tabella `sherlock_playbooks`) è il motore canonico di Deep Search.
- 3 livelli: **Scout** (rapido, gratis), **Detective** (medio), **Sherlock** (completo, AI extract+decide).
- Edge function `deep-search-partner` e `deep-search-contact` **CANCELLATE** (erano già 410).
- Tool AI agent `deep_search_partner` / `deep_search_contact` ora restituiscono snapshot DB + suggerimento di aprire Email Forge → tab Deep Search. **NON chiamano più edge** (file `searchHandler.ts` e `platformToolHandlers/searchTools.ts`).
- Command tool `deepSearchContactTool` è read-only e indirizza a Sherlock.

## Legacy ancora vivo (deliberatamente)
`useDeepSearchLocal` + `useDeepSearchRunner` (batch via estensione Partner Connect) **NON sono stati cancellati** perché scrivono `partners.enrichment_data`, `logo_url`, `website_quality_score`, ratings AI e hanno 13+ caller (Operations, Cockpit, BCA, Import, Enrichment). Cancellarli romperebbe enrichment, logo e ratings. Toast aggiornato per indirizzare a Sherlock se l'estensione manca.

## Roadmap successiva (NON fatta in questo passaggio)
Estendere i playbook Sherlock per scrivere anche `enrichment_data/logo_url/website_quality_score`, poi sostituire `useDeepSearchLocal` in batch. Fino ad allora: legacy resta come back-end per i batch enrichment.

## Regola
Qualsiasi nuovo entry-point Deep Search deve usare `useSherlock` (`src/v2/hooks/useSherlock.ts`). Vietato aggiungere nuovi caller a `useDeepSearchLocal` o ricreare edge `deep-search-*`.