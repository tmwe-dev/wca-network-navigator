-- ai_field_values: introspezione dei VALORI reali di un campo (stile tmwe_campi)
create or replace function public.ai_field_values(
  p_table text,
  p_column text,
  p_limit int default 20,
  p_filter text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  allowed text[] := array[
    'partners','partner_contacts','imported_contacts','business_cards','prospects',
    'prospect_contacts','activities','reminders','deals','channel_messages',
    'email_classifications','outreach_queue','agents','kb_entries','blacklist_entries'
  ];
  blocked text[] := array['raw_data','raw_profile_html','raw_profile_markdown','enrichment_data',
    'lead_score_breakdown','password','token','secret','embedding'];
  v_total bigint;
  v_nonnull bigint;
  v_distinct bigint;
  v_values jsonb;
begin
  if not (p_table = any(allowed)) then
    return jsonb_build_object('error', format('Tabella %s non consentita', p_table), 'allowed_tables', to_jsonb(allowed));
  end if;
  if p_column = any(blocked) then
    return jsonb_build_object('error', format('Campo %s non ispezionabile', p_column));
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name=p_column
  ) then
    return jsonb_build_object(
      'error', format('Campo %s inesistente in %s', p_column, p_table),
      'available_columns', (
        select jsonb_agg(column_name order by ordinal_position)
        from information_schema.columns
        where table_schema='public' and table_name=p_table
      )
    );
  end if;

  execute format(
    'select count(*), count(%1$I), count(distinct %1$I) from public.%2$I where (%3$L::text is null or true)',
    p_column, p_table, p_filter
  ) into v_total, v_nonnull, v_distinct;

  execute format(
    'select coalesce(jsonb_agg(x), ''[]''::jsonb) from ('
    || ' select jsonb_build_object(''value'', %1$I::text, ''count'', count(*)) as x'
    || ' from public.%2$I'
    || ' where %1$I is not null'
    || '   and (%3$L::text is null or %1$I::text ilike ''%%''||%3$L||''%%'')'
    || ' group by %1$I order by count(*) desc limit %4$s) t',
    p_column, p_table, p_filter, greatest(1, least(coalesce(p_limit,20), 100))
  ) into v_values;

  return jsonb_build_object(
    'table', p_table,
    'column', p_column,
    'total_rows', v_total,
    'non_null', v_nonnull,
    'null_count', v_total - v_nonnull,
    'distinct_values', v_distinct,
    'top_values', v_values,
    'diagnosis', case
      when v_nonnull = 0 then 'CAMPO VUOTO: nessun record valorizzato. Il dato non esiste, non e un filtro sbagliato.'
      else 'CAMPO POPOLATO: se una query non trova nulla, il filtro/valore usato e probabilmente sbagliato. Confronta con top_values.'
    end
  );
end;
$$;

grant execute on function public.ai_field_values(text,text,int,text) to authenticated, service_role;
comment on function public.ai_field_values is 'Introspezione valori reali di un campo per distinguere dato assente da filtro errato.';

