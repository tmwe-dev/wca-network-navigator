-- F1: v_agent_full unified read-only view (agents + capabilities + personas)
CREATE OR REPLACE VIEW public.v_agent_full AS
SELECT
  a.id AS agent_id,
  a.user_id,
  a.operator_id,
  a.name,
  a.role,
  a.avatar_emoji,
  a.system_prompt,
  a.is_active,
  a.territory_codes,
  a.assigned_tools,
  a.knowledge_base,
  a.schedule_config,
  a.stats,
  a.signature_html,
  a.signature_image_url,
  a.elevenlabs_voice_id,
  a.elevenlabs_agent_id,
  a.voice_call_url,
  a.assigned_tutor_id,
  a.can_send_email,
  a.can_send_whatsapp,
  a.can_access_inbox,
  a.daily_send_limit,
  a.deleted_at,
  a.created_at AS agent_created_at,
  a.updated_at AS agent_updated_at,
  -- capabilities
  c.id AS capability_id,
  c.allowed_tools,
  c.blocked_tools,
  c.approval_required_tools,
  c.max_concurrent_tools,
  c.step_timeout_ms,
  c.max_iterations,
  c.max_tokens_per_call,
  c.temperature,
  c.preferred_model,
  c.execution_mode,
  c.notes AS capability_notes,
  c.updated_at AS capability_updated_at,
  -- persona
  p.id AS persona_id,
  p.tone,
  p.custom_tone_prompt,
  p.language,
  p.style_rules,
  p.vocabulary_do,
  p.vocabulary_dont,
  p.kb_filter,
  p.example_messages,
  p.signature_template,
  p.updated_at AS persona_updated_at,
  -- flags
  (c.id IS NOT NULL) AS has_capabilities,
  (p.id IS NOT NULL) AS has_persona
FROM public.agents a
LEFT JOIN public.agent_capabilities c ON c.agent_id = a.id
LEFT JOIN public.agent_personas p ON p.agent_id = a.id
WHERE a.deleted_at IS NULL;

COMMENT ON VIEW public.v_agent_full IS 'Brain Simplification F1: unified read-only view joining agents + agent_capabilities + agent_personas. Respects existing RLS via underlying tables (security_invoker).';

ALTER VIEW public.v_agent_full SET (security_invoker = true);

GRANT SELECT ON public.v_agent_full TO authenticated;