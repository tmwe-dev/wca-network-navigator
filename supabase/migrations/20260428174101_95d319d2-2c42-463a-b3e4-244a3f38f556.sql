WITH new_prompts(name, context, objective, procedure, criteria, tags, priority) AS (
  VALUES
  (
    'Alias Generation Rules (Companies & Contacts)',
    'general',
    'Generare alias naturali per aziende e contatti come li userebbe un professionista italiano in un''email.',
    E'## ALIAS AZIENDA (company_alias)\n- Rimuovi suffissi legali: SPA, SRL, LLC, Ltd, Inc, GmbH, d.o.o., S.A., Corp, Pty, dba, ecc.\n- Rimuovi la città se è nel nome (es. "World Transport Overseas d.o.o. Sarajevo" → "World Transport Overseas").\n- Mantieni il nome riconoscibile e naturale.\n- Se il nome è già corto e senza suffissi, lascialo com''è.\n\n## ALIAS CONTATTO (contact_alias)\n- Usa SOLO il cognome (es. "Mr. Christian Halpaus" → "Halpaus").\n- Rimuovi titoli (Mr., Mrs., Ms., Dr., Ing., ecc.).\n- Se il nome sembra un ruolo e non un nome di persona (es. "President", "Manager", "Operations"), restituisci stringa vuota "".\n- Se c''è solo un nome senza cognome chiaro, usa quel nome.\n- NON usare mai nome + cognome insieme.',
    'Output sempre tramite tool call save_aliases. Stringa vuota quando il nome non è una persona reale.',
    ARRAY['aliases','copywriting','universale']::text[],
    60
  )
)
INSERT INTO public.operative_prompts (user_id, name, context, objective, procedure, criteria, tags, priority, is_active)
SELECT u.id, np.name, np.context, np.objective, np.procedure, np.criteria, np.tags, np.priority, true
FROM auth.users u
CROSS JOIN new_prompts np
WHERE NOT EXISTS (
  SELECT 1 FROM public.operative_prompts op
  WHERE op.user_id = u.id AND op.name = np.name
);