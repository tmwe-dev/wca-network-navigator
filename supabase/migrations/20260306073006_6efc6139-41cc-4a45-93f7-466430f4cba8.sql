
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id uuid,
  p_amount integer,
  p_operation text DEFAULT 'ai_call',
  p_description text DEFAULT NULL
)
RETURNS TABLE(success boolean, new_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  -- Atomic deduction with balance check
  UPDATE user_credits
  SET balance = balance - p_amount,
      total_consumed = total_consumed + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
    AND balance >= p_amount
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, COALESCE((SELECT balance FROM user_credits WHERE user_id = p_user_id), 0);
    RETURN;
  END IF;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, amount, operation, description)
  VALUES (p_user_id, -p_amount, p_operation, p_description);

  RETURN QUERY SELECT true, v_new_balance;
END;
$$;
