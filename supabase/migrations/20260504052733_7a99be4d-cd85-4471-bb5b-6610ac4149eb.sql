
ALTER TABLE public.email_sender_groups
  ADD COLUMN IF NOT EXISTS classification_hint text,
  ADD COLUMN IF NOT EXISTS response_style_hint text,
  ADD COLUMN IF NOT EXISTS auto_action_default text;

CREATE TABLE IF NOT EXISTS public.inbound_operative_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_name text,
  category text NOT NULL,
  action_type text NOT NULL,
  default_assignee text,
  sla_hours integer NOT NULL DEFAULT 24,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.inbound_operative_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ioa_select_own" ON public.inbound_operative_actions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ioa_insert_own" ON public.inbound_operative_actions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ioa_update_own" ON public.inbound_operative_actions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ioa_delete_own" ON public.inbound_operative_actions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_ioa_user_cat ON public.inbound_operative_actions(user_id, category) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.wake_up_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  group_name text,
  min_score integer NOT NULL DEFAULT 0,
  days_dormant integer NOT NULL DEFAULT 14,
  channel text NOT NULL DEFAULT 'email',
  max_per_day integer NOT NULL DEFAULT 20,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.wake_up_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wur_select_own" ON public.wake_up_rules FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "wur_insert_own" ON public.wake_up_rules FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "wur_update_own" ON public.wake_up_rules FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "wur_delete_own" ON public.wake_up_rules FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_wur_user_active ON public.wake_up_rules(user_id, is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_ioa_updated_at BEFORE UPDATE ON public.inbound_operative_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wur_updated_at BEFORE UPDATE ON public.wake_up_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.operative_prompts (user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active)
SELECT u.user_id,
  'Group-Aware Classification',
  'classification',
  $obj$Distinguere mittenti commerciali da amministrativi/operativi/supporto/interni e impedire promozioni di lead_status quando il mittente non e' commerciale.$obj$,
  $proc$1. Leggi SENDER GROUP iniettato nel prompt.
2. Se gruppo in {amministrazione, fornitori, system, internal, support_provider} -> forza domain != commercial e categoria operativa coerente (es. invoice_query, system_notification).
3. Se gruppo = sconosciuto -> procedi normalmente ma marca confidence <= 0.7 finche' un operatore non assegna un gruppo.
4. Mai promuovere un lead da risposta che NON arriva da gruppo commerciale.$proc$,
  $crit$OK: GitHub notification -> domain=internal, category=system_notification. NO: fattura fornitore promossa a engaged.$crit$,
  $ex$Email "fattura n.123" da amministrazione@vendor -> domain=administrative, category=invoice_query, no escalation.$ex$,
  ARRAY['classification','group-aware','lead-status','universale'],
  90, true
FROM (SELECT DISTINCT user_id FROM public.operative_prompts WHERE deprecated_at IS NULL) u
WHERE NOT EXISTS (SELECT 1 FROM public.operative_prompts p WHERE p.user_id = u.user_id AND p.name = 'Group-Aware Classification' AND p.deprecated_at IS NULL);

INSERT INTO public.operative_prompts (user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active)
SELECT u.user_id,
  'Operative Dispatcher Routing',
  'classification',
  $obj$Decidere se una email inbound non-commerciale richiede una activity operativa (offerta, fattura, supporto) e con quale SLA.$obj$,
  $proc$1. Se category in (quote_request, booking_request, rate_inquiry) -> action_type=quote_handling, sla=24h, assignee=offerte.
2. Se category in (invoice_query, payment_request, credit_note) -> action_type=admin_review, sla=72h, assignee=amministrazione.
3. Se category in (technical_issue, complaint) -> action_type=support_ticket, sla=8h, assignee=supporto.
4. Per altri -> nessuna action automatica.$proc$,
  $crit$Match prima per category, poi per group_name come fallback. Mai duplicare activity esistenti aperte sullo stesso thread.$crit$,
  $ex$Mail richiesta tariffa Genova-Tunisi -> activity quote_handling assegnata a "offerte" entro 24h.$ex$,
  ARRAY['classification','dispatcher','operative','universale'],
  80, true
FROM (SELECT DISTINCT user_id FROM public.operative_prompts WHERE deprecated_at IS NULL) u
WHERE NOT EXISTS (SELECT 1 FROM public.operative_prompts p WHERE p.user_id = u.user_id AND p.name = 'Operative Dispatcher Routing' AND p.deprecated_at IS NULL);

INSERT INTO public.operative_prompts (user_id, name, context, objective, procedure, criteria, examples, tags, priority, is_active)
SELECT u.user_id,
  'Wake-Up Composer',
  'outreach',
  $obj$Comporre messaggio di risveglio per lead dormienti rispettando wake_up_rules e variando tono in base a giorni di silenzio e ultimo canale.$obj$,
  $proc$1. Leggi days_dormant, last_channel_used, lead_score.
2. days_dormant 14-30: tono leggero, riferimento a contesto recente.
3. days_dormant 31-90: tono di valore, offri novita'/case study.
4. days_dormant >90: tono di chiusura ("ti tolgo dalla lista se non interessa"), max 1 tentativo.
5. Mai ripetere subject o opening della comunicazione precedente.
6. Cambia canale rispetto all'ultimo usato se possibile.$proc$,
  $crit$Output coerente con journalistReview e Email Single A->Z. Niente liste puntate, max 90 parole.$crit$,
  $ex$Lead silente 45gg, ultimo canale email -> prova WA breve con riferimento al settore.$ex$,
  ARRAY['outreach','wake-up','holding','universale'],
  75, true
FROM (SELECT DISTINCT user_id FROM public.operative_prompts WHERE deprecated_at IS NULL) u
WHERE NOT EXISTS (SELECT 1 FROM public.operative_prompts p WHERE p.user_id = u.user_id AND p.name = 'Wake-Up Composer' AND p.deprecated_at IS NULL);
