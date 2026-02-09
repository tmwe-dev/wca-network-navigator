
-- Add raw_profile_html column to store the full HTML from WCA profiles
ALTER TABLE public.partners ADD COLUMN raw_profile_html text;

-- Add raw_profile_markdown column to store the converted markdown
ALTER TABLE public.partners ADD COLUMN raw_profile_markdown text;

-- Add ai_parsed_at to track when AI parsing was last done
ALTER TABLE public.partners ADD COLUMN ai_parsed_at timestamp with time zone;
