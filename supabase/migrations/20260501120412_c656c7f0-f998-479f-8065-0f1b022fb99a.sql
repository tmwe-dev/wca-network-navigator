CREATE OR REPLACE FUNCTION public.merge_duplicate_partner_contacts(batch_size INT DEFAULT 500)
RETURNS TABLE(groups_processed INT, rows_merged INT, batch_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id TEXT := 'cleanup_2026_05_01_pcontacts_' || to_char(now(), 'YYYYMMDDHH24MISS');
  v_groups INT := 0;
  v_rows INT := 0;
  rec RECORD;
  canonical_rec RECORD;
  dup_rec RECORD;
  reassigned JSONB;
  cnt INT;
BEGIN
  FOR rec IN
    SELECT partner_id, lower(coalesce(email,'')) AS em, lower(coalesce(name,'')) AS nm
    FROM partner_contacts
    WHERE deleted_at IS NULL
    GROUP BY 1,2,3
    HAVING COUNT(*) > 1
    LIMIT batch_size
  LOOP
    SELECT * INTO canonical_rec
    FROM partner_contacts
    WHERE deleted_at IS NULL
      AND partner_id = rec.partner_id
      AND lower(coalesce(email,'')) = rec.em
      AND lower(coalesce(name,'')) = rec.nm
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1;

    FOR dup_rec IN
      SELECT * FROM partner_contacts
      WHERE deleted_at IS NULL
        AND partner_id = rec.partner_id
        AND lower(coalesce(email,'')) = rec.em
        AND lower(coalesce(name,'')) = rec.nm
        AND id <> canonical_rec.id
    LOOP
      reassigned := '{}'::jsonb;

      UPDATE partner_contacts SET
        title         = COALESCE(NULLIF(title,''), dup_rec.title),
        direct_phone  = COALESCE(NULLIF(direct_phone,''), dup_rec.direct_phone),
        mobile        = COALESCE(NULLIF(mobile,''), dup_rec.mobile),
        contact_alias = COALESCE(NULLIF(contact_alias,''), dup_rec.contact_alias),
        is_primary    = (canonical_rec.is_primary OR dup_rec.is_primary)
      WHERE id = canonical_rec.id;

      UPDATE contact_interactions       SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('contact_interactions', cnt);
      UPDATE contact_conversation_context SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('contact_conversation_context', cnt);
      UPDATE ai_decision_log            SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('ai_decision_log', cnt);
      UPDATE ai_pending_actions         SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('ai_pending_actions', cnt);
      UPDATE calendar_events            SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('calendar_events', cnt);
      UPDATE deals                      SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('deals', cnt);
      UPDATE email_classifications      SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('email_classifications', cnt);
      UPDATE extension_dispatch_queue   SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('extension_dispatch_queue', cnt);
      UPDATE linkedin_flow_items        SET contact_id = canonical_rec.id::text WHERE contact_id = dup_rec.id::text; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('linkedin_flow_items', cnt);
      UPDATE outreach_queue             SET contact_id = canonical_rec.id::text WHERE contact_id = dup_rec.id::text; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('outreach_queue', cnt);
      UPDATE outreach_schedules         SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('outreach_schedules', cnt);
      UPDATE partner_social_links       SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('partner_social_links', cnt);
      UPDATE partner_workflow_state     SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('partner_workflow_state', cnt);
      UPDATE sherlock_investigations    SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('sherlock_investigations', cnt);
      UPDATE supervisor_audit_log       SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('supervisor_audit_log', cnt);
      UPDATE voice_call_sessions        SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('voice_call_sessions', cnt);

      UPDATE partner_contacts SET deleted_at = now() WHERE id = dup_rec.id;

      INSERT INTO duplicate_merge_log(entity_type, canonical_id, duplicate_id, merged_fields, reassigned_relations, batch_id)
      VALUES ('partner_contact', canonical_rec.id, dup_rec.id, jsonb_build_object('coalesced_from', dup_rec.id), reassigned, v_batch_id);

      v_rows := v_rows + 1;
    END LOOP;

    v_groups := v_groups + 1;
  END LOOP;

  RETURN QUERY SELECT v_groups, v_rows, v_batch_id;
END;
$$;