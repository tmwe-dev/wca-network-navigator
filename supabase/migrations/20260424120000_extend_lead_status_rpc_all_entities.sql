-- Extend apply_lead_status_rpc to support ALL lead entities:
-- partners, imported_contacts, business_cards, prospects
-- This ensures LeadProcessManager has sovereign authority over ALL lead_status mutations.

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

  -- Validate table parameter — now supports all 4 lead entity tables
  IF p_table NOT IN ('partners', 'imported_contacts', 'business_cards', 'prospects') THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason', 'Tabella non supportata: ' || p_table);
  END IF;

  -- Validate new_status
  IF NOT (p_new_status = ANY(v_all_statuses)) THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason', 'Stato non valido: ' || p_new_status);
  END IF;

  -- Load current status from the appropriate table
  IF p_table = 'partners' THEN
    SELECT COALESCE(lead_status, 'new') INTO v_current_status
    FROM partners WHERE id = p_record_id AND user_id = v_user_id;
  ELSIF p_table = 'imported_contacts' THEN
    SELECT COALESCE(lead_status, 'new') INTO v_current_status
    FROM imported_contacts WHERE id = p_record_id AND user_id = v_user_id;
  ELSIF p_table = 'business_cards' THEN
    SELECT COALESCE(lead_status, 'new') INTO v_current_status
    FROM business_cards WHERE id = p_record_id AND user_id = v_user_id;
  ELSIF p_table = 'prospects' THEN
    SELECT COALESCE(lead_status, 'new') INTO v_current_status
    FROM prospects WHERE id = p_record_id AND user_id = v_user_id;
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
    IF p_table = 'partners' THEN
      UPDATE partners SET lead_status = p_new_status, updated_at = NOW()
      WHERE id = p_record_id AND user_id = v_user_id;
    ELSIF p_table = 'imported_contacts' THEN
      UPDATE imported_contacts SET lead_status = p_new_status, updated_at = NOW()
      WHERE id = p_record_id AND user_id = v_user_id;
    ELSIF p_table = 'business_cards' THEN
      UPDATE business_cards SET lead_status = p_new_status, updated_at = NOW()
      WHERE id = p_record_id AND user_id = v_user_id;
    ELSIF p_table = 'prospects' THEN
      UPDATE prospects SET lead_status = p_new_status, updated_at = NOW()
      WHERE id = p_record_id AND user_id = v_user_id;
    END IF;

    -- Audit trail
    INSERT INTO supervisor_audit_log (user_id, actor_type, actor_name, action,
      description, entity_type, entity_id, decision_origin, metadata)
    VALUES (v_user_id, 'user', 'frontend/RPC', 'lead_status_change',
      v_current_status || ' → ' || p_new_status || ' (via RPC)',
      p_table, p_record_id::TEXT, 'manual',
      jsonb_build_object('from', v_current_status, 'to', p_new_status, 'table', p_table));

    RETURN jsonb_build_object('applied', true, 'previous_status', v_current_status, 'new_status', p_new_status);
  END IF;

  -- Monotonic escalation check (no downgrade)
  v_from_order := COALESCE((v_status_order ->> v_current_status)::INT, -1);
  v_to_order   := COALESCE((v_status_order ->> p_new_status)::INT, -1);

  IF v_from_order < 0 OR v_to_order < 0 THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason',
      'Stato non in scala: ' || v_current_status || ' → ' || p_new_status);
  END IF;

  IF v_to_order <= v_from_order THEN
    RETURN jsonb_build_object('applied', false, 'blocked_reason',
      'Downgrade non consentito: ' || v_current_status || ' → ' || p_new_status);
  END IF;

  -- Apply the transition
  IF p_table = 'partners' THEN
    UPDATE partners SET lead_status = p_new_status, updated_at = NOW()
    WHERE id = p_record_id AND user_id = v_user_id;
  ELSIF p_table = 'imported_contacts' THEN
    UPDATE imported_contacts SET lead_status = p_new_status, updated_at = NOW()
    WHERE id = p_record_id AND user_id = v_user_id;
  ELSIF p_table = 'business_cards' THEN
    UPDATE business_cards SET lead_status = p_new_status, updated_at = NOW()
    WHERE id = p_record_id AND user_id = v_user_id;
  ELSIF p_table = 'prospects' THEN
    UPDATE prospects SET lead_status = p_new_status, updated_at = NOW()
    WHERE id = p_record_id AND user_id = v_user_id;
  END IF;

  -- Audit trail
  INSERT INTO supervisor_audit_log (user_id, actor_type, actor_name, action,
    description, entity_type, entity_id, decision_origin, metadata)
  VALUES (v_user_id, 'user', 'frontend/RPC', 'lead_status_change',
    v_current_status || ' → ' || p_new_status || ' (via RPC)',
    p_table, p_record_id::TEXT, 'manual',
    jsonb_build_object('from', v_current_status, 'to', p_new_status, 'table', p_table));

  RETURN jsonb_build_object('applied', true, 'previous_status', v_current_status, 'new_status', p_new_status);
END;
$$;
