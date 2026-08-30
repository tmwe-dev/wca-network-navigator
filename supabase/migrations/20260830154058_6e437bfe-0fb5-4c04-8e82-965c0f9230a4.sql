create or replace function public.ai_sync_schema_kb()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  tbls text[] := array[
    'partners','partner_contacts','imported_contacts','business_cards','prospects',
    'prospect_contacts','activities','reminders','deals','channel_messages',
    'email_classifications','outreach_queue','ai_pending_actions','cockpit_queue',
    'agents','kb_entries','blacklist_entries','app_settings'
  ];
  t text;
  body text;
  cols text;
  entry_id uuid;
begin
  body := '# Mappa Campi Database (generata dal DB reale)' || E'\n\n'
    || 'Elenco dei campi realmente presenti nelle tabelle operative. Usalo quando l''utente parla in modo generico ' || E'\n'
    || '("indirizzo", "referente", "stato", "telefono") per capire QUALE colonna corrisponde.' || E'\n\n'
    || '## Come cercare un dato senza conoscere il campo' || E'\n'
    || '1. `find_anything` — cerca un testo su partner, contatti partner, contatti importati, biglietti, prospect e ti dice tabella + campo che ha fatto match.' || E'\n'
    || '2. `inspect_field` — mostra i valori reali di una colonna: se `non_null = 0` il dato non esiste; altrimenti il filtro usato era sbagliato (guarda `top_values`).' || E'\n'
    || '3. `describe_tables` — colonne ed enum live di una tabella.' || E'\n\n'
    || '## Sinonimi utente -> campo' || E'\n'
    || '- indirizzo -> partners.address, imported_contacts.address, prospects.address' || E'\n'
    || '- nome persona / referente -> partner_contacts.name, imported_contacts.name, business_cards.contact_name, prospect_contacts.name' || E'\n'
    || '- azienda / societa -> partners.company_name, imported_contacts.company_name, prospects.company_name' || E'\n'
    || '- mail / posta -> partners.email, partner_contacts.email, imported_contacts.email, business_cards.email' || E'\n'
    || '- telefono / cellulare -> partners.phone, partner_contacts.direct_phone, partner_contacts.mobile, imported_contacts.phone' || E'\n'
    || '- ruolo / posizione -> partner_contacts.title, business_cards.position, prospect_contacts.role' || E'\n'
    || '- stato lead -> partners.lead_status, imported_contacts.lead_status, prospects.lead_status' || E'\n'
    || '- paese -> partners.country_code / partners.country_name, imported_contacts.country' || E'\n'
    || '- citta -> partners.city, imported_contacts.city, prospects.city' || E'\n'
    || '- sito -> partners.website, prospects.website' || E'\n'
    || '- partita iva -> prospects.partita_iva' || E'\n\n'
    || '## Tabelle e campi' || E'\n';

  foreach t in array tbls loop
    select string_agg(
      '- `' || c.column_name || '` (' ||
      case
        when c.data_type = 'USER-DEFINED' then 'enum: ' || coalesce((
          select string_agg(e.enumlabel, ' | ' order by e.enumsortorder)
          from pg_type ty join pg_enum e on e.enumtypid = ty.oid where ty.typname = c.udt_name), c.udt_name)
        when c.data_type in ('character varying','character','text') then 'testo'
        when c.data_type in ('integer','bigint','smallint','numeric','double precision','real') then 'numero'
        when c.data_type = 'boolean' then 'booleano'
        when c.data_type like 'timestamp%' or c.data_type = 'date' then 'data'
        else c.data_type
      end || ')', E'\n' order by c.ordinal_position)
    into cols
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = t
      and c.column_name not in ('raw_data','raw_profile_html','raw_profile_markdown','enrichment_data',
        'lead_score_breakdown','embedding','password','token','secret');

    if cols is not null then
      body := body || E'\n### ' || t || E'\n' || cols || E'\n';
    end if;
  end loop;

  select id into entry_id from public.kb_entries
   where canonical_id = 'data-schema/db-fields' and deleted_at is null limit 1;

  if entry_id is null then
    insert into public.kb_entries (category, chapter, title, content, tags, priority, canonical_id, family, is_active)
    values ('data-schema', 'schema', 'Mappa Campi Database (tabelle, colonne, sinonimi)', body,
            array['schema','campi','database','grounding','ricerca'], 9, 'data-schema/db-fields', 'data-schema', true)
    returning id into entry_id;
  else
    update public.kb_entries
       set content = body, updated_at = now(), is_active = true,
           title = 'Mappa Campi Database (tabelle, colonne, sinonimi)'
     where id = entry_id;
  end if;

  return jsonb_build_object('kb_entry_id', entry_id, 'canonical_id', 'data-schema/db-fields', 'length', length(body));
end;
$$;

grant execute on function public.ai_sync_schema_kb() to authenticated, service_role;
comment on function public.ai_sync_schema_kb is 'Rigenera la voce KB data-schema/db-fields dallo schema reale del database.';

select public.ai_sync_schema_kb();