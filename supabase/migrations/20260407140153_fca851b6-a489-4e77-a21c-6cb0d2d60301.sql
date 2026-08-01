
-- Drop the restrictive single-user policy
DROP POLICY IF EXISTS "Users can manage own business_cards" ON public.business_cards;

-- Allow all authenticated users to read all business cards (single-tenant shared)
CREATE POLICY "Authenticated users can read business_cards"
  ON public.business_cards FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert (with their own user_id)
CREATE POLICY "Authenticated users can insert business_cards"
  ON public.business_cards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow all authenticated users to update any business card
CREATE POLICY "Authenticated users can update business_cards"
  ON public.business_cards FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
