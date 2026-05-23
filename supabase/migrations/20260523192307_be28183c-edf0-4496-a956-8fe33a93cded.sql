
-- ============================================================
-- Sprint chiusura cerchio: sync legacy → SSOT operative_prompts
-- 2026-05-23
-- ============================================================

-- 1) Funzione mirror: email_prompts → operative_prompts
CREATE OR REPLACE FUNCTION public.mirror_email_prompt_to_operative()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- Trova ancora esistente (record migrato F6.5a o mirror precedente)
  SELECT id INTO v_existing_id
  FROM public.operative_prompts
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
    AND name = COALESCE(NEW.title, OLD.title)
    AND context = 'email'
    AND ('from_email_prompts' = ANY(tags) OR 'mirror_from_email_prompts' = ANY(tags))
  LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.operative_prompts
      SET is_active = false,
          updated_at = now()
      WHERE id = v_existing_id;
    END IF;
    RETURN OLD;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.operative_prompts
    SET name = NEW.title,
        objective = COALESCE(NEW.instructions, ''),
        procedure = COALESCE(NEW.instructions, ''),
        priority = COALESCE(NEW.priority, 0),
        is_active = COALESCE(NEW.is_active, true),
        tags = ARRAY['mirror_from_email_prompts', COALESCE(NEW.scope, 'global')],
        updated_at = now()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.operative_prompts (
      user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active
    ) VALUES (
      NEW.user_id,
      NEW.title,
      'email',
      COALESCE(NEW.instructions, ''),
      COALESCE(NEW.instructions, ''),
      '',
      '',
      ARRAY['mirror_from_email_prompts', COALESCE(NEW.scope, 'global')],
      COALESCE(NEW.priority, 0),
      COALESCE(NEW.is_active, true)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Mai bloccare la scrittura legacy: degrada silently
  RAISE WARNING 'mirror_email_prompt_to_operative failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2) Funzione mirror: prompt_templates → operative_prompts
CREATE OR REPLACE FUNCTION public.mirror_prompt_template_to_operative()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.operative_prompts
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
    AND name = COALESCE(NEW.name, OLD.name)
    AND context = 'classification'
    AND ('from_prompt_templates' = ANY(tags) OR 'mirror_from_prompt_templates' = ANY(tags))
  LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.operative_prompts
      SET is_active = false, updated_at = now()
      WHERE id = v_existing_id;
    END IF;
    RETURN OLD;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.operative_prompts
    SET name = NEW.name,
        objective = COALESCE(NEW.prompt_text, ''),
        procedure = COALESCE(NEW.prompt_text, ''),
        tags = ARRAY['mirror_from_prompt_templates', COALESCE(NEW.category, 'general')],
        updated_at = now()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.operative_prompts (
      user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active
    ) VALUES (
      NEW.user_id,
      NEW.name,
      'classification',
      COALESCE(NEW.prompt_text, ''),
      COALESCE(NEW.prompt_text, ''),
      '',
      '',
      ARRAY['mirror_from_prompt_templates', COALESCE(NEW.category, 'general')],
      0,
      true
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'mirror_prompt_template_to_operative failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) Trigger
DROP TRIGGER IF EXISTS trg_mirror_email_prompts ON public.email_prompts;
CREATE TRIGGER trg_mirror_email_prompts
AFTER INSERT OR UPDATE OR DELETE ON public.email_prompts
FOR EACH ROW EXECUTE FUNCTION public.mirror_email_prompt_to_operative();

DROP TRIGGER IF EXISTS trg_mirror_prompt_templates ON public.prompt_templates;
CREATE TRIGGER trg_mirror_prompt_templates
AFTER INSERT OR UPDATE OR DELETE ON public.prompt_templates
FOR EACH ROW EXECUTE FUNCTION public.mirror_prompt_template_to_operative();

-- 4) Documentazione deprecazione
COMMENT ON TABLE public.email_prompts IS
  'DEPRECATED 2026-05-23 (Brain Simplification F6.5/F7). SSOT spostato in operative_prompts (context=email). Sync bidirezionale via trigger trg_mirror_email_prompts. Drop fisico previsto dopo 30gg di osservazione.';

COMMENT ON TABLE public.prompt_templates IS
  'DEPRECATED 2026-05-23 (Brain Simplification F6.5/F7). SSOT spostato in operative_prompts (context=classification). Sync bidirezionale via trigger trg_mirror_prompt_templates. Drop fisico previsto dopo 30gg di osservazione.';
