DROP FUNCTION IF EXISTS public.v3_directory(text, text, text, text, boolean, integer, integer);

CREATE OR REPLACE FUNCTION public.v3_directory(
  _search text DEFAULT NULL,
  _fonte text DEFAULT NULL,
  _paese text DEFAULT NULL,
  _stato text DEFAULT NULL,
  _solo_email boolean DEFAULT false,
  _offset integer DEFAULT 0,
  _limit integer DEFAULT 50
)
RETURNS TABLE(
  fonte text, id uuid, nome text, azienda text, email text, telefono text,
  paese text, paese_code text, dominio text, ruolo text, stato text,
  interazioni integer, ultima_interazione timestamptz, colleghi integer, totale bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  with base as (
    select
      'crm'::text as fonte,
      ic.id,
      ic.name as nome,
      ic.company_name as azienda,
      ic.email,
      coalesce(nullif(ic.phone, ''), nullif(ic.mobile, '')) as telefono,
      ic.country as paese,
      null::text as paese_code,
      nullif(lower(split_part(coalesce(ic.email, ''), '@', 2)), '') as dominio,
      ic.position as ruolo,
      ic.lead_status as stato,
      coalesce(ic.interaction_count, 0) as interazioni,
      ic.last_interaction_at as ultima_interazione
    from public.imported_contacts ic
    where ic.deleted_at is null

    union all

    select
      'biglietti'::text,
      bc.id,
      bc.contact_name,
      bc.company_name,
      bc.email,
      coalesce(nullif(bc.phone, ''), nullif(bc.mobile, '')),
      bc.location,
      null::text,
      nullif(lower(split_part(coalesce(bc.email, ''), '@', 2)), ''),
      bc.position,
      bc.lead_status,
      0,
      bc.met_at
    from public.business_cards bc
    where bc.deleted_at is null

    union all

    select
      'wca'::text,
      p.id,
      p.company_name,
      p.company_name,
      p.email,
      coalesce(nullif(p.phone, ''), nullif(p.mobile, '')),
      coalesce(p.country_name, p.country_code::text),
      nullif(upper(p.country_code::text), ''),
      coalesce(
        nullif(lower(regexp_replace(regexp_replace(coalesce(p.website, ''), '^https?://', ''), '^www\.|/.*$', '', 'g')), ''),
        nullif(lower(split_part(coalesce(p.email, ''), '@', 2)), '')
      ),
      null::text,
      p.lead_status,
      coalesce(p.interaction_count, 0),
      p.last_interaction_at
    from public.partners p
    where p.deleted_at is null
  ),
  arricchito as (
    select
      b.*,
      count(*) over (partition by lower(btrim(coalesce(b.azienda, '')))
        )::int as colleghi_raw
    from base b
  ),
  filtered as (
    select a.*
    from arricchito a
    where (_fonte is null or a.fonte = _fonte)
      and (_paese is null or a.paese = _paese)
      and (_stato is null or a.stato = _stato)
      and (not _solo_email or nullif(a.email, '') is not null)
      and (
        _search is null
        or a.nome ilike '%' || _search || '%'
        or a.azienda ilike '%' || _search || '%'
        or a.email ilike '%' || _search || '%'
      )
  )
  select
    f.fonte, f.id, f.nome, f.azienda, f.email, f.telefono, f.paese, f.paese_code,
    case when f.dominio in (
      'gmail.com','hotmail.com','yahoo.com','outlook.com','live.com','icloud.com',
      'aol.com','msn.com','libero.it','me.com','gmx.com','qq.com','163.com','126.com',
      'yahoo.co.in','rediffmail.com','hotmail.it','yahoo.it','protonmail.com'
    ) then null else f.dominio end as dominio,
    f.ruolo, f.stato, f.interazioni, f.ultima_interazione,
    case when nullif(btrim(coalesce(f.azienda, '')), '') is null then 1 else f.colleghi_raw end as colleghi,
    count(*) over() as totale
  from filtered f
  order by f.ultima_interazione desc nulls last, f.nome asc nulls last
  offset greatest(_offset, 0)
  limit least(greatest(_limit, 1), 200);
$function$;

GRANT EXECUTE ON FUNCTION public.v3_directory(text, text, text, text, boolean, integer, integer) TO authenticated;