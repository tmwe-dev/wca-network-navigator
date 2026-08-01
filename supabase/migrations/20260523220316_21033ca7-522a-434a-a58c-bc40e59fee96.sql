-- Sprint B — normalize 2 prompts whose `context` was incorrectly storing
-- a full sentence instead of the SCOPE_TO_PROMPT_CONFIG slug.
-- The original sentence is preserved by prepending it to the `objective` so
-- no semantic content is lost.

UPDATE public.operative_prompts
SET objective = '[ex-context] ' || context || E'\n\n' || COALESCE(objective, ''),
    context = 'multi-channel'
WHERE id = 'a5331247-6820-4303-b1a8-454dd4baf76c'
  AND context LIKE 'Scriviamo%';

UPDATE public.operative_prompts
SET objective = '[ex-context] ' || context || E'\n\n' || COALESCE(objective, ''),
    context = 'email-quality'
WHERE id = 'f159d4e3-d6f6-4f61-b222-56a20027a150'
  AND context LIKE '[Ambito%';
