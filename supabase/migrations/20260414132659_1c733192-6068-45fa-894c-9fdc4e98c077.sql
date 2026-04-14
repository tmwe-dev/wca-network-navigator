
-- Drop the old owner-only SELECT policy
DROP POLICY IF EXISTS "Owner can read business_cards" ON public.business_cards;

-- Allow all authenticated users to read all business cards
CREATE POLICY "Authenticated users can read business_cards"
  ON public.business_cards
  FOR SELECT
  TO authenticated
  USING (true);
