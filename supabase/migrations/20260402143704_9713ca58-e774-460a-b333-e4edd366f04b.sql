
CREATE TABLE public.email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.channel_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email_attachments"
  ON public.email_attachments FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_email_attachments_message ON public.email_attachments(message_id);
CREATE INDEX idx_email_attachments_user ON public.email_attachments(user_id);
