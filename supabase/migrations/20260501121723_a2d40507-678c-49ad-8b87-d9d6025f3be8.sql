DROP FUNCTION IF EXISTS public.merge_duplicate_partners(integer);

CREATE OR REPLACE FUNCTION public.merge_duplicate_partners(_batch_size integer DEFAULT 500)
RETURNS TABLE(merged_groups integer, merged_rows integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group RECORD;
  _canonical_id uuid;
  _dup_id uuid;
  _groups_count integer := 0;
  _rows_count integer := 0;
  _batch_id uuid := gen_random_uuid();
BEGIN
  FOR _group IN
    SELECT 
      lower(trim(name)) AS norm_name,
      lower(trim(coalesce(country,''))) AS norm_country,
      array_agg(id ORDER BY created_at ASC) AS ids
    FROM partners
    WHERE deleted_at IS NULL
    GROUP BY lower(trim(name)), lower(trim(coalesce(country,'')))
    HAVING COUNT(*) > 1
    LIMIT _batch_size
  LOOP
    _canonical_id := _group.ids[1];
    
    FOR i IN 2..array_length(_group.ids, 1) LOOP
      _dup_id := _group.ids[i];
      
      UPDATE partners p_canon
      SET 
        website = COALESCE(p_canon.website, p_dup.website),
        email = COALESCE(p_canon.email, p_dup.email),
        phone = COALESCE(p_canon.phone, p_dup.phone),
        address = COALESCE(p_canon.address, p_dup.address),
        city = COALESCE(p_canon.city, p_dup.city),
        notes = COALESCE(p_canon.notes, p_dup.notes)
      FROM partners p_dup
      WHERE p_canon.id = _canonical_id AND p_dup.id = _dup_id;
      
      UPDATE partner_contacts SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE activities SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE ai_decision_log SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE ai_pending_actions SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE calendar_events SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE campaign_jobs SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE channel_messages SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE cockpit_queue SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE contact_conversation_context SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE deals SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE email_campaign_queue SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE email_classifications SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE email_send_log SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE extension_dispatch_queue SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE interactions SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE outreach_queue SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE partner_certifications SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE partner_networks SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE partner_services SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE partner_social_links SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE partner_workflow_state SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE reminders SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE sherlock_investigations SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE supervisor_audit_log SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE voice_call_sessions SET partner_id = _canonical_id WHERE partner_id = _dup_id;
      UPDATE imported_contacts SET transferred_to_partner_id = _canonical_id WHERE transferred_to_partner_id = _dup_id;
      UPDATE imported_contacts SET wca_partner_id = _canonical_id WHERE wca_partner_id = _dup_id;
      
      UPDATE business_cards SET matched_partner_id = _canonical_id WHERE matched_partner_id = _dup_id;
      UPDATE blacklist_entries SET matched_partner_id = _canonical_id WHERE matched_partner_id = _dup_id;
      
      INSERT INTO duplicate_merge_log (entity_type, duplicate_id, canonical_id, batch_id, executed_at)
      VALUES ('partner', _dup_id, _canonical_id, _batch_id, now());
      
      UPDATE partners SET deleted_at = now() WHERE id = _dup_id;
      
      _rows_count := _rows_count + 1;
    END LOOP;
    
    _groups_count := _groups_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT _groups_count, _rows_count;
END;
$$;