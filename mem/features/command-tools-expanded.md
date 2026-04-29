---
name: Command Tools Expansion 2026-04-29
description: Aggiunti 6 tool a Command (send-whatsapp, send-linkedin, launch-mission, daily-briefing, parse-business-card, kb-ingest-document) + scope "command" nel Prompt Lab loader + 6 KB entries globali (category=command_tools) + 2 prompt operativi OBBLIGATORIA per ogni utente
type: feature
---
Modifiche:
- src/v2/ui/pages/command/tools/{sendWhatsapp,sendLinkedin,launchMission,dailyBriefing,parseBusinessCard,kbIngestDocument}.ts
- registry.ts: registra i 6 tool, write tool richiedono approval
- _shared/operativePromptsLoader.ts: nuovo PromptScope "command" → contexts:["command"], tags:["command","tool-routing","router"]
- ai-assistant/index.ts + modeHandlers.ts: in tool-decision e plan-execution carica blocco prompt scope=command e lo accoda al system prompt
- DB: 6 kb_entries (user_id NULL, category='command_tools') + 10 operative_prompts (5 utenti × 2 prompt)
