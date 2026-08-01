---
name: Brain Legacy Mirror Triggers
description: Trigger DB che sincronizzano email_prompts e prompt_templates verso operative_prompts (SSOT). Permettono ai 28+ consumer di restare invariati fino a F7 (drop +30gg).
type: feature
---

## Cosa
Trigger `trg_mirror_email_prompts` e `trg_mirror_prompt_templates` (2026-05-23) propagano ogni INSERT/UPDATE/DELETE sulle tabelle legacy verso `operative_prompts`:
- `email_prompts` → context='email', tag `mirror_from_email_prompts`
- `prompt_templates` → context='classification', tag `mirror_from_prompt_templates`

## Perché
Chiusura cerchio Brain Simplification Plan (F6.5/F7) senza riscrivere i 28+ consumer (Harmonizer, Prompt Lab, Edge AI, Composer V2). SSOT runtime è operative_prompts; legacy resta solo come shadow di compatibilità.

## Stato
- 3 email_prompts + 8 prompt_templates già specchiati
- Trigger idempotenti, SECURITY DEFINER, search_path=public
- Errori degradano silently (WARNING) per non bloccare scritture legacy
- DELETE legacy → soft-disable (is_active=false) nel SSOT

## Rollback
```sql
DROP TRIGGER trg_mirror_email_prompts ON email_prompts;
DROP TRIGGER trg_mirror_prompt_templates ON prompt_templates;
DROP FUNCTION mirror_email_prompt_to_operative();
DROP FUNCTION mirror_prompt_template_to_operative();
DELETE FROM operative_prompts WHERE 'mirror_from_email_prompts' = ANY(tags) OR 'mirror_from_prompt_templates' = ANY(tags);
```

## F7 (drop fisico)
Dopo 30gg di osservazione (target 2026-06-23): DROP delle tabelle legacy + rimozione consumer dead code. Vedi `mem://standards/brain-simplification-plan-2026-05-23`.
