-- Create enums for partner types and categories
CREATE TYPE public.office_type AS ENUM ('head_office', 'branch');
CREATE TYPE public.partner_type AS ENUM ('freight_forwarder', 'customs_broker', 'carrier', 'nvocc', '3pl', 'courier');
CREATE TYPE public.service_category AS ENUM ('air_freight', 'ocean_fcl', 'ocean_lcl', 'road_freight', 'rail_freight', 'project_cargo', 'dangerous_goods', 'perishables', 'pharma', 'ecommerce', 'relocations', 'customs_broker', 'warehousing', 'nvocc');
CREATE TYPE public.certification_type AS ENUM ('IATA', 'BASC', 'ISO', 'C-TPAT', 'AEO');
CREATE TYPE public.interaction_type AS ENUM ('call', 'email', 'meeting', 'note');
CREATE TYPE public.reminder_status AS ENUM ('pending', 'completed');
CREATE TYPE public.reminder_priority AS ENUM ('low', 'medium', 'high');

-- Partners table
CREATE TABLE public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wca_id INTEGER UNIQUE,
    company_name TEXT NOT NULL,
    country_code CHAR(2) NOT NULL,
    country_name TEXT NOT NULL,
    city TEXT NOT NULL,
    office_type public.office_type DEFAULT 'head_office',
    address TEXT,
    phone TEXT,
    fax TEXT,
    mobile TEXT,
    emergency_phone TEXT,
    email TEXT,
    website TEXT,
    member_since DATE,
    membership_expires DATE,
    profile_description TEXT,
    has_branches BOOLEAN DEFAULT false,
    branch_cities JSONB DEFAULT '[]'::jsonb,
    partner_type public.partner_type DEFAULT 'freight_forwarder',
    is_active BOOLEAN DEFAULT true,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partner contacts
CREATE TABLE public.partner_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    direct_phone TEXT,
    mobile TEXT,
    email TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Partner networks (WCA memberships)
CREATE TABLE public.partner_networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    network_id TEXT,
    network_name TEXT NOT NULL,
    expires DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Partner services
CREATE TABLE public.partner_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    service_category public.service_category NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(partner_id, service_category)
);

-- Partner certifications
CREATE TABLE public.partner_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    certification public.certification_type NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(partner_id, certification)
);

-- CRM Interactions
CREATE TABLE public.interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    interaction_type public.interaction_type NOT NULL,
    interaction_date TIMESTAMPTZ DEFAULT now(),
    subject TEXT NOT NULL,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Reminders
CREATE TABLE public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    due_date DATE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status public.reminder_status DEFAULT 'pending',
    priority public.reminder_priority DEFAULT 'medium',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_partners_country ON public.partners(country_code);
CREATE INDEX idx_partners_city ON public.partners(city);
CREATE INDEX idx_partners_active ON public.partners(is_active);
CREATE INDEX idx_partner_services_category ON public.partner_services(service_category);
CREATE INDEX idx_reminders_due_date ON public.reminders(due_date);
CREATE INDEX idx_reminders_status ON public.reminders(status);
CREATE INDEX idx_interactions_date ON public.interactions(interaction_date);

-- Enable RLS on all tables
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Public read/write access for all partner data (CRM is internal tool)
CREATE POLICY "public_partners_select" ON public.partners FOR SELECT USING (true);
CREATE POLICY "public_partners_insert" ON public.partners FOR INSERT WITH CHECK (true);
CREATE POLICY "public_partners_update" ON public.partners FOR UPDATE USING (true);
CREATE POLICY "public_partners_delete" ON public.partners FOR DELETE USING (true);

CREATE POLICY "public_partner_contacts_select" ON public.partner_contacts FOR SELECT USING (true);
CREATE POLICY "public_partner_contacts_insert" ON public.partner_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "public_partner_contacts_update" ON public.partner_contacts FOR UPDATE USING (true);
CREATE POLICY "public_partner_contacts_delete" ON public.partner_contacts FOR DELETE USING (true);

CREATE POLICY "public_partner_networks_select" ON public.partner_networks FOR SELECT USING (true);
CREATE POLICY "public_partner_networks_insert" ON public.partner_networks FOR INSERT WITH CHECK (true);
CREATE POLICY "public_partner_networks_update" ON public.partner_networks FOR UPDATE USING (true);
CREATE POLICY "public_partner_networks_delete" ON public.partner_networks FOR DELETE USING (true);

CREATE POLICY "public_partner_services_select" ON public.partner_services FOR SELECT USING (true);
CREATE POLICY "public_partner_services_insert" ON public.partner_services FOR INSERT WITH CHECK (true);
CREATE POLICY "public_partner_services_update" ON public.partner_services FOR UPDATE USING (true);
CREATE POLICY "public_partner_services_delete" ON public.partner_services FOR DELETE USING (true);