-- ai_find_anything: ricerca full-text trasversale senza conoscere il nome del campo
create or replace function public.ai_find_anything(
  p_query text,
  p_limit int default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  q text := '%' || trim(coalesce(p_query, '')) || '%';
  lim int := greatest(1, least(coalesce(p_limit, 10), 50));
  res jsonb := '[]'::jsonb;
begin
  if length(trim(coalesce(p_query,''))) < 2 then
    return jsonb_build_object('error', 'Query troppo corta (min 2 caratteri)');
  end if;

  res := res || coalesce((
    select jsonb_agg(jsonb_build_object(
      'source','partners','id',id,'label',company_name,
      'matched_on', case when company_name ilike q then 'company_name'
                        when email ilike q then 'email'
                        when city ilike q then 'city'
                        when address ilike q then 'address'
                        when phone ilike q or mobile ilike q then 'phone'
                        when website ilike q then 'website'
                        when country_name ilike q then 'country_name'
                        else 'profile_description' end,
      'detail', jsonb_build_object('city',city,'country',country_name,'email',email,'phone',phone,'address',address,'website',website)))
    from (
      select * from public.partners
      where deleted_at is null and (
        company_name ilike q or company_alias ilike q or email ilike q or city ilike q or address ilike q
        or phone ilike q or mobile ilike q or website ilike q or country_name ilike q or wca_id::text = trim(p_query)
        or profile_description ilike q)
      order by company_name limit lim) p), '[]'::jsonb);

  res := res || coalesce((
    select jsonb_agg(jsonb_build_object(
      'source','partner_contacts','id',c.id,'label',c.name,
      'matched_on', case when c.name ilike q then 'name' when c.email ilike q then 'email'
                        when c.title ilike q then 'title' else 'phone' end,
      'detail', jsonb_build_object('email',c.email,'phone',coalesce(c.direct_phone,c.mobile),'title',c.title,
                                   'partner_id',c.partner_id,'company',pp.company_name)))
    from (
      select * from public.partner_contacts
      where deleted_at is null and (name ilike q or contact_alias ilike q or email ilike q or title ilike q
        or direct_phone ilike q or mobile ilike q)
      order by name limit lim) c
    left join public.partners pp on pp.id = c.partner_id), '[]'::jsonb);

  res := res || coalesce((
    select jsonb_agg(jsonb_build_object(
      'source','imported_contacts','id',id,'label',coalesce(name, company_name),
      'matched_on', case when name ilike q then 'name' when company_name ilike q then 'company_name'
                        when email ilike q then 'email' when city ilike q then 'city'
                        when address ilike q then 'address' else 'phone' end,
      'detail', jsonb_build_object('company',company_name,'email',email,'phone',coalesce(phone,mobile),
                                   'city',city,'country',country,'address',address,'lead_status',lead_status)))
    from (
      select * from public.imported_contacts
      where deleted_at is null and (name ilike q or company_name ilike q or company_alias ilike q
        or contact_alias ilike q or email ilike q or phone ilike q or mobile ilike q or city ilike q
        or country ilike q or address ilike q or note ilike q)
      order by created_at desc limit lim) i), '[]'::jsonb);

  res := res || coalesce((
    select jsonb_agg(jsonb_build_object(
      'source','business_cards','id',id,'label',coalesce(contact_name, company_name),
      'matched_on', case when contact_name ilike q then 'contact_name' when company_name ilike q then 'company_name'
                        when email ilike q then 'email' when location ilike q then 'location' else 'phone' end,
      'detail', jsonb_build_object('company',company_name,'email',email,'phone',coalesce(phone,mobile),
                                   'position',position,'event',event_name,'location',location)))
    from (
      select * from public.business_cards
      where deleted_at is null and (contact_name ilike q or company_name ilike q or email ilike q
        or phone ilike q or mobile ilike q or position ilike q or event_name ilike q or location ilike q or notes ilike q)
      order by created_at desc limit lim) b), '[]'::jsonb);

  res := res || coalesce((
    select jsonb_agg(jsonb_build_object(
      'source','prospects','id',id,'label',company_name,
      'matched_on', case when company_name ilike q then 'company_name' when email ilike q then 'email'
                        when city ilike q then 'city' when partita_iva ilike q then 'partita_iva'
                        when address ilike q then 'address' else 'other' end,
      'detail', jsonb_build_object('city',city,'province',province,'email',email,'phone',phone,
                                   'address',address,'partita_iva',partita_iva,'website',website)))
    from (
      select * from public.prospects
      where (company_name ilike q or email ilike q or pec ilike q or phone ilike q or city ilike q
        or province ilike q or address ilike q or partita_iva ilike q or codice_fiscale ilike q or website ilike q)
      order by company_name limit lim) pr), '[]'::jsonb);

  res := res || coalesce((
    select jsonb_agg(jsonb_build_object(
      'source','prospect_contacts','id',id,'label',name,
      'matched_on', case when name ilike q then 'name' when email ilike q then 'email' else 'phone' end,
      'detail', jsonb_build_object('email',email,'phone',phone,'role',role,'prospect_id',prospect_id)))
    from (
      select * from public.prospect_contacts
      where (name ilike q or email ilike q or phone ilike q or role ilike q or linkedin_url ilike q)
      order by name limit lim) pc), '[]'::jsonb);

  return jsonb_build_object(
    'query', p_query,
    'total_matches', jsonb_array_length(res),
    'partial', jsonb_array_length(res) >= lim,
    'results', res
  );
end;
$$;

grant execute on function public.ai_find_anything(text,int) to authenticated, service_role;
comment on function public.ai_find_anything is 'Ricerca trasversale su partner, contatti, biglietti, prospect senza conoscere il campo esatto.';