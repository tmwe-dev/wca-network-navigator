-- Update network_configs flags based on actual data in the database
-- This corrects the erroneous false flags

UPDATE network_configs nc
SET 
  has_contact_emails = COALESCE(stats.has_emails, false),
  has_contact_phones = COALESCE(stats.has_phones, false),
  has_contact_names = COALESCE(stats.has_names, false),
  sample_tested_at = now(),
  updated_at = now()
FROM (
  SELECT 
    pn.network_name,
    bool_or(pc.email IS NOT NULL) as has_emails,
    bool_or(pc.direct_phone IS NOT NULL OR pc.mobile IS NOT NULL) as has_phones,
    bool_or(pc.name IS NOT NULL AND pc.name !~ 'Members\s*only') as has_names
  FROM partner_networks pn
  JOIN partner_contacts pc ON pc.partner_id = pn.partner_id
  GROUP BY pn.network_name
) stats
WHERE nc.network_name = stats.network_name;
