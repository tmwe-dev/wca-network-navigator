CREATE OR REPLACE VIEW public.v_partner_busy AS
  SELECT partner_id, 'outreach'::text AS source, created_at AS since
  FROM public.outreach_queue
  WHERE deleted_at IS NULL
    AND partner_id IS NOT NULL
    AND status IN ('pending','queued','scheduled','processing')
  UNION ALL
  SELECT partner_id, 'campaign'::text, created_at
  FROM public.campaign_jobs
  WHERE partner_id IS NOT NULL
    AND status::text IN ('pending','queued','in_progress')
  UNION ALL
  SELECT partner_id, 'cockpit'::text, created_at
  FROM public.cockpit_queue
  WHERE partner_id IS NOT NULL
    AND status IN ('queued','in_progress')
  UNION ALL
  SELECT ecq.partner_id, 'draft'::text, ecq.created_at
  FROM public.email_campaign_queue ecq
  JOIN public.email_drafts d ON d.id = ecq.draft_id
  WHERE ecq.partner_id IS NOT NULL
    AND ecq.status IN ('pending','queued','sending')
    AND d.status = 'draft';

GRANT SELECT ON public.v_partner_busy TO authenticated;