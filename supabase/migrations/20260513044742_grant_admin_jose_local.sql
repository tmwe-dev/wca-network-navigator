-- Promuove jose@tmwe.local ad admin (allineamento con jose@tmwe.it)
INSERT INTO public.user_roles (user_id, role)
VALUES ('374e5706-45e7-46c8-923e-b0ca87f35d85', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
