
-- ============================================================
-- SUPER MARIO — AI Gateway operativo per Command
-- ============================================================

-- 1) Soft-deprecation per operative_prompts (no DELETE fisico)
ALTER TABLE public.operative_prompts
  ADD COLUMN IF NOT EXISTS deprecated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deprecated_reason text;

-- Disattiva i prompt 'command' (sostituiti da super_mario_identities)
UPDATE public.operative_prompts
SET is_active = false,
    deprecated_at = now(),
    deprecated_reason = 'Replaced by super_mario_identities (command scope)'
WHERE context = 'command' AND is_active = true;

-- 2) super_mario_identities — identità modificabile per scope
CREATE TABLE IF NOT EXISTS public.super_mario_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL UNIQUE,
  name text NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.super_mario_identities ENABLE ROW LEVEL SECURITY;

-- Tutti gli operatori autenticati vedono le identità (sono globali)
CREATE POLICY "Authenticated read identities"
  ON public.super_mario_identities FOR SELECT
  TO authenticated USING (true);

-- Solo admin può modificare
CREATE POLICY "Admin manage identities"
  ON public.super_mario_identities FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.tg_super_mario_identities_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_super_mario_identities_updated ON public.super_mario_identities;
CREATE TRIGGER trg_super_mario_identities_updated
BEFORE UPDATE ON public.super_mario_identities
FOR EACH ROW EXECUTE FUNCTION public.tg_super_mario_identities_updated_at();

-- 3) conversation_summaries — memoria narrativa versionata con coverage esplicita
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  from_message_index integer NOT NULL,
  to_message_index integer NOT NULL,
  summary text NOT NULL,
  model text NOT NULL,
  summary_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_summary_range CHECK (from_message_index <= to_message_index)
);

CREATE INDEX IF NOT EXISTS idx_conv_summaries_conv ON public.conversation_summaries(conversation_id, to_message_index DESC);

ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Visibili a tutti gli operatori autenticati (Command è globale)
CREATE POLICY "Authenticated read conversation summaries"
  ON public.conversation_summaries FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role manages summaries"
  ON public.conversation_summaries FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 4) super_mario_invocations — audit log redatto, retention 30gg
CREATE TABLE IF NOT EXISTS public.super_mario_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id uuid NOT NULL,
  conversation_id uuid,
  operator_id uuid,
  scope text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  latency_ms integer DEFAULT 0,
  final_prompt_hash text NOT NULL,
  final_prompt_redacted text,
  response_summary text,
  tool_calls_json jsonb DEFAULT '[]'::jsonb,
  audit_warnings jsonb DEFAULT '[]'::jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_sm_invocations_conv ON public.super_mario_invocations(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sm_invocations_expires ON public.super_mario_invocations(expires_at);
CREATE INDEX IF NOT EXISTS idx_sm_invocations_trace ON public.super_mario_invocations(trace_id);

ALTER TABLE public.super_mario_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read invocations"
  ON public.super_mario_invocations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages invocations"
  ON public.super_mario_invocations FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Cron cleanup (riusa pg_cron se disponibile, altrimenti gestione manuale)
CREATE OR REPLACE FUNCTION public.cleanup_super_mario_invocations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.super_mario_invocations WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 5) Seed identity 'command-director' (UPSERT idempotente)
INSERT INTO public.super_mario_identities (scope, name, content)
VALUES (
  'command-director',
  'Direttore Operativo Command',
$IDENTITY$RUOLO
Sei il Direttore Operativo del CRM WCA Network Navigator. L'utente è il responsabile commerciale e ti chiede aiuto per ragionare, decidere e agire sui partner della rete WCA (logistica internazionale, 17 network globali).

COMPORTAMENTO
- Aiuti l'utente a capire i dati e a fare la mossa giusta.
- Usa i tool quando servono. Se il riferimento è chiaro, agisci. Se manca contesto essenziale, chiedi.
- Italiano, diretto, collaborativo. Come un collega senior, non come un report formale.
- Niente disclaimer inutili, niente preamboli, niente "certo, ecco i risultati".

MEMORIA
Ricevi sempre un blocco MEMORY con cinque sezioni:
1. NARRATIVE_SUMMARY — riassunto narrativo dei turni meno recenti.
2. RECENT_TURNS — ultimi turni verbatim (utente + tue risposte).
3. LAST_TOOL_RESULT — l'ultimo dato strutturato che hai prodotto.
4. OPERATOR_MEMORY — preferenze e contesto persistente dell'operatore.
5. CURRENT_USER_REQUEST — quello che l'utente sta chiedendo ora.

Usa queste sezioni per risolvere riferimenti ambigui ("questi", "quelli", "quei 5", "i partner di Marsa") senza chiedere conferma se la risposta è in memoria.

DOMINIO
- Partner = aziende di logistica nei 17 network WCA.
- Lead status: new, contacted, qualified, holding, archived, blacklisted.
- Holding pattern: partner senza risposta da N giorni → priorità decrescente.
- Mai cancellare dati. Mai inviare email senza conferma esplicita dell'utente.
$IDENTITY$
)
ON CONFLICT (scope) DO UPDATE SET
  name = EXCLUDED.name,
  content = EXCLUDED.content,
  version = public.super_mario_identities.version + 1,
  updated_at = now();
