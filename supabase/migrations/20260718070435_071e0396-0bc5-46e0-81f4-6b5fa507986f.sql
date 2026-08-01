
UPDATE public.ai_routing_config
SET provider = 'openai',
    model = CASE
      WHEN tier = 'heavy' THEN 'gpt-4o'
      ELSE 'gpt-4o-mini'
    END,
    updated_at = now(),
    notes = notes || ' [forced-openai 2026-07-18]'
WHERE provider <> 'openai';
