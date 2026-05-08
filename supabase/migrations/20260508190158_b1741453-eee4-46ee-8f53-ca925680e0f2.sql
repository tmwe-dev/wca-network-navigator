
CREATE OR REPLACE FUNCTION public.compare_funnemail_vault_key(p_value text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_vault text;
BEGIN
  SELECT decrypted_secret INTO v_vault FROM vault.decrypted_secrets WHERE name='funnemail_trigger_service_role_key' LIMIT 1;
  RETURN jsonb_build_object(
    'vault_present', v_vault IS NOT NULL,
    'vault_len', length(coalesce(v_vault,'')),
    'env_len', length(coalesce(p_value,'')),
    'match', (v_vault IS NOT NULL AND v_vault = p_value),
    'vault_prefix', LEFT(coalesce(v_vault,''), 20),
    'env_prefix', LEFT(coalesce(p_value,''), 20)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compare_funnemail_vault_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compare_funnemail_vault_key(text) TO service_role;
