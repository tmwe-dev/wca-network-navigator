-- Update Transport Management SRL with scraped data
UPDATE public.partners SET
  address = 'Via Liguria 14, Peschiera Borromeo (MI), 20068',
  phone = '+39 02 5537 6201',
  fax = '+39 02 547 0130',
  website = 'https://www.tmwe.it/',
  logo_url = 'https://cdn.wcaworld.com/logos/112839.jpg',
  member_since = '2020-11-20',
  membership_expires = '2026-11-19',
  has_branches = true,
  branch_cities = '["New Delhi"]'::jsonb,
  profile_description = 'Transport Management Worldwide Express is a Courier and International Freight Forwarder. We guarantee safe, fast and convenient shipping all over the world through air services, by land and by sea. Since our inception in 1999, innovation has been the basis of our success. TMWE.it website is internationally recognized as the most performing platform in the world. Services: ADR/DGR Transport License, IATA/DGR Cargo Agent, WCA TIME CRITICAL Validated, WCA ECOMMERCE Certified, WCA PHARMA GDP Certified, WCA DGR Certified, WCA Risk Validated.',
  raw_profile_markdown = 'Scraped from wcadangerousgoods.com on 2026-03-21',
  updated_at = now()
WHERE id = '129b0937-300e-436f-aa05-56ae7c9d9d85';

-- Insert partner contacts with public titles (names require login)
INSERT INTO public.partner_contacts (partner_id, name, title, direct_phone)
VALUES
  ('129b0937-300e-436f-aa05-56ae7c9d9d85', 'President (TM)', 'President', '+39 02 5537 6201'),
  ('129b0937-300e-436f-aa05-56ae7c9d9d85', 'Air & Ocean Director (TM)', 'Air and Ocean Director', NULL),
  ('129b0937-300e-436f-aa05-56ae7c9d9d85', 'Network Dev Manager NA (TM)', 'Network Development Manager - North America', NULL),
  ('129b0937-300e-436f-aa05-56ae7c9d9d85', 'Americas Dev Manager (TM)', 'Americas Development Manager', NULL);

-- Add network memberships
INSERT INTO public.partner_networks (partner_id, network_name, network_id, expires)
VALUES
  ('129b0937-300e-436f-aa05-56ae7c9d9d85', 'WCA Dangerous Goods', '13', '2026-11-19')
ON CONFLICT DO NOTHING;

-- Add IATA certification
INSERT INTO public.partner_certifications (partner_id, certification)
VALUES
  ('129b0937-300e-436f-aa05-56ae7c9d9d85', 'IATA')
ON CONFLICT DO NOTHING;