CREATE POLICY "public_partner_certifications_select" ON public.partner_certifications FOR SELECT USING (true);
CREATE POLICY "public_partner_certifications_insert" ON public.partner_certifications FOR INSERT WITH CHECK (true);
CREATE POLICY "public_partner_certifications_update" ON public.partner_certifications FOR UPDATE USING (true);
CREATE POLICY "public_partner_certifications_delete" ON public.partner_certifications FOR DELETE USING (true);

CREATE POLICY "public_interactions_select" ON public.interactions FOR SELECT USING (true);
CREATE POLICY "public_interactions_insert" ON public.interactions FOR INSERT WITH CHECK (true);
CREATE POLICY "public_interactions_update" ON public.interactions FOR UPDATE USING (true);
CREATE POLICY "public_interactions_delete" ON public.interactions FOR DELETE USING (true);

CREATE POLICY "public_reminders_select" ON public.reminders FOR SELECT USING (true);
CREATE POLICY "public_reminders_insert" ON public.reminders FOR INSERT WITH CHECK (true);
CREATE POLICY "public_reminders_update" ON public.reminders FOR UPDATE USING (true);
CREATE POLICY "public_reminders_delete" ON public.reminders FOR DELETE USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers
CREATE TRIGGER update_partners_updated_at
    BEFORE UPDATE ON public.partners
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at
    BEFORE UPDATE ON public.reminders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample partners
INSERT INTO public.partners (wca_id, company_name, country_code, country_name, city, office_type, address, phone, email, website, member_since, membership_expires, partner_type, profile_description, is_active)
VALUES 
(10001, 'Global Freight Solutions Ltd', 'GB', 'United Kingdom', 'London', 'head_office', '123 Canary Wharf, London E14 5AB', '+44 20 7946 0958', 'info@globalfreight.co.uk', 'www.globalfreight.co.uk', '2015-03-15', '2026-03-15', 'freight_forwarder', 'Leading UK freight forwarder with global coverage', true),
(10002, 'Shanghai Express Logistics', 'CN', 'China', 'Shanghai', 'head_office', '88 Century Avenue, Pudong', '+86 21 5888 8888', 'sales@shanghaiexpress.cn', 'www.shanghaiexpress.cn', '2018-06-01', '2025-06-01', 'freight_forwarder', 'Premier logistics provider in East China', true),
(10003, 'Rotterdam Port Services BV', 'NL', 'Netherlands', 'Rotterdam', 'head_office', 'Europaweg 100, 3198 LD Rotterdam', '+31 10 123 4567', 'contact@rps.nl', 'www.rps.nl', '2012-01-10', '2025-01-10', 'nvocc', 'Specialized in European port logistics', true),
(10004, 'Dubai Cargo Hub LLC', 'AE', 'United Arab Emirates', 'Dubai', 'head_office', 'Dubai Airport Free Zone', '+971 4 299 1234', 'info@dubaicargohub.ae', 'www.dubaicargohub.ae', '2019-09-20', '2025-09-20', '3pl', 'Gateway to Middle East and Africa', true),
(10005, 'Sydney Freight Partners', 'AU', 'Australia', 'Sydney', 'head_office', '100 George Street, Sydney NSW 2000', '+61 2 9999 0000', 'hello@syfp.com.au', 'www.syfp.com.au', '2016-11-05', '2026-11-05', 'customs_broker', 'Australia''s trusted customs broker', true),
(10006, 'Hamburg Shipping GmbH', 'DE', 'Germany', 'Hamburg', 'head_office', 'Hafenstraße 50, 20459 Hamburg', '+49 40 123 4567', 'info@hamburgshipping.de', 'www.hamburgshipping.de', '2010-04-22', '2025-04-22', 'carrier', 'Ocean carrier specializing in European trade', true),
(10007, 'Singapore Air Cargo Pte Ltd', 'SG', 'Singapore', 'Singapore', 'head_office', 'Changi Airport Logistics Park', '+65 6543 2100', 'ops@sgaircargo.com', 'www.sgaircargo.com', '2014-07-18', '2025-07-18', 'freight_forwarder', 'Air freight specialists in Asia Pacific', true),
(10008, 'Milan Intermodal SpA', 'IT', 'Italy', 'Milan', 'head_office', 'Via Monte Rosa 91, 20149 Milano', '+39 02 4567 8900', 'info@milanintermodal.it', 'www.milanintermodal.it', '2017-02-28', '2025-02-28', 'freight_forwarder', 'Intermodal solutions across Europe', true),
(10009, 'Tokyo Logistics Corp', 'JP', 'Japan', 'Tokyo', 'head_office', '1-1-1 Shibuya, Tokyo 150-0002', '+81 3 1234 5678', 'contact@tokyologistics.jp', 'www.tokyologistics.jp', '2013-08-12', '2025-08-12', 'freight_forwarder', 'Japan''s premier logistics partner', true),
(10010, 'São Paulo Transporte Ltda', 'BR', 'Brazil', 'São Paulo', 'head_office', 'Av. Paulista 1000, São Paulo', '+55 11 3456 7890', 'vendas@sptransporte.com.br', 'www.sptransporte.com.br', '2020-05-10', '2025-05-10', '3pl', 'South America logistics expertise', true);