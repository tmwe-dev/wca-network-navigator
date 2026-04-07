
-- Add exclusive agent assignment to email address rules
ALTER TABLE public.email_address_rules
ADD COLUMN exclusive_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL DEFAULT NULL;

-- Add index for fast lookup by agent
CREATE INDEX idx_email_address_rules_agent ON public.email_address_rules(exclusive_agent_id) WHERE exclusive_agent_id IS NOT NULL;
