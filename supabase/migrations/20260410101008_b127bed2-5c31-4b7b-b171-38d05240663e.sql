
CREATE TABLE public.bridge_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash TEXT NOT NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  external_call_id TEXT,
  created_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bridge_tokens_hash ON public.bridge_tokens (token_hash);
CREATE INDEX idx_bridge_tokens_expires ON public.bridge_tokens (expires_at);

ALTER TABLE public.bridge_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own bridge tokens"
ON public.bridge_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their own bridge tokens"
ON public.bridge_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);
