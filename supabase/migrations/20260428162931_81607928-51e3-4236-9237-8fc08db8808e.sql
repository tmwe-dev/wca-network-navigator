create or replace function public.ai_introspect_schema(table_names text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  result jsonb := '[]'::jsonb;
  tbl text;
  cols jsonb;
begin
  foreach tbl in array table_names loop
    select jsonb_agg(
      jsonb_build_object(
        'name', c.column_name,
        'type', case
                  when c.data_type = 'USER-DEFINED' then 'enum:' || c.udt_name
                  when c.data_type in ('character varying','character','text') then 'string'
                  when c.data_type in ('integer','bigint','smallint','numeric','double precision','real') then 'number'
                  when c.data_type = 'boolean' then 'boolean'
                  when c.data_type like 'timestamp%' or c.data_type = 'date' then 'date'
                  when c.data_type = 'uuid' then 'uuid'
                  when c.data_type = 'jsonb' or c.data_type = 'json' then 'json'
                  else c.data_type
                end,
        'nullable', c.is_nullable = 'YES',
        'enum_values', case
                         when c.data_type = 'USER-DEFINED' then (
                           select jsonb_agg(e.enumlabel order by e.enumsortorder)
                           from pg_type t
                           join pg_enum e on e.enumtypid = t.oid
                           where t.typname = c.udt_name
                         )
                         else null
                       end
      )
      order by c.ordinal_position
    )
    into cols
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = tbl
      and c.column_name not in (
        'user_id','operator_id','assigned_to','tenant_id','organization_id',
        'raw_data','enrichment_data','encrypted_data','password','token','secret',
        'lead_score_breakdown'
      );

    if cols is not null then
      result := result || jsonb_build_object('table', tbl, 'columns', cols);
    end if;
  end loop;

  return result;
end;
$$;

grant execute on function public.ai_introspect_schema(text[]) to authenticated, anon, service_role;

comment on function public.ai_introspect_schema is
  'Returns live schema (columns + enum values) for whitelisted tables. Used by ai-query-planner to give the LLM real-time, accurate schema knowledge without hardcoded duplication.';