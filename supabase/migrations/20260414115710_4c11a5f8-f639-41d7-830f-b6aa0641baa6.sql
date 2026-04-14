-- Backfill profilo mancante per Luca (lucaarcana@gmail.com)
INSERT INTO public.profiles (user_id, display_name)
VALUES ('1d51961d-da81-4914-b229-511cdce43e55', 'Luca')
ON CONFLICT (user_id) DO NOTHING;

-- Assegna ruolo admin a Luca
INSERT INTO public.user_roles (user_id, role)
VALUES ('1d51961d-da81-4914-b229-511cdce43e55', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Assegna ruolo 'user' a tutti gli utenti esistenti che non hanno ancora un ruolo
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::public.app_role
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id, role) DO NOTHING;