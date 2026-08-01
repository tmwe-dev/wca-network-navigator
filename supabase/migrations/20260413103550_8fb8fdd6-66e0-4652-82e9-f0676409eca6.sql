-- Add columns to email_address_rules
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS group_name text;
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS group_color text DEFAULT '#3B82F6';
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS group_icon text DEFAULT '📧';
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS group_description text;
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS custom_prompt text;
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS email_count integer DEFAULT 0;
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE email_address_rules ADD COLUMN IF NOT EXISTS company_name text;

CREATE INDEX IF NOT EXISTS idx_ear_group_name ON email_address_rules(group_name) WHERE group_name IS NOT NULL;

-- Create email_sender_groups table
CREATE TABLE IF NOT EXISTS public.email_sender_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome_gruppo text NOT NULL,
  descrizione text,
  colore text NOT NULL DEFAULT '#3B82F6',
  icon text DEFAULT '📧',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, nome_gruppo)
);

ALTER TABLE public.email_sender_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sender groups"
  ON public.email_sender_groups
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_email_sender_groups_updated_at
  BEFORE UPDATE ON public.email_sender_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.email_sender_groups;