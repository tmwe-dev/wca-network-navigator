
CREATE TABLE IF NOT EXISTS public.outreach_timing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  description text,
  is_system boolean DEFAULT false,
  source_type text NOT NULL CHECK (source_type IN ('wca_partners','contacts','business_cards','mixed')),
  goal text NOT NULL CHECK (goal IN ('primo_contatto','follow_up','nurturing','reactivation','event_followup','partnership_proposal','info_request')),
  sequence jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_attempts integer DEFAULT 3,
  total_duration_days integer,
  preferred_language text DEFAULT 'auto',
  auto_translate boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.outreach_timing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates or view system"
  ON public.outreach_timing_templates
  FOR ALL
  USING (auth.uid() = user_id OR is_system = true)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_outreach_timing_templates_updated_at
  BEFORE UPDATE ON public.outreach_timing_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
