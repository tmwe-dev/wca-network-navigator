
-- Tabella unificata messaggi su tutti i canali
CREATE TABLE public.channel_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'linkedin', 'sms')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  source_type TEXT DEFAULT 'manual',
  source_id UUID,
  partner_id UUID,
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  message_id_external TEXT,
  in_reply_to TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own channel_messages"
  ON public.channel_messages FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_channel_messages_user_channel ON public.channel_messages (user_id, channel);
CREATE INDEX idx_channel_messages_source ON public.channel_messages (source_type, source_id);
CREATE INDEX idx_channel_messages_partner ON public.channel_messages (partner_id);
CREATE INDEX idx_channel_messages_unread ON public.channel_messages (user_id, read_at) WHERE read_at IS NULL AND direction = 'inbound';
CREATE INDEX idx_channel_messages_external_id ON public.channel_messages (message_id_external);

-- Stato sync email per utente (ultimo UID scaricato)
CREATE TABLE public.email_sync_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  imap_host TEXT NOT NULL DEFAULT 'imaps.aruba.it',
  imap_user TEXT NOT NULL DEFAULT '',
  last_uid INTEGER NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email_sync_state"
  ON public.email_sync_state FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Abilita realtime per notifiche nuovi messaggi
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;
