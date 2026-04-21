-- ════════════════════════════════════════════════════════════════════
-- LOVABLE-93: Partner Quality Score Automation
-- Triggers and functions to automatically calculate quality scores
-- when key partner data changes.
-- ════════════════════════════════════════════════════════════════════

-- Create a function to notify the quality score calculation
CREATE OR REPLACE FUNCTION public.notify_quality_score_calculation()
RETURNS TRIGGER AS $$
BEGIN
  -- Publish a notification that triggers the edge function
  PERFORM pg_notify(
    'partner_quality_score_required',
    json_build_object(
      'partner_id', COALESCE(NEW.id, OLD.id),
      'timestamp', now(),
      'trigger_reason', TG_ARGV[0]
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger when enrichment_data is updated
CREATE TRIGGER trigger_quality_on_enrichment_update
AFTER UPDATE OF enrichment_data ON public.partners
FOR EACH ROW
WHEN (OLD.enrichment_data IS DISTINCT FROM NEW.enrichment_data)
EXECUTE FUNCTION public.notify_quality_score_calculation('enrichment_data_updated');

-- Trigger when profile data is updated
CREATE TRIGGER trigger_quality_on_profile_update
AFTER UPDATE OF raw_profile_markdown, ai_parsed_at, website, linkedin_url, logo_url ON public.partners
FOR EACH ROW
EXECUTE FUNCTION public.notify_quality_score_calculation('profile_updated');

-- Trigger when membership/business data is updated
CREATE TRIGGER trigger_quality_on_membership_update
AFTER UPDATE OF member_since, membership_expires, has_branches, branch_cities ON public.partners
FOR EACH ROW
WHEN (
  OLD.member_since IS DISTINCT FROM NEW.member_since
  OR OLD.membership_expires IS DISTINCT FROM NEW.membership_expires
  OR OLD.has_branches IS DISTINCT FROM NEW.has_branches
  OR OLD.branch_cities IS DISTINCT FROM NEW.branch_cities
)
EXECUTE FUNCTION public.notify_quality_score_calculation('membership_updated');

-- Trigger when contacts are added/updated
CREATE TRIGGER trigger_quality_on_contact_change
AFTER INSERT OR UPDATE OR DELETE ON public.partner_contacts
FOR EACH ROW
EXECUTE FUNCTION public.notify_quality_score_calculation('contacts_changed');

-- Trigger when networks are added/updated
CREATE TRIGGER trigger_quality_on_network_change
AFTER INSERT OR UPDATE OR DELETE ON public.partner_networks
FOR EACH ROW
EXECUTE FUNCTION public.notify_quality_score_calculation('networks_changed');

-- Trigger when certifications are added/updated
CREATE TRIGGER trigger_quality_on_certification_change
AFTER INSERT OR UPDATE OR DELETE ON public.partner_certifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_quality_score_calculation('certifications_changed');

-- Trigger when services are added/updated
CREATE TRIGGER trigger_quality_on_service_change
AFTER INSERT OR UPDATE OR DELETE ON public.partner_services
FOR EACH ROW
EXECUTE FUNCTION public.notify_quality_score_calculation('services_changed');

-- Trigger when Sherlock investigations complete
CREATE TRIGGER trigger_quality_on_sherlock_complete
AFTER UPDATE OF status ON public.sherlock_investigations
FOR EACH ROW
WHEN (OLD.status != 'completed' AND NEW.status = 'completed' AND NEW.partner_id IS NOT NULL)
EXECUTE FUNCTION public.notify_quality_score_calculation('sherlock_investigation_completed');

-- Create a view to see quality score breakdown for monitoring
CREATE OR REPLACE VIEW public.vw_partner_quality_scores AS
SELECT
  p.id,
  p.company_name,
  p.country_name,
  p.city,
  p.rating,
  COALESCE((p.rating_details -> 'totalScore')::numeric, 0) as total_score,
  COALESCE((p.rating_details -> 'dataCompleteness')::numeric, 0) as data_completeness,
  (p.rating_details -> 'calculatedAt')::text as calculated_at,
  p.is_active,
  p.updated_at
FROM public.partners
WHERE p.rating IS NOT NULL
ORDER BY p.rating DESC, p.updated_at DESC;

-- Create index for efficient monitoring
CREATE INDEX IF NOT EXISTS idx_partners_rating ON public.partners(rating DESC)
WHERE rating IS NOT NULL;

-- Grant access to authenticated users
GRANT SELECT ON public.vw_partner_quality_scores TO authenticated;
