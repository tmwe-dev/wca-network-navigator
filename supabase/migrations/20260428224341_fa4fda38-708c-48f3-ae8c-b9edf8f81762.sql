INSERT INTO public.ai_scope_registry (scope, description, enforcement_mode, requires_grounding)
VALUES
  ('kb-supervisor', 'Knowledge Base supervisor / Harmonizer', 'warn', false),
  ('deep-search', 'Deep search / investigator agents', 'warn', false),
  ('chat', 'Generic conversational scope', 'warn', false),
  ('mission-builder', 'Mission builder assistant', 'warn', false),
  ('partner_hub', 'Partner hub assistant', 'warn', false),
  ('cockpit', 'Cockpit assistant', 'warn', false),
  ('contacts', 'Contacts scope', 'warn', false),
  ('import', 'Import wizard scope', 'warn', false),
  ('extension', 'Browser extension scope', 'warn', false)
ON CONFLICT (scope) DO NOTHING;