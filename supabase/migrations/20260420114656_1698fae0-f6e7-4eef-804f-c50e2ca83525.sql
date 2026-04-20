-- ════════════════════════════════════════════════════════════════════
-- SHERLOCK PLAYBOOKS — KB editabile delle ricette di deep search
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE public.sherlock_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_fields TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  estimated_seconds INTEGER NOT NULL DEFAULT 60,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sherlock_playbooks_level ON public.sherlock_playbooks(level) WHERE is_active = true;
CREATE INDEX idx_sherlock_playbooks_active ON public.sherlock_playbooks(is_active, sort_order);

ALTER TABLE public.sherlock_playbooks ENABLE ROW LEVEL SECURITY;

-- Read: tutti gli autenticati
CREATE POLICY "Authenticated can view playbooks"
ON public.sherlock_playbooks FOR SELECT
TO authenticated
USING (true);

-- Write: solo admin/moderator (riusa has_role esistente)
CREATE POLICY "Admins can insert playbooks"
ON public.sherlock_playbooks FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Admins can update playbooks"
ON public.sherlock_playbooks FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Admins can delete playbooks"
ON public.sherlock_playbooks FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_sherlock_playbooks_updated_at
BEFORE UPDATE ON public.sherlock_playbooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════
-- SHERLOCK INVESTIGATIONS — log delle indagini eseguite
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE public.sherlock_investigations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operator_id UUID,
  playbook_id UUID REFERENCES public.sherlock_playbooks(id) ON DELETE SET NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  partner_id UUID,
  contact_id UUID,
  target_label TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','aborted','failed')),
  vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  findings JSONB NOT NULL DEFAULT '{}'::jsonb,
  step_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sherlock_invest_user ON public.sherlock_investigations(user_id, started_at DESC);
