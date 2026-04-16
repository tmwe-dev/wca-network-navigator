-- Backfill onboarding_completed per utenti esistenti.
-- Chiunque abbia già un profilo al momento di questa migration è considerato onboarded.
-- Nuove registrazioni continueranno a partire con onboarding_completed = false (DEFAULT colonna).

UPDATE public.profiles
SET onboarding_completed = true
WHERE onboarding_completed = false;