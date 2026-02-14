
-- Table for email templates/attachments
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  category TEXT DEFAULT 'altro',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on email_templates" ON public.email_templates FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for template files
INSERT INTO storage.buckets (id, name, public) VALUES ('templates', 'templates', true);

-- Storage policies
CREATE POLICY "Templates are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'templates');
CREATE POLICY "Anyone can upload templates" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'templates');
CREATE POLICY "Anyone can update templates" ON storage.objects FOR UPDATE USING (bucket_id = 'templates');
CREATE POLICY "Anyone can delete templates" ON storage.objects FOR DELETE USING (bucket_id = 'templates');
