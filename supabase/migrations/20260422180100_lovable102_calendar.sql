-- Calendar system: events table with full support for meetings, calls, tasks, reminders, and follow-ups
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'meeting', -- meeting, call, task, reminder, follow_up
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean DEFAULT false,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES imported_contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  location text,
  color text DEFAULT '#3B82F6',
  recurrence text, -- daily, weekly, monthly, none
  reminder_minutes integer DEFAULT 15,
  status text DEFAULT 'scheduled', -- scheduled, completed, cancelled
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see/edit their own events
CREATE POLICY "calendar_user" ON calendar_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for efficient queries
CREATE INDEX idx_calendar_user_date ON calendar_events(user_id, start_at);
CREATE INDEX idx_calendar_partner ON calendar_events(partner_id);
CREATE INDEX idx_calendar_deal ON calendar_events(deal_id);
CREATE INDEX idx_calendar_contact ON calendar_events(contact_id);
CREATE INDEX idx_calendar_status ON calendar_events(status);
