
DROP VIEW IF EXISTS public.ai_memory_pending_embedding;
CREATE VIEW public.ai_memory_pending_embedding WITH (security_invoker = true) AS
SELECT id, content, memory_type, level, created_at
FROM public.ai_memory
WHERE embedding IS NULL OR embedding_updated_at IS NULL
ORDER BY level DESC, created_at DESC;
