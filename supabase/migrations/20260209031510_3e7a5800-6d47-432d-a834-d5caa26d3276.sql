
-- Enum for social platforms
CREATE TYPE public.social_platform AS ENUM ('linkedin', 'facebook', 'instagram', 'twitter', 'whatsapp');

-- Social links table
CREATE TABLE public.partner_social_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.partner_contacts(id) ON DELETE CASCADE,
  platform social_platform NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_partner_social_links_select" ON public.partner_social_links FOR SELECT USING (true);
CREATE POLICY "public_partner_social_links_insert" ON public.partner_social_links FOR INSERT WITH CHECK (true);
CREATE POLICY "public_partner_social_links_update" ON public.partner_social_links FOR UPDATE USING (true);
CREATE POLICY "public_partner_social_links_delete" ON public.partner_social_links FOR DELETE USING (true);

-- Team members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_team_members_select" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "public_team_members_insert" ON public.team_members FOR INSERT WITH CHECK (true);
CREATE POLICY "public_team_members_update" ON public.team_members FOR UPDATE USING (true);
CREATE POLICY "public_team_members_delete" ON public.team_members FOR DELETE USING (true);

-- Enums for activities
CREATE TYPE public.activity_type AS ENUM ('send_email', 'phone_call', 'add_to_campaign', 'meeting', 'follow_up', 'other');
CREATE TYPE public.activity_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  activity_type activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status activity_status NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_activities_select" ON public.activities FOR SELECT USING (true);
CREATE POLICY "public_activities_insert" ON public.activities FOR INSERT WITH CHECK (true);
CREATE POLICY "public_activities_update" ON public.activities FOR UPDATE USING (true);
CREATE POLICY "public_activities_delete" ON public.activities FOR DELETE USING (true);
