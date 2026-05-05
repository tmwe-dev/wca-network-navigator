---
name: Edge Functions as Pseudo-Agents in Simulator
description: Le edge AI (suggest-email-groups, classify-*, funnemail-classify, improve-email, generate-outreach, ecc.) sono esposte come pseudo-agenti `fn:*` nel Prompt Lab Simulator
type: feature
---
Registry: `supabase/functions/_shared/edgeFnPromptRegistry.ts` mappa ogni edge AI a {basePrompt statico, loaderOptions per loadOperativePrompts, defaultModel}.

agent-simulate gestisce due rami:
- `agentId` UUID normale → flusso agenti esistente (persona+capabilities+tools).
- `agentId` con prefisso `fn:` → carica spec dal registry, assembla `basePrompt + loadOperativePrompts(spec.loaderOptions)`, niente persona/capabilities/tools.
- `body.listEdgeFns: true` → ritorna l'elenco pseudo-agenti per popolare il dropdown UI.

UI: `SimulatorTab.tsx` mostra due gruppi nel select (Agenti / Edge functions AI). DAL: `listEdgeFnPseudoAgents()` in `src/data/agentSimulator.ts`.

Caveat: il basePrompt nel registry è una COPIA STATICA del prompt hardcoded nell'edge. Se cambi l'edge in produzione devi aggiornare anche il registry (TODO futuro: estrarre tutti i base prompt in `_shared/prompts/` per SSOT).
