CREATE OR REPLACE FUNCTION public.v3_list_deleted(_tipo text DEFAULT NULL, _giorni int DEFAULT 90, _limite int DEFAULT 100)
RETURNS TABLE(tipo text, id uuid, nome text, dettaglio text, eliminato_il timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.get_current_operator_id() IS NULL THEN
    RAISE EXCEPTION 'accesso negato';
  END IF;

  RETURN QUERY
  SELECT s.tipo, s.id, s.nome, s.dettaglio, s.eliminato_il FROM (
    SELECT 'partner'::text AS tipo, p.id, COALESCE(p.company_name, '(senza nome)')::text AS nome, p.email::text AS dettaglio, p.deleted_at AS eliminato_il
      FROM public.partners p WHERE p.deleted_at IS NOT NULL
    UNION ALL
    SELECT 'contatto'::text, c.id, COALESCE(c.name, c.company_name, '(senza nome)')::text, c.email::text, c.deleted_at
      FROM public.imported_contacts c WHERE c.deleted_at IS NOT NULL
    UNION ALL
    SELECT 'messaggio'::text, m.id, COALESCE(m.subject, '(senza oggetto)')::text, m.from_address::text, m.deleted_at
      FROM public.channel_messages m WHERE m.deleted_at IS NOT NULL
  ) s
  WHERE (_tipo IS NULL OR s.tipo = _tipo)
    AND s.eliminato_il > now() - make_interval(days => GREATEST(_giorni, 1))
  ORDER BY s.eliminato_il DESC
  LIMIT LEAST(GREATEST(_limite, 1), 500);
END;
$$;

GRANT EXECUTE ON FUNCTION public.v3_list_deleted(text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.v3_restore_deleted(_tipo text, _id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.get_current_operator_id() IS NULL THEN
    RAISE EXCEPTION 'accesso negato';
  END IF;

  IF _tipo = 'partner' THEN
    UPDATE public.partners SET deleted_at = NULL, deleted_by = NULL WHERE id = _id AND deleted_at IS NOT NULL;
  ELSIF _tipo = 'contatto' THEN
    UPDATE public.imported_contacts SET deleted_at = NULL, deleted_by = NULL WHERE id = _id AND deleted_at IS NOT NULL;
  ELSE
    RAISE EXCEPTION 'tipo non ripristinabile: %', _tipo;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.v3_restore_deleted(text, uuid) TO authenticated;