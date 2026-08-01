-- Deal Pipeline Management System
-- Tables for tracking business opportunities, stages, and activities

-- Main deals table
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES imported_contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  stage text NOT NULL DEFAULT 'lead',
  -- Stages: lead → qualified → proposal → negotiation → won / lost
  amount numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'EUR',
  probability integer DEFAULT 10 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date date,
  actual_close_date date,
  lost_reason text,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Stage probability defaults (can be overridden):
-- lead: 10%, qualified: 25%, proposal: 50%, negotiation: 75%, won: 100%, lost: 0%

-- Deal activity log — tracks all changes and interactions
CREATE TABLE IF NOT EXISTS deal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  -- Types: stage_change, note, email_sent, call, meeting, update
  description text,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

-- Row Level Security (RLS)
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals_user_access" ON deals
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "deal_activities_user_access" ON deal_activities
  FOR ALL
  USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_deals_user_stage ON deals(user_id, stage);
CREATE INDEX idx_deals_partner ON deals(partner_id);
CREATE INDEX idx_deals_contact ON deals(contact_id);
CREATE INDEX idx_deals_expected_close ON deals(expected_close_date);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX idx_deal_activities_deal ON deal_activities(deal_id);
CREATE INDEX idx_deal_activities_user ON deal_activities(user_id);
CREATE INDEX idx_deal_activities_created_at ON deal_activities(created_at DESC);

-- Enable real-time for deals
ALTER TABLE deals REPLICA IDENTITY FULL;
ALTER TABLE deal_activities REPLICA IDENTITY FULL;
