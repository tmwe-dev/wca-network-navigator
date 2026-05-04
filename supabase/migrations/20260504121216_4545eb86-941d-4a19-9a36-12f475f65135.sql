
CREATE TABLE IF NOT EXISTS public.funnemail_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  icon text DEFAULT '📂',
  section text NOT NULL DEFAULT 'operative' CHECK (section IN ('operative','archive','sorting')),
  sort_order integer NOT NULL DEFAULT 0,
  accept_into_agenda boolean NOT NULL DEFAULT false,
  prompt_hint text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnemail_folders_section_order ON public.funnemail_folders(section, sort_order);

ALTER TABLE public.funnemail_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funnemail_folders read all auth"
  ON public.funnemail_folders FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "funnemail_folders write admin only"
  ON public.funnemail_folders FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_funnemail_folders_updated
  BEFORE UPDATE ON public.funnemail_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.funnemail_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL UNIQUE,
  user_id uuid,
  partner_id uuid,
  from_address text,
  folder_slug text REFERENCES public.funnemail_folders(slug) ON DELETE SET NULL,
  suggested_action text NOT NULL DEFAULT 'none'
    CHECK (suggested_action IN ('none','draft_reply','forward','escalate','archive','notify_human')),
  goes_to_agenda boolean NOT NULL DEFAULT false,
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('critical','high','normal','low')),
  confidence numeric(4,3) NOT NULL DEFAULT 0,
  reasoning text,
  commercial_handoff boolean NOT NULL DEFAULT false,
  override_by uuid,
  override_at timestamptz,
  override_folder_slug text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnemail_decisions_folder ON public.funnemail_decisions(folder_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnemail_decisions_user ON public.funnemail_decisions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnemail_decisions_partner ON public.funnemail_decisions(partner_id);

ALTER TABLE public.funnemail_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funnemail_decisions read all auth"
  ON public.funnemail_decisions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "funnemail_decisions service insert"
  ON public.funnemail_decisions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "funnemail_decisions override owner"
  ON public.funnemail_decisions FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_funnemail_decisions_updated
  BEFORE UPDATE ON public.funnemail_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