CREATE INDEX idx_sherlock_invest_partner ON public.sherlock_investigations(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_sherlock_invest_contact ON public.sherlock_investigations(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_sherlock_invest_status ON public.sherlock_investigations(status, started_at DESC);

ALTER TABLE public.sherlock_investigations ENABLE ROW LEVEL SECURITY;

-- Read: tutti gli autenticati (consistente con shared-contacts-visibility-policy)
CREATE POLICY "Authenticated can view investigations"
ON public.sherlock_investigations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their investigations"
ON public.sherlock_investigations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their investigations"
ON public.sherlock_investigations FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete investigations"
ON public.sherlock_investigations FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_sherlock_investigations_updated_at
BEFORE UPDATE ON public.sherlock_investigations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════
-- SEED — 3 livelli predefiniti
-- ════════════════════════════════════════════════════════════════════
INSERT INTO public.sherlock_playbooks (level, name, description, sort_order, target_fields, estimated_seconds, steps) VALUES
(
  1,
  'Scout — Ricognizione rapida',
  'Verifica veloce: scheda Google Maps + home del sito ufficiale. Ideale per validare partner sconosciuti prima di un primo contatto.',
  10,
  ARRAY['address','phone','website','hours','company_summary'],
  30,
  '[
    {
      "order": 1,
      "label": "Google Maps / Place",
      "url_template": "https://www.google.com/maps/search/{companyName}+{city}",
      "required_vars": ["companyName"],
      "settle_ms": 3000,
      "channel": "generic",
      "ai_extract_prompt": "Estrai dalla scheda Google Maps: indirizzo completo, telefono, sito web ufficiale, orari di apertura, valutazione media e numero di recensioni. Restituisci solo dati certi presenti nel testo.",
      "ai_decide_next": false
    },
    {
      "order": 2,
      "label": "Sito ufficiale (home)",
      "url_template": "{websiteUrl}",
      "required_vars": ["websiteUrl"],
      "settle_ms": 1800,
      "channel": "generic",
      "ai_extract_prompt": "Dalla home page estrai: descrizione attività in 2 righe, settori serviti, paesi/lingue supportate, eventuali email o telefoni di contatto visibili.",
      "ai_decide_next": false
    }
  ]'::jsonb
),
(
  2,
  'Detective — Indagine standard',
  'Approfondisce con sito multi-pagina, LinkedIn aziendale e reputation Google. Per qualifica seria di partner attivi.',
  20,
  ARRAY['address','phone','website','email','linkedin_company','team','services','reputation','recent_news'],
  120,
  '[
    {
      "order": 1,
      "label": "Google Maps / Place",
      "url_template": "https://www.google.com/maps/search/{companyName}+{city}",
      "required_vars": ["companyName"],
      "settle_ms": 3000,
      "channel": "generic",
      "ai_extract_prompt": "Estrai indirizzo, telefono, sito ufficiale, orari, rating, numero recensioni.",
      "ai_decide_next": false
    },
    {
      "order": 2,
      "label": "Sito — Home",
      "url_template": "{websiteUrl}",
      "required_vars": ["websiteUrl"],
      "settle_ms": 1800,
      "channel": "generic",
      "ai_extract_prompt": "Estrai: descrizione attività, claim/payoff, settori serviti, lingue, contatti visibili. Identifica link a pagine About/Team/Contact.",
      "ai_decide_next": true
    },
    {
      "order": 3,
      "label": "Sito — About",
      "url_template": "{websiteUrl}/about",
      "required_vars": ["websiteUrl"],
      "settle_ms": 1800,
      "channel": "generic",
      "ai_extract_prompt": "Estrai: anno fondazione, dimensione team, valori, certificazioni, partnership menzionate."
    },
    {
      "order": 4,
      "label": "Sito — Team",
      "url_template": "{websiteUrl}/team",
      "required_vars": ["websiteUrl"],
      "settle_ms": 1800,
      "channel": "generic",
      "ai_extract_prompt": "Estrai elenco persone chiave con ruolo, email se visibile, link LinkedIn. Identifica CEO/founder/decision maker."
    },
    {
      "order": 5,
      "label": "Sito — Contact",
      "url_template": "{websiteUrl}/contact",
      "required_vars": ["websiteUrl"],
      "settle_ms": 1800,
      "channel": "generic",
      "ai_extract_prompt": "Estrai TUTTI i contatti: email (commerciali, info, supporto), telefoni con prefisso, indirizzi sedi, orari, form contatti."
    },
    {
      "order": 6,
      "label": "LinkedIn azienda",
      "url_template": "https://www.linkedin.com/company/{linkedinCompanySlug}/",
      "required_vars": ["linkedinCompanySlug"],
      "settle_ms": 4000,
      "channel": "linkedin",
      "ai_extract_prompt": "Estrai: numero dipendenti, settore, headquarters, anno fondazione, descrizione, follower count, ultimi 3 post (titoli)."
    },
    {
      "order": 7,
      "label": "Reputation & news (12 mesi)",
      "url_template": "https://www.google.com/search?q=%22{companyName}%22+(reviews+OR+news+OR+complaints)&tbs=qdr:y",
      "required_vars": ["companyName"],
      "settle_ms": 2500,
      "channel": "generic",
      "ai_extract_prompt": "Riassumi: news recenti (fonte+data), recensioni (positive/negative+temi), eventuali segnalazioni problematiche. Sii fattuale."
    }
  ]'::jsonb
),
(
  3,
  'Sherlock — Indagine profonda',
  'Investigazione completa con profili LinkedIn dei contatti chiave, news ultimi 12 mesi, pattern email e cross-reference. Per partner strategici.',
  30,
  ARRAY['address','phone','website','email','linkedin_company','linkedin_personal','team','services','reputation','recent_news','email_pattern','decision_makers','ownership','financial_signals'],
  300,
  '[
    {
      "order": 1,
      "label": "Google Maps / Place",
      "url_template": "https://www.google.com/maps/search/{companyName}+{city}",
      "required_vars": ["companyName"],
      "settle_ms": 3000,
      "channel": "generic",
      "ai_extract_prompt": "Estrai dati Google Place completi.",
      "ai_decide_next": false
    },
    {
      "order": 2,
      "label": "Sito — Home",
      "url_template": "{websiteUrl}",
      "required_vars": ["websiteUrl"],
      "settle_ms": 1800,
      "channel": "generic",
      "ai_extract_prompt": "Estrai claim, settori, lingue, link interni rilevanti (about/team/contact/services).",
      "ai_decide_next": true
    },
    {
      "order": 3,
      "label": "Sito — About",
      "url_template": "{websiteUrl}/about",
      "required_vars": ["websiteUrl"],
      "settle_ms": 1800,
      "channel": "generic",
      "ai_extract_prompt": "Storia, fondatori, certificazioni, partnership.",
      "ai_decide_next": true
    },
    {
      "order": 4,
      "label": "Sito — Team",
      "url_template": "{websiteUrl}/team",
      "required_vars": ["websiteUrl"],
      "settle_ms": 1800,
      "channel": "generic",
      "ai_extract_prompt": "Identifica TUTTI i decision maker (CEO, COO, Sales Director, Country Manager). Per ognuno: nome completo, ruolo esatto, email, LinkedIn URL. Suggerisci come prossima ricerca il LinkedIn del decision maker più rilevante.",
      "ai_decide_next": true
    },
    {
      "order": 5,
      "label": "Sito — Contact",
      "url_template": "{websiteUrl}/contact",
      "required_vars": ["websiteUrl"],
      "settle_ms": 1800,
      "channel": "generic",
      "ai_extract_prompt": "Tutti i contatti: email, telefoni, sedi, orari. Identifica il pattern email (es: nome.cognome@dominio.com)."
    },
    {
      "order": 6,
      "label": "LinkedIn azienda",
      "url_template": "https://www.linkedin.com/company/{linkedinCompanySlug}/",
      "required_vars": ["linkedinCompanySlug"],
      "settle_ms": 4000,
      "channel": "linkedin",
      "ai_extract_prompt": "Dati aziendali completi LinkedIn + ultimi post + crescita dipendenti se visibile.",
      "ai_decide_next": true
    },
    {
      "order": 7,
      "label": "LinkedIn — profilo decision maker",
      "url_template": "{decisionMakerLinkedinUrl}",
      "required_vars": ["decisionMakerLinkedinUrl"],
      "settle_ms": 4000,
      "channel": "linkedin",
      "ai_extract_prompt": "Estrai profilo: ruolo attuale, anni in azienda, esperienze precedenti, formazione, lingue, attività recente, interessi pubblici. Cerca segnali per personalizzare un primo contatto."
    },
    {
      "order": 8,
      "label": "News recenti (12 mesi)",
      "url_template": "https://www.google.com/search?q=%22{companyName}%22+news&tbs=qdr:y",
      "required_vars": ["companyName"],
      "settle_ms": 2500,
      "channel": "generic",
      "ai_extract_prompt": "News con data e fonte: espansioni, acquisizioni, nuovi servizi, premi, problemi, cambi management. Fattuale."
    },
    {
      "order": 9,
      "label": "Reputation & recensioni",
      "url_template": "https://www.google.com/search?q=%22{companyName}%22+(reviews+OR+complaints+OR+%22%E2%98%85%22)&tbs=qdr:y",
      "required_vars": ["companyName"],
      "settle_ms": 2500,
      "channel": "generic",
      "ai_extract_prompt": "Sintetizza sentiment: punti di forza ricorrenti, criticità ricorrenti, fonti più citate."
    },
    {
      "order": 10,
      "label": "Cross-reference settore",
      "url_template": "https://www.google.com/search?q=%22{companyName}%22+(partner+OR+cliente+OR+fornitore)+{industryHint}",
      "required_vars": ["companyName"],
      "settle_ms": 2500,
      "channel": "generic",
      "ai_extract_prompt": "Trova menzioni esterne: chi parla di loro, in quali contesti, eventuali clienti/partner ricorrenti. Identifica posizionamento di mercato."
    }
  ]'::jsonb
);