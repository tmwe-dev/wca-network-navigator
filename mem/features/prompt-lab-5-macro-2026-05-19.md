---
name: Prompt Lab 5 Macro 2026-05-19
description: PROMPT_LAB_GROUPS ridotto a 5 macroaree (prompts/personas/capabilities/tests/health)
type: feature
---
File: `src/v2/ui/pages/prompt-lab/types.ts`. 5 macro:
- prompts: system_prompt, kb_doctrine, ai_profile, operative, email, voice, playbooks, journalists, operative_kb, administrative_kb, support_kb, domain_routing
- personas: personas
- capabilities: capabilities
- tests: simulator, tests, history
- health: audit, routing, super_mario

Componenti tab non toccati. `PromptLabPage.tsx` aggiornato (GROUP_ICONS + default "prompts"). Icone: Library/Users/ShieldCheck/FlaskConical/Brain.