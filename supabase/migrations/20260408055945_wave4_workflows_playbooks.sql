-- ─────────────────────────────────────────────────────────────────────────────
-- Wave 4 — Enterprise AI Doctrine
--
-- Vol. II "Il Metodo Enterprise" §12 — workflow gate-based + commercial
-- playbook + operator briefing storage.
--
-- 1) commercial_workflows: definizione di workflow multi-gate
--    (lead_qualification, recovery_silent_partner, post_event_followup, …)
-- 2) partner_workflow_state: stato corrente di un partner in un workflow
-- 3) commercial_playbooks: playbook di alto livello (set di prompt + KB tags
--    + workflow di riferimento) attivabili per pattern ricorrenti
-- 4) ai_session_briefings: storage del briefing operatore per sessione
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. commercial_workflows ──────────────────────────────────────────────────
create table if not exists public.commercial_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  category text not null default 'commercial',
  -- gates: array di oggetti { name, objective, exit_criteria[], suggested_tools[] }
  gates jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists commercial_workflows_user_active_idx
  on public.commercial_workflows(user_id, is_active);

alter table public.commercial_workflows enable row level security;

drop policy if exists "commercial_workflows owner crud"
  on public.commercial_workflows;
create policy "commercial_workflows owner crud"
  on public.commercial_workflows
  for all
  using (user_id = auth.uid() or is_template = true)
  with check (user_id = auth.uid());

-- ── 2. partner_workflow_state ────────────────────────────────────────────────
create table if not exists public.partner_workflow_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete cascade,
  contact_id uuid,
  workflow_id uuid not null references public.commercial_workflows(id) on delete cascade,
  current_gate int not null default 0,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'aborted')),
  context jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);

create index if not exists pws_partner_idx
  on public.partner_workflow_state(partner_id) where status = 'active';
create index if not exists pws_user_status_idx
  on public.partner_workflow_state(user_id, status);

alter table public.partner_workflow_state enable row level security;

drop policy if exists "pws owner crud" on public.partner_workflow_state;
create policy "pws owner crud"
  on public.partner_workflow_state
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Trigger to keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pws_touch on public.partner_workflow_state;
create trigger pws_touch
  before update on public.partner_workflow_state
  for each row execute function public.touch_updated_at();

drop trigger if exists cw_touch on public.commercial_workflows;
create trigger cw_touch
  before update on public.commercial_workflows
  for each row execute function public.touch_updated_at();

-- ── 3. commercial_playbooks ──────────────────────────────────────────────────
create table if not exists public.commercial_playbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  -- trigger_conditions: oggetto JSON per match automatico
  --   es. { "country_code": ["IT", "DE"], "lead_status": "cold", "no_contact_days": 90 }
  trigger_conditions jsonb not null default '{}'::jsonb,
  -- workflow_code: collegamento opzionale a commercial_workflows.code
  workflow_code text,
  -- kb_tags: tag KB da attivare in priorità quando il playbook è in uso
  kb_tags text[] not null default '{}',
  -- prompt_template: testo iniettato come "PLAYBOOK ATTIVO" nel system prompt
  prompt_template text,
  -- suggested_actions: lista azioni operative da proporre come "🎯 Azioni"
  suggested_actions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  is_template boolean not null default false,
  priority int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists playbooks_user_active_idx
  on public.commercial_playbooks(user_id, is_active);

alter table public.commercial_playbooks enable row level security;

drop policy if exists "playbooks owner crud" on public.commercial_playbooks;
create policy "playbooks owner crud"
  on public.commercial_playbooks
  for all
  using (user_id = auth.uid() or is_template = true)
  with check (user_id = auth.uid());

drop trigger if exists pb_touch on public.commercial_playbooks;
create trigger pb_touch
  before update on public.commercial_playbooks
  for each row execute function public.touch_updated_at();

-- ── 4. ai_session_briefings ──────────────────────────────────────────────────
-- Vol. II §12.4 — Briefing operatore: istruzioni temporanee ad alta priorità
-- che l'operatore può fornire all'AI per la sessione corrente.
create table if not exists public.ai_session_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  briefing text not null,
  scope text not null default 'session'
    check (scope in ('session', 'partner', 'workflow', 'global')),
  scope_id uuid,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists briefings_user_active_idx
  on public.ai_session_briefings(user_id, active);

alter table public.ai_session_briefings enable row level security;

drop policy if exists "briefings owner crud" on public.ai_session_briefings;
create policy "briefings owner crud"
  on public.ai_session_briefings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED — Workflow templates (is_template=true, accessibili a tutti)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.commercial_workflows (
  user_id, code, name, description, category, gates, is_template, is_active
) values
(null, 'lead_qualification', 'Qualifica Lead WCA', 'Workflow standard per qualificare un nuovo partner WCA come lead commerciale (BANT-style adattato al freight forwarding).', 'commercial', '[
  {"name":"Discovery","objective":"Raccogli informazioni base sul partner: servizi, network, sede, contatti chiave","exit_criteria":["Profilo scaricato o enriched","Almeno 1 contatto operativo identificato","Servizi principali noti"],"suggested_tools":["search_partners","deep_search_partner","enrich_partner_website"]},
  {"name":"Fit Analysis","objective":"Verifica fit con la nostra offerta: rotte, settori, volumi","exit_criteria":["Rotte di interesse identificate","Compatibilità servizi confermata","Note di fit salvate come memoria"],"suggested_tools":["get_partner_detail","add_partner_note","save_memory"]},
  {"name":"First Contact","objective":"Primo outreach personalizzato sul canale preferito","exit_criteria":["Email/LinkedIn/WhatsApp inviato","Activity registrata","Reminder follow-up creato"],"suggested_tools":["generate_outreach","send_email","create_activity","create_reminder"]},
  {"name":"Engagement","objective":"Gestisci la risposta e qualifica reale (BANT)","exit_criteria":["Risposta ricevuta o 2 follow-up tentati","Bisogno chiaro identificato","Decision maker identificato"],"suggested_tools":["update_lead_status","add_partner_note","save_memory"]},
  {"name":"Proposal","objective":"Invio proposta commerciale concreta","exit_criteria":["Proposta inviata","Activity con tipo proposal registrata","Reminder per chiusura impostato"],"suggested_tools":["generate_outreach","send_email","create_activity"]},
  {"name":"Closing","objective":"Chiusura della trattativa e conversione","exit_criteria":["Esito definitivo registrato (won/lost)","Lead status aggiornato","Memoria di outcome salvata per learning"],"suggested_tools":["update_lead_status","save_memory","add_partner_note"]}
]'::jsonb, true, true),

(null, 'recovery_silent_partner', 'Recovery Partner Silente', 'Re-ingaggio di partner che non rispondono da >90 giorni.', 'recovery', '[
  {"name":"Audit Storia","objective":"Analizza ultime interazioni per capire il contesto del silenzio","exit_criteria":["Ultime 5 interazioni lette","Causa probabile del silenzio identificata","Memoria di context salvata"],"suggested_tools":["list_activities","get_partner_detail","search_memory"]},
  {"name":"Approccio Soft","objective":"Messaggio di re-ingaggio non commerciale (valore puro)","exit_criteria":["Messaggio inviato con tono diverso dal precedente","Contenuto value-based (insight, news settore)","Activity registrata"],"suggested_tools":["generate_outreach","send_email"]},
  {"name":"Escalation","objective":"Se nessuna risposta, prova canale alternativo o contatto secondario","exit_criteria":["Canale alternativo tentato","Contatto secondario identificato e contattato","Reminder finale impostato"],"suggested_tools":["manage_partner_contact","generate_outreach","create_reminder"]},
  {"name":"Decisione","objective":"Decide outcome: riattivato / archiviato / blacklist","exit_criteria":["Lead status finale aggiornato","Memoria di outcome con learning salvata"],"suggested_tools":["update_lead_status","save_memory"]}
]'::jsonb, true, true),

(null, 'post_event_followup', 'Follow-up Post Evento', 'Follow-up strutturato dopo un evento/fiera con un nuovo contatto.', 'commercial', '[
  {"name":"Cattura","objective":"Registra il contatto raccolto in fiera con contesto evento","exit_criteria":["Partner/contatto creato o aggiornato","Note evento salvate","Tag evento applicato"],"suggested_tools":["search_partners","manage_partner_contact","add_partner_note"]},
  {"name":"Thank You","objective":"Email di ringraziamento entro 48h dall''evento","exit_criteria":["Email personalizzata sull''evento inviata","Activity registrata"],"suggested_tools":["generate_outreach","send_email","create_activity"]},
  {"name":"Value Drop","objective":"Secondo contatto a 7 giorni con contenuto di valore","exit_criteria":["Materiale rilevante condiviso","Activity registrata","Reminder per terzo contatto impostato"],"suggested_tools":["generate_outreach","send_email","create_reminder"]},
  {"name":"Qualifica","objective":"Sposta in workflow lead_qualification se interessato","exit_criteria":["Decisione presa: qualifica o archiviazione","Lead status aggiornato"],"suggested_tools":["update_lead_status","save_memory"]}
]'::jsonb, true, true)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED — Commercial playbook templates
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.commercial_playbooks (
  user_id, code, name, description, trigger_conditions, workflow_code,
  kb_tags, prompt_template, suggested_actions, is_template, priority, is_active
) values
(null, 'cold_partner_eu', 'Cold Partner UE — Primo Contatto', 'Strategia per primo contatto con partner WCA in Unione Europea che non hanno mai interagito con noi.', '{"country_codes":["IT","DE","FR","ES","NL","BE","AT","PT","PL"],"lead_status":["cold","new"]}'::jsonb, 'lead_qualification', '{cold_outreach,struttura_email,hook,filosofia,EUR}', 'PLAYBOOK ATTIVO: Cold Partner UE — Primo Contatto.

REGOLE SPECIFICHE:
• Lingua: usa la lingua locale del partner (italiano per IT, tedesco per DE/AT, francese per FR/BE, ecc.)
• Tono: formale-professionale, MAI familiare
• Hook: cita un dato concreto del partner (rotta, certificazione, sede) per dimostrare ricerca
• CTA: domanda aperta su una rotta/servizio specifico, MAI "vorrei presentarmi"
• Lunghezza: massimo 120 parole
• Firma: completa con ruolo e azienda
• NO claim non verificati: niente "siamo i migliori", "leader nel settore"', '[
  {"label":"Genera Email Cold","action":"generate_outreach","emoji":"📧"},
  {"label":"Deep Search Partner","action":"deep_search_partner","emoji":"🔍"},
  {"label":"Crea Reminder Follow-up","action":"create_reminder","emoji":"⏰"}
]'::jsonb, true, 8, true),

(null, 'high_value_recovery', 'Recovery Partner Alto Valore', 'Per partner con rating ≥4 silenti da >90 giorni: approccio personalizzato e valore-prima.', '{"min_rating":4,"silent_days":90}'::jsonb, 'recovery_silent_partner', '{recovery,chris_voss,negoziazione,obiezioni}', 'PLAYBOOK ATTIVO: Recovery Partner Alto Valore.

Questo è un partner con storia commerciale e rating alto. Il silenzio NON significa disinteresse: probabilmente ha un blocker che non conosciamo.

REGOLE:
• Tecniche Chris Voss: usa labeling ("sembra che…") e mirroring
• NO push commerciale: il primo messaggio deve essere PURO VALORE (insight, news settore, segnalazione opportunità)
• Domanda aperta calibrata ("come stai gestendo X di questi tempi?")
• Riferimento esplicito alla storia comune (cita ultime collaborazioni dalla cronologia)
• Tono caldo, da pari', '[
  {"label":"Leggi Cronologia","action":"list_activities","emoji":"📖"},
  {"label":"Genera Messaggio Value","action":"generate_outreach","emoji":"💡"},
  {"label":"Salva Insight in Memoria","action":"save_memory","emoji":"🧠"}
]'::jsonb, true, 9, true),

(null, 'event_capture', 'Cattura Contatto Fiera', 'Workflow rapido per registrare contatti raccolti in fiera con contesto evento.', '{"trigger":"manual","tags":["fiera","evento","networking"]}'::jsonb, 'post_event_followup', '{cold_outreach,filosofia,struttura_email}', 'PLAYBOOK ATTIVO: Cattura Contatto Fiera.

L''utente ha appena incontrato qualcuno in fiera. Tuo compito:
1. Registra il contatto con TUTTE le info disponibili (azienda, ruolo, email, telefono)
2. Tag specifici: nome evento, data, città
3. Nota libera: cosa vi siete detti, interesse espresso, prossimo step concordato
4. Crea reminder per follow-up entro 48h
5. Suggerisci di passare al workflow post_event_followup', '[
  {"label":"Crea Contatto","action":"manage_partner_contact","emoji":"➕"},
  {"label":"Aggiungi Nota Evento","action":"add_partner_note","emoji":"📝"},
  {"label":"Reminder 48h","action":"create_reminder","emoji":"⏰"},
  {"label":"Avvia Workflow","action":"start_workflow","emoji":"🚦"}
]'::jsonb, true, 7, true)
on conflict do nothing;
