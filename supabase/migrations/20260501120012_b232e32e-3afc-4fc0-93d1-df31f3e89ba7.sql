-- ============================================================
-- FASE 2 — Funzioni di merge sicuro
-- ============================================================
-- Strategia comune per ogni funzione:
--   1. Trova gruppi di duplicati (con LIMIT batch_size).
--   2. Per ogni gruppo:
--      a. Determina il record canonico = il più vecchio (created_at min).
--      b. Costruisce coalesce campo-per-campo dai duplicati verso il canonico.
--      c. Riassegna tutte le relazioni collegate dai duplicati al canonico.
--      d. Soft-delete dei duplicati (deleted_at = now()).
--      e. Logga in duplicate_merge_log.
--   3. Ritorna un riepilogo.

-- ============================================================
-- 2A) MERGE PARTNERS DUPLICATI
-- ============================================================
CREATE OR REPLACE FUNCTION public.merge_duplicate_partners(batch_size INT DEFAULT 200)
RETURNS TABLE(groups_processed INT, rows_merged INT, batch_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id TEXT := 'cleanup_2026_05_01_partners_' || to_char(now(), 'YYYYMMDDHH24MISS');
  v_groups INT := 0;
  v_rows INT := 0;
  rec RECORD;
  canonical_rec RECORD;
  dup_rec RECORD;
  merged_fields JSONB;
  reassigned JSONB;
  cnt INT;
BEGIN
  FOR rec IN
    SELECT lower(coalesce(company_name,'')) AS nm, lower(coalesce(country_code,'')) AS co
    FROM partners
    WHERE deleted_at IS NULL AND coalesce(company_name,'') <> ''
    GROUP BY 1,2
    HAVING COUNT(*) > 1
    LIMIT batch_size
  LOOP
    -- canonico = più vecchio (più storia/relazioni)
    SELECT * INTO canonical_rec
    FROM partners
    WHERE deleted_at IS NULL
      AND lower(coalesce(company_name,'')) = rec.nm
      AND lower(coalesce(country_code,'')) = rec.co
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    FOR dup_rec IN
      SELECT * FROM partners
      WHERE deleted_at IS NULL
        AND lower(coalesce(company_name,'')) = rec.nm
        AND lower(coalesce(country_code,'')) = rec.co
        AND id <> canonical_rec.id
    LOOP
      merged_fields := '{}'::jsonb;
      reassigned := '{}'::jsonb;

      -- COALESCE: copia sul canonico i campi che il canonico ha vuoti e il dup ha pieni
      UPDATE partners SET
        wca_id              = COALESCE(NULLIF(wca_id,''), dup_rec.wca_id),
        city                = COALESCE(NULLIF(city,''), dup_rec.city),
        country_name        = COALESCE(NULLIF(country_name,''), dup_rec.country_name),
        office_type         = COALESCE(NULLIF(office_type,''), dup_rec.office_type),
        address             = COALESCE(NULLIF(address,''), dup_rec.address),
        phone               = COALESCE(NULLIF(phone,''), dup_rec.phone),
        fax                 = COALESCE(NULLIF(fax,''), dup_rec.fax),
        mobile              = COALESCE(NULLIF(mobile,''), dup_rec.mobile),
        emergency_phone     = COALESCE(NULLIF(emergency_phone,''), dup_rec.emergency_phone),
        email               = COALESCE(NULLIF(email,''), dup_rec.email),
        website             = COALESCE(NULLIF(website,''), dup_rec.website),
        member_since        = COALESCE(member_since, dup_rec.member_since),
        membership_expires  = COALESCE(membership_expires, dup_rec.membership_expires),
        profile_description = COALESCE(NULLIF(profile_description,''), dup_rec.profile_description),
        has_branches        = COALESCE(has_branches, dup_rec.has_branches),
        branch_cities       = COALESCE(branch_cities, dup_rec.branch_cities),
        partner_type        = COALESCE(NULLIF(partner_type,''), dup_rec.partner_type),
        rating              = COALESCE(rating, dup_rec.rating),
        rating_details      = COALESCE(rating_details, dup_rec.rating_details),
        enrichment_data     = COALESCE(enrichment_data, dup_rec.enrichment_data),
        enriched_at         = COALESCE(enriched_at, dup_rec.enriched_at),
        logo_url            = COALESCE(NULLIF(logo_url,''), dup_rec.logo_url),
        raw_profile_html    = COALESCE(raw_profile_html, dup_rec.raw_profile_html),
        raw_profile_markdown= COALESCE(raw_profile_markdown, dup_rec.raw_profile_markdown),
        ai_parsed_at        = COALESCE(ai_parsed_at, dup_rec.ai_parsed_at),
        company_alias       = COALESCE(NULLIF(company_alias,''), dup_rec.company_alias),
        lead_status         = COALESCE(NULLIF(lead_status,''), dup_rec.lead_status),
        last_interaction_at = GREATEST(last_interaction_at, dup_rec.last_interaction_at),
        interaction_count   = COALESCE(interaction_count,0) + COALESCE(dup_rec.interaction_count,0),
        converted_at        = COALESCE(converted_at, dup_rec.converted_at),
        email_status        = COALESCE(NULLIF(email_status,''), dup_rec.email_status),
        status_reason       = COALESCE(NULLIF(status_reason,''), dup_rec.status_reason),
        linkedin_url        = COALESCE(NULLIF(linkedin_url,''), dup_rec.linkedin_url),
        is_favorite         = (canonical_rec.is_favorite OR dup_rec.is_favorite),
        is_active           = (canonical_rec.is_active OR dup_rec.is_active),
        updated_at          = now()
      WHERE id = canonical_rec.id;

      merged_fields := jsonb_build_object('coalesced_from', dup_rec.id);

      -- RIASSEGNA RELAZIONI: tutte le tabelle con partner_id
      UPDATE partner_contacts          SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('partner_contacts', cnt);
      UPDATE activities                SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('activities', cnt);
      UPDATE ai_decision_log           SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('ai_decision_log', cnt);
      UPDATE ai_pending_actions        SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('ai_pending_actions', cnt);
      UPDATE calendar_events           SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('calendar_events', cnt);
      UPDATE campaign_jobs             SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('campaign_jobs', cnt);
      UPDATE channel_messages          SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('channel_messages', cnt);
      UPDATE cockpit_queue             SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('cockpit_queue', cnt);
      UPDATE contact_conversation_context SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('contact_conversation_context', cnt);
      UPDATE deals                     SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('deals', cnt);
      UPDATE email_campaign_queue      SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('email_campaign_queue', cnt);
      UPDATE email_classifications     SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('email_classifications', cnt);
      UPDATE email_send_log            SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('email_send_log', cnt);
      UPDATE extension_dispatch_queue  SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('extension_dispatch_queue', cnt);
      UPDATE interactions              SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('interactions', cnt);
      UPDATE outreach_queue            SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('outreach_queue', cnt);
      UPDATE partner_certifications    SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('partner_certifications', cnt);
      UPDATE partner_networks          SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('partner_networks', cnt);
      UPDATE partner_services          SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('partner_services', cnt);
      UPDATE partner_social_links      SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('partner_social_links', cnt);
      UPDATE partner_workflow_state    SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('partner_workflow_state', cnt);
      UPDATE reminders                 SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('reminders', cnt);
      UPDATE sherlock_investigations   SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('sherlock_investigations', cnt);
      UPDATE supervisor_audit_log      SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('supervisor_audit_log', cnt);
      UPDATE voice_call_sessions       SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('voice_call_sessions', cnt);
      -- Business cards (BCA) — collegate al partner_id se esiste la colonna
      BEGIN
        UPDATE business_cards          SET partner_id = canonical_rec.id WHERE partner_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('business_cards', cnt);
      EXCEPTION WHEN undefined_column THEN NULL; END;
      -- Imported contacts già transferiti
      UPDATE imported_contacts SET transferred_to_partner_id = canonical_rec.id WHERE transferred_to_partner_id = dup_rec.id;
      GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('imported_contacts.transferred_to_partner_id', cnt);

      -- SOFT DELETE del duplicato
      UPDATE partners
        SET deleted_at = now(),
            status_reason = 'duplicate_merged_into:' || canonical_rec.id::text
      WHERE id = dup_rec.id;

      INSERT INTO duplicate_merge_log(entity_type, canonical_id, duplicate_id, merged_fields, reassigned_relations, batch_id)
      VALUES ('partner', canonical_rec.id, dup_rec.id, merged_fields, reassigned, v_batch_id);

      v_rows := v_rows + 1;
    END LOOP;

    v_groups := v_groups + 1;
  END LOOP;

  RETURN QUERY SELECT v_groups, v_rows, v_batch_id;
END;
$$;

-- ============================================================
-- 2B) MERGE PARTNER_CONTACTS DUPLICATI
-- ============================================================
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

      -- Riassegna relazioni dove contact_id punta ai partner_contact
      -- (filtriamo per partner_id quando disponibile per sicurezza)
      UPDATE contact_interactions       SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('contact_interactions', cnt);
      UPDATE contact_conversation_context SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('contact_conversation_context', cnt);
      UPDATE ai_decision_log            SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('ai_decision_log', cnt);
      UPDATE ai_pending_actions         SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('ai_pending_actions', cnt);
      UPDATE calendar_events            SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('calendar_events', cnt);
      UPDATE deals                      SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('deals', cnt);
      UPDATE email_classifications      SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('email_classifications', cnt);
      UPDATE extension_dispatch_queue   SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('extension_dispatch_queue', cnt);
      UPDATE linkedin_flow_items        SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('linkedin_flow_items', cnt);
      UPDATE outreach_queue             SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('outreach_queue', cnt);
      UPDATE outreach_schedules         SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('outreach_schedules', cnt);
      UPDATE partner_social_links       SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('partner_social_links', cnt);
      UPDATE partner_workflow_state     SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('partner_workflow_state', cnt);
      UPDATE sherlock_investigations    SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('sherlock_investigations', cnt);
      UPDATE supervisor_audit_log       SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('supervisor_audit_log', cnt);
      UPDATE voice_call_sessions        SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('voice_call_sessions', cnt);

      UPDATE partner_contacts
        SET deleted_at = now()
      WHERE id = dup_rec.id;

      INSERT INTO duplicate_merge_log(entity_type, canonical_id, duplicate_id, merged_fields, reassigned_relations, batch_id)
      VALUES ('partner_contact', canonical_rec.id, dup_rec.id, jsonb_build_object('coalesced_from', dup_rec.id), reassigned, v_batch_id);

      v_rows := v_rows + 1;
    END LOOP;

    v_groups := v_groups + 1;
  END LOOP;

  RETURN QUERY SELECT v_groups, v_rows, v_batch_id;
END;
$$;

-- ============================================================
-- 2C) MERGE IMPORTED_CONTACTS DUPLICATI (CRM)
-- ============================================================
CREATE OR REPLACE FUNCTION public.merge_duplicate_imported_contacts(batch_size INT DEFAULT 200)
RETURNS TABLE(groups_processed INT, rows_merged INT, batch_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id TEXT := 'cleanup_2026_05_01_imported_' || to_char(now(), 'YYYYMMDDHH24MISS');
  v_groups INT := 0;
  v_rows INT := 0;
  rec RECORD;
  canonical_rec RECORD;
  dup_rec RECORD;
  reassigned JSONB;
  cnt INT;
BEGIN
  FOR rec IN
    SELECT lower(coalesce(email,'')) AS em, lower(coalesce(name,'')) AS nm
    FROM imported_contacts
    WHERE deleted_at IS NULL AND coalesce(name,'') <> ''
    GROUP BY 1,2
    HAVING COUNT(*) > 1
    LIMIT batch_size
  LOOP
    SELECT * INTO canonical_rec
    FROM imported_contacts
    WHERE deleted_at IS NULL
      AND lower(coalesce(email,'')) = rec.em
      AND lower(coalesce(name,'')) = rec.nm
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1;

    FOR dup_rec IN
      SELECT * FROM imported_contacts
      WHERE deleted_at IS NULL
        AND lower(coalesce(email,'')) = rec.em
        AND lower(coalesce(name,'')) = rec.nm
        AND id <> canonical_rec.id
    LOOP
      reassigned := '{}'::jsonb;

      UPDATE imported_contacts SET
        company_name      = COALESCE(NULLIF(company_name,''), dup_rec.company_name),
        phone             = COALESCE(NULLIF(phone,''), dup_rec.phone),
        mobile            = COALESCE(NULLIF(mobile,''), dup_rec.mobile),
        country           = COALESCE(NULLIF(country,''), dup_rec.country),
        city              = COALESCE(NULLIF(city,''), dup_rec.city),
        address           = COALESCE(NULLIF(address,''), dup_rec.address),
        zip_code          = COALESCE(NULLIF(zip_code,''), dup_rec.zip_code),
        note              = COALESCE(NULLIF(note,''), dup_rec.note),
        origin            = COALESCE(NULLIF(origin,''), dup_rec.origin),
        company_alias     = COALESCE(NULLIF(company_alias,''), dup_rec.company_alias),
        contact_alias     = COALESCE(NULLIF(contact_alias,''), dup_rec.contact_alias),
        position          = COALESCE(NULLIF(position,''), dup_rec.position),
        external_id       = COALESCE(NULLIF(external_id,''), dup_rec.external_id),
        lead_status       = COALESCE(NULLIF(lead_status,''), dup_rec.lead_status),
        deep_search_at    = COALESCE(deep_search_at, dup_rec.deep_search_at),
        last_interaction_at = GREATEST(last_interaction_at, dup_rec.last_interaction_at),
        interaction_count = COALESCE(interaction_count,0) + COALESCE(dup_rec.interaction_count,0),
        converted_at      = COALESCE(converted_at, dup_rec.converted_at),
        enrichment_data   = COALESCE(enrichment_data, dup_rec.enrichment_data),
        wca_partner_id    = COALESCE(wca_partner_id, dup_rec.wca_partner_id),
        wca_match_confidence = COALESCE(wca_match_confidence, dup_rec.wca_match_confidence),
        lead_score        = GREATEST(COALESCE(lead_score,0), COALESCE(dup_rec.lead_score,0)),
        lead_score_breakdown = COALESCE(lead_score_breakdown, dup_rec.lead_score_breakdown),
        lead_score_updated_at = GREATEST(lead_score_updated_at, dup_rec.lead_score_updated_at),
        email_status      = COALESCE(NULLIF(email_status,''), dup_rec.email_status),
        status_reason     = COALESCE(NULLIF(status_reason,''), dup_rec.status_reason),
        transferred_to_partner_id = COALESCE(transferred_to_partner_id, dup_rec.transferred_to_partner_id),
        transferred_at    = COALESCE(transferred_at, dup_rec.transferred_at),
        is_transferred    = (canonical_rec.is_transferred OR dup_rec.is_transferred)
      WHERE id = canonical_rec.id;

      -- Imported contacts non hanno molte FK; spostiamo se ci sono
      BEGIN
        UPDATE prospect_interactions    SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('prospect_interactions', cnt);
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        UPDATE prospect_social_links    SET contact_id = canonical_rec.id WHERE contact_id = dup_rec.id; GET DIAGNOSTICS cnt = ROW_COUNT; reassigned := reassigned || jsonb_build_object('prospect_social_links', cnt);
      EXCEPTION WHEN others THEN NULL; END;

      UPDATE imported_contacts SET deleted_at = now() WHERE id = dup_rec.id;

      INSERT INTO duplicate_merge_log(entity_type, canonical_id, duplicate_id, merged_fields, reassigned_relations, batch_id)
      VALUES ('imported_contact', canonical_rec.id, dup_rec.id, jsonb_build_object('coalesced_from', dup_rec.id), reassigned, v_batch_id);

      v_rows := v_rows + 1;
    END LOOP;

    v_groups := v_groups + 1;
  END LOOP;

  RETURN QUERY SELECT v_groups, v_rows, v_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_duplicate_partners(INT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_duplicate_partner_contacts(INT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_duplicate_imported_contacts(INT) FROM public, anon, authenticated;