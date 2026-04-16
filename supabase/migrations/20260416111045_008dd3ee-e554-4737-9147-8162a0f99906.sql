-- System KB seed: 23 record (15 guida + 8 workflow) con user_id NULL,
-- leggibili da tutti gli authenticated grazie a kb_entries_template_read (wave6).
-- Idempotente: ON CONFLICT (source_path) DO UPDATE.

ALTER TABLE public.kb_entries ALTER COLUMN user_id DROP NOT NULL;

INSERT INTO public.kb_entries (user_id, category, title, content, tags, source_path)
VALUES
  (NULL, 'guida', 'Admin', 'Pannello amministrativo: utenti, ruoli, configurazioni di sistema.', ARRAY['crm','kb','admin'], 'admin.md'),
  (NULL, 'guida', 'Agenda', 'Gestione agenda, appuntamenti e follow-up schedulati.', ARRAY['crm','kb','agenda'], 'agenda.md'),
  (NULL, 'guida', 'Agenti AI', 'Configurazione e gestione degli agenti AI del sistema.', ARRAY['crm','kb','agents','ai'], 'agents.md'),
  (NULL, 'guida', 'CRM', 'Funzionalità principali del modulo CRM per la gestione partner.', ARRAY['crm','kb','partners'], 'crm.md'),
  (NULL, 'guida', 'Data Model', 'Descrizione del modello dati e delle tabelle principali del CRM.', ARRAY['crm','kb','data-model'], 'data-model.md'),
  (NULL, 'guida', 'Email', 'Sistema di gestione email: invio, ricezione, classificazione.', ARRAY['crm','kb','email'], 'email.md'),
  (NULL, 'guida', 'Glossario', 'Glossario dei termini principali usati in WCA Network Navigator.', ARRAY['crm','kb','glossario'], 'glossario.md'),
  (NULL, 'guida', 'Integrazioni', 'Integrazioni esterne: estensioni Chrome, bridge, API di terze parti.', ARRAY['crm','kb','integrations'], 'integrations.md'),
  (NULL, 'guida', 'Known Issues', 'Problemi noti e workaround attivi nell''applicazione.', ARRAY['crm','kb','issues','bugs'], 'known-issues.md'),
  (NULL, 'guida', 'Outreach', 'Sistema outreach multicanale: email, WhatsApp, LinkedIn.', ARRAY['crm','kb','outreach'], 'outreach.md'),
  (NULL, 'guida', 'Prospects', 'Gestione dei prospect e del pipeline commerciale.', ARRAY['crm','kb','prospects'], 'prospects.md'),
  (NULL, 'guida', 'Research', 'Modulo di ricerca avanzata e deep search sui partner.', ARRAY['crm','kb','research'], 'research.md'),
  (NULL, 'guida', 'Routes', 'Mappa delle rotte disponibili nell''applicazione V2.', ARRAY['crm','kb','routes'], 'routes.md'),
  (NULL, 'guida', 'Stati e Transizioni', 'Macchina a stati dei lead, partner e contatti nel CRM.', ARRAY['crm','kb','states','workflow'], 'states.md'),
  (NULL, 'guida', 'Test Checklists', 'Checklist di verifica per le funzionalità principali.', ARRAY['crm','kb','test','qa'], 'test-checklists.md'),
  (NULL, 'workflow', 'Workflow: Chat con Agente AI', 'Come interagire con l''agente AI nel Command Center.', ARRAY['crm','kb','workflow','agent','chat'], 'workflow/chat-with-agent.md'),
  (NULL, 'workflow', 'Workflow: Creare un Agente AI', 'Come configurare un nuovo agente AI con prompt e tool personalizzati.', ARRAY['crm','kb','workflow','agent'], 'workflow/create-agent.md'),
  (NULL, 'workflow', 'Workflow: Creare una Campagna', 'Come configurare e lanciare una campagna outreach multicanale.', ARRAY['crm','kb','workflow','campaign'], 'workflow/create-campaign.md'),
  (NULL, 'workflow', 'Workflow: Creare un Contatto', 'Procedura per aggiungere un nuovo contatto al CRM.', ARRAY['crm','kb','workflow','contact'], 'workflow/create-contact.md'),
  (NULL, 'workflow', 'Workflow: Creare una Missione', 'Procedura step-by-step per creare una nuova missione operativa.', ARRAY['crm','kb','workflow','mission'], 'workflow/create-mission.md'),
  (NULL, 'workflow', 'Workflow: Deep Search', 'Come effettuare una ricerca approfondita su partner e contatti.', ARRAY['crm','kb','workflow','search'], 'workflow/deep-search.md'),
  (NULL, 'workflow', 'Workflow: Importare Contatti', 'Procedura per importare contatti in bulk da file CSV o estensioni.', ARRAY['crm','kb','workflow','import'], 'workflow/import-contacts.md'),
  (NULL, 'workflow', 'Workflow: Inviare una Email', 'Procedura per comporre e inviare una email dal CRM.', ARRAY['crm','kb','workflow','email'], 'workflow/send-email.md')
ON CONFLICT (source_path) DO UPDATE
SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags,
  user_id = EXCLUDED.user_id,
  updated_at = now();