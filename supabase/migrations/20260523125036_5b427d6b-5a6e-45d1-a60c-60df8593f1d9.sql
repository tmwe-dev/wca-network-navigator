-- F0: snapshot di sicurezza pre-semplificazione cervello AI
CREATE SCHEMA IF NOT EXISTS _brain_simplification_backup_2026_05_23;

-- Snapshot tabelle (CTAS = copia dati + struttura base, no constraints/RLS)
CREATE TABLE _brain_simplification_backup_2026_05_23.operative_prompts AS
  SELECT * FROM public.operative_prompts;

CREATE TABLE _brain_simplification_backup_2026_05_23.prompt_versions AS
  SELECT * FROM public.prompt_versions;

CREATE TABLE _brain_simplification_backup_2026_05_23.agents AS
  SELECT * FROM public.agents;

CREATE TABLE _brain_simplification_backup_2026_05_23.agent_capabilities AS
  SELECT * FROM public.agent_capabilities;

CREATE TABLE _brain_simplification_backup_2026_05_23.agent_personas AS
  SELECT * FROM public.agent_personas;

CREATE TABLE _brain_simplification_backup_2026_05_23.ai_routing_config AS
  SELECT * FROM public.ai_routing_config;

CREATE TABLE _brain_simplification_backup_2026_05_23.agent_routing_rules AS
  SELECT * FROM public.agent_routing_rules;

CREATE TABLE _brain_simplification_backup_2026_05_23.prompt_templates AS
  SELECT * FROM public.prompt_templates;

CREATE TABLE _brain_simplification_backup_2026_05_23.email_prompts AS
  SELECT * FROM public.email_prompts;

CREATE TABLE _brain_simplification_backup_2026_05_23.kb_entries AS
  SELECT * FROM public.kb_entries;

-- Metadati snapshot
CREATE TABLE _brain_simplification_backup_2026_05_23._meta (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  purpose text NOT NULL DEFAULT 'F0 backup pre brain-simplification plan 2026-05-23'
);

INSERT INTO _brain_simplification_backup_2026_05_23._meta(table_name, row_count)
SELECT 'operative_prompts',     (SELECT count(*) FROM _brain_simplification_backup_2026_05_23.operative_prompts)
UNION ALL SELECT 'prompt_versions',     (SELECT count(*) FROM _brain_simplification_backup_2026_05_23.prompt_versions)
UNION ALL SELECT 'agents',              (SELECT count(*) FROM _brain_simplification_backup_2026_05_23.agents)
UNION ALL SELECT 'agent_capabilities',  (SELECT count(*) FROM _brain_simplification_backup_2026_05_23.agent_capabilities)
UNION ALL SELECT 'agent_personas',      (SELECT count(*) FROM _brain_simplification_backup_2026_05_23.agent_personas)
UNION ALL SELECT 'ai_routing_config',   (SELECT count(*) FROM _brain_simplification_backup_2026_05_23.ai_routing_config)
UNION ALL SELECT 'agent_routing_rules', (SELECT count(*) FROM _brain_simplification_backup_2026_05_23.agent_routing_rules)
UNION ALL SELECT 'prompt_templates',    (SELECT count(*) FROM _brain_simplification_backup_2026_05_23.prompt_templates)
UNION ALL SELECT 'email_prompts',       (SELECT count(*) FROM _brain_simplification_backup_2026_05_23.email_prompts)
UNION ALL SELECT 'kb_entries',          (SELECT count(*) FROM _brain_simplification_backup_2026_05_23.kb_entries);

-- Revoca scritture: snapshot read-only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA _brain_simplification_backup_2026_05_23 FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON SCHEMA _brain_simplification_backup_2026_05_23 IS 'F0 read-only snapshot pre brain-simplification (vedi mem://standards/brain-simplification-plan-2026-05-23)';