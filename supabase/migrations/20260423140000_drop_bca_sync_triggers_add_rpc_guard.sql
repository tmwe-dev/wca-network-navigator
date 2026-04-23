-- ═══════════════════════════════════════════════════════════
-- 1. DROP bidirectional lead_status sync triggers
-- ═══════════════════════════════════════════════════════════
--
-- MOTIVAZIONE: Questi trigger creano un ciclo bidirezionale di scrittura
-- lead_status tra partners e business_cards. Il LeadProcessManager ora
-- gestisce entrambe le entità direttamente, rendendo la sync automatica
-- sia ridondante che pericolosa (12 scrittori per la stessa colonna).
--
-- Write authority dichiarata: LeadProcessManager (unico)
-- Write authority reale prima: LeadPM + 9 file TS + 2 trigger DB = 12 scrittori
-- Write authority reale dopo:  LeadPM + guard RPC = 2 punti controllati

-- Drop trigger: partners → business_cards
DROP TRIGGER IF EXISTS trg_sync_partner_lead_to_bca ON public.partners;
DROP FUNCTION IF EXISTS public.sync_partner_lead_status_to_bca();

-- Drop trigger: business_cards → partners
DROP TRIGGER IF EXISTS trg_sync_bca_lead_to_partner ON public.business_cards;
DROP FUNCTION IF EXISTS public.sync_bca_lead_status_to_partner();


-- ═══════════════════════════════════════════════════════════
-- 2. RPC function for frontend lead_status transitions
-- ═══════════════════════════════════════════════════════════
--
-- Il frontend non può importare TypeScript edge functions.
-- Questa RPC replica la logica di leadStatusGuard.ts in SQL:
--   - Tassonomia 9 stati
--   - No downgrade (monotona crescente)
--   - Terminali (archived/blacklisted) sempre consentiti
--   - Audit trail automatico
--
-- Callers: src/data/partners.ts → updateLeadStatus()

CREATE OR REPLACE FUNCTION public.apply_lead_status_rpc(
  p_table TEXT,
  p_record_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_status TEXT;
  v_status_order JSONB := '{
    "new": 0,
    "first_touch_sent": 1,
    "holding": 2,
    "engaged": 3,
    "qualified": 4,
    "negotiation": 5,
    "converted": 6
  }'::JSONB;
  v_all_statuses TEXT[] := ARRAY['new','first_touch_sent','holding','engaged','qualified','negotiation','converted','archived','blacklisted'];
  v_terminal_statuses TEXT[] := ARRAY['archived','blacklisted'];
  v_from_order INT;
  v_to_order INT;
BEGIN
  -- Auth: get current user from RLS context
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason', 'Non autenticato');
  END IF;

  -- Validate table parameter
  IF p_table NOT IN ('partners', 'imported_contacts') THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason', 'Tabella non supportata: ' || p_table);
  END IF;

  -- Validate new_status
  IF NOT (p_new_status = ANY(v_all_statuses)) THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason', 'Stato non valido: ' || p_new_status);
  END IF;

  -- Load current status
  IF p_table = 'partners' THEN
    SELECT COALESCE(lead_status, 'new') INTO v_current_status
    FROM partners WHERE id = p_record_id AND user_id = v_user_id;
  ELSE
    SELECT COALESCE(lead_status, 'new') INTO v_current_status
    FROM imported_contacts WHERE id = p_record_id AND user_id = v_user_id;
  END IF;

  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason', 'Record non trovato');
  END IF;

  -- Same status = no-op
  IF v_current_status = p_new_status THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason', 'Stesso stato');
  END IF;

  -- Terminal statuses always allowed (from any state)
  IF p_new_status = ANY(v_terminal_statuses) THEN
    -- Apply
    IF p_table = 'partners' THEN
      UPDATE partners SET lead_status = p_new_status, updated_at = NOW()
      WHERE id = p_record_id AND user_id = v_user_id;
    ELSE
      UPDATE imported_contacts SET lead_status = p_new_status, updated_at = NOW()
      WHERE id = p_record_id AND user_id = v_user_id;
    END IF;

    -- Audit log
    INSERT INTO supervisor_audit_log (user_id, actor_type, actor_name, action_category, action_detail, target_type, target_id, decision_origin, metadata)
    VALUES (v_user_id, 'user', 'frontend/RPC', 'lead_status_change',
      v_current_status || ' → ' || p_new_status || ' (via RPC)',
      p_table, p_record_id::TEXT, 'manual',
      jsonb_build_object('from', v_current_status, 'to', p_new_status, 'table', p_table));

    RETURN jsonb_build_object('applied', true, 'previous_status', v_current_status, 'new_status', p_new_status);
  END IF;

  -- Cannot leave terminal state
  IF v_current_status = ANY(v_terminal_statuses) THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason',
      'Non si può uscire dallo stato terminale: ' || v_current_status);
  END IF;

  -- Monotonic escalation check
  v_from_order := (v_status_order->>v_current_status)::INT;
  v_to_order := (v_status_order->>p_new_status)::INT;

  IF v_from_order IS NULL OR v_to_order IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason',
      'Stato non ordinabile: ' || v_current_status || ' → ' || p_new_status);
  END IF;

  IF v_to_order <= v_from_order THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason',
      'Downgrade non consentito: ' || v_current_status || ' → ' || p_new_status);
  END IF;

  -- Apply transition
  IF p_table = 'partners' THEN
    UPDATE partners SET lead_status = p_new_status, updated_at = NOW()
    WHERE id = p_record_id AND user_id = v_user_id;
  ELSE
    UPDATE imported_contacts SET lead_status = p_new_status, updated_at = NOW()
    WHERE id = p_record_id AND user_id = v_user_id;
  END IF;

  -- Audit log
  INSERT INTO supervisor_audit_log (user_id, actor_type, actor_name, action_category, action_detail, target_type, target_id, decision_origin, metadata)
  VALUES (v_user_id, 'user', 'frontend/RPC', 'lead_status_change',
    v_current_status || ' → ' || p_new_status || ' (via RPC)',
    p_table, p_record_id::TEXT, 'manual',
    jsonb_build_object('from', v_current_status, 'to', p_new_status, 'table', p_table));

  RETURN jsonb_build_object('applied', true, 'previous_status', v_current_status, 'new_status', p_new_status);
END;
$$;

-- Grant to authenticated users
GRANT EXECUTE ON FUNCTION public.apply_lead_status_rpc(TEXT, UUID, TEXT) TO authenticated;
