create or replace function public.v3_directory(
  _search text default null,
  _fonte text default null,
  _paese text default null,
  _stato text default null,
  _solo_email boolean default false,
  _offset integer default 0,
  _limit integer default 50
)
returns table (
  fonte text,
  id uuid,
  nome text,
  azienda text,
  email text,
  telefono text,
  paese text,
  ruolo text,
  stato text,
  interazioni integer,
  ultima_interazione timestamptz,
  totale bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      'crm'::text as fonte,
      ic.id,
      ic.name as nome,
      ic.company_name as azienda,
      ic.email,
      coalesce(nullif(ic.phone, ''), nullif(ic.mobile, '')) as telefono,
      ic.country as paese,
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
      null,
      p.lead_status,
      coalesce(p.interaction_count, 0),
      p.last_interaction_at
    from public.partners p
    where p.deleted_at is null
  ),
  filtered as (
    select b.*
    from base b
    where (_fonte is null or b.fonte = _fonte)
      and (_paese is null or b.paese = _paese)
      and (_stato is null or b.stato = _stato)
      and (not _solo_email or nullif(b.email, '') is not null)
      and (
        _search is null
        or b.nome ilike '%' || _search || '%'
        or b.azienda ilike '%' || _search || '%'
        or b.email ilike '%' || _search || '%'
      )
  )
  select
    f.fonte, f.id, f.nome, f.azienda, f.email, f.telefono, f.paese, f.ruolo,
    f.stato, f.interazioni, f.ultima_interazione,
    count(*) over() as totale
  from filtered f
  order by f.ultima_interazione desc nulls last, f.nome asc nulls last
  offset greatest(_offset, 0)
  limit least(greatest(_limit, 1), 200);
$$;

grant execute on function public.v3_directory(text, text, text, text, boolean, integer, integer) to authenticated;

create or replace function public.v3_directory_countries()
returns table (paese text)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct v.paese
  from (
    select ic.country as paese from public.imported_contacts ic where ic.deleted_at is null
    union
    select bc.location from public.business_cards bc where bc.deleted_at is null
    union
    select coalesce(p.country_name, p.country_code::text) from public.partners p where p.deleted_at is null
  ) v
  where nullif(v.paese, '') is not null
  order by 1;
$$;

grant execute on function public.v3_directory_countries() to authenticated;