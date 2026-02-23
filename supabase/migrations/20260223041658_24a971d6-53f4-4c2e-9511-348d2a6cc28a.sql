
-- Create workspace_documents table
CREATE TABLE public.workspace_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  extracted_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_workspace_documents_all"
  ON public.workspace_documents
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create workspace-docs storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('workspace-docs', 'workspace-docs', true);

CREATE POLICY "Workspace docs are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-docs');

CREATE POLICY "Authenticated users can upload workspace docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'workspace-docs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete workspace docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'workspace-docs' AND auth.uid() IS NOT NULL);
