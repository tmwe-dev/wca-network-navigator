CREATE OR REPLACE FUNCTION public.guard_sender_group_name_not_destination()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_norm TEXT;
  v_reserved TEXT[] := ARRAY[
    'operativo','operations','rfq','tasks','support','internal','alerts','alert',
    'newsletter','spam','archive','to_sort','info','other_urgent','no_reply','ads',
    'da_smistare','smistare','urgenze','urgenza','urgente','da_lavorare'
  ];
BEGIN
  v_norm := lower(trim(NEW.nome_gruppo));
  IF v_norm = ANY(v_reserved) THEN
    RAISE EXCEPTION 'Il nome "%" è una destinazione FunneMail, non un gruppo mittente. Rinomina (es. Clienti, Fornitori, Banca, Partners).', NEW.nome_gruppo
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sender_group_name ON public.email_sender_groups;
CREATE TRIGGER trg_guard_sender_group_name
  BEFORE INSERT OR UPDATE OF nome_gruppo ON public.email_sender_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_sender_group_name_not_destination();

COMMENT ON FUNCTION public.guard_sender_group_name_not_destination() IS
  'Impedisce di nominare un gruppo mittente con un termine riservato alle cartelle di destinazione FunneMail. Gruppo = chi scrive (Clienti, Fornitori). Cartella = dove va lavorata la mail (RFQ, Tasks, Support).';