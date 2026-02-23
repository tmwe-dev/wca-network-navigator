
-- Add selected_contact_id and campaign_batch_id to activities table
ALTER TABLE public.activities
  ADD COLUMN selected_contact_id uuid REFERENCES public.partner_contacts(id) ON DELETE SET NULL,
  ADD COLUMN campaign_batch_id text;

-- Index for faster lookups
CREATE INDEX idx_activities_selected_contact ON public.activities(selected_contact_id) WHERE selected_contact_id IS NOT NULL;
CREATE INDEX idx_activities_campaign_batch ON public.activities(campaign_batch_id) WHERE campaign_batch_id IS NOT NULL;
CREATE INDEX idx_activities_status ON public.activities(status);
CREATE INDEX idx_activities_due_date ON public.activities(due_date) WHERE due_date IS NOT NULL;
