
# Piano: Sistema Multi-Operatore con Identità Intercambiabile

## Concetto
Tutti gli utenti vedono gli stessi dati. La differenza è CHI sta comunicando: ogni operatore ha le proprie credenziali di invio (email IMAP/SMTP, WhatsApp, LinkedIn). Un dropdown nell'header permette di "impersonare" un altro operatore.

## Fase 1: Database — Tabella `operators`

Nuova tabella `operators` che contiene:
- `user_id` → collegamento all'utente Supabase Auth
- `name`, `email`, `avatar_url` → dati visibili
- `imap_host`, `imap_user`, `imap_password` (cifrata) → credenziali email
- `smtp_host`, `smtp_user`, `smtp_password` → per invio
- `whatsapp_phone` → numero WhatsApp associato
- `linkedin_profile_url` → profilo LinkedIn
- `is_admin` → può invitare altri operatori
- `invited_by`, `invited_at` → tracciabilità inviti

## Fase 2: Sistema Inviti

- L'admin inserisce nome + email del nuovo operatore
- Il sistema invia un invito tramite Supabase Auth (`inviteUserByEmail` via Edge Function)
- L'utente invitato imposta la password al primo accesso
- Al primo login, il profilo operatore viene creato automaticamente

## Fase 3: Dropdown Operatore nell'Header

- Hook `useOperators()` carica la lista operatori
- Hook `useActiveOperator()` gestisce l'operatore corrente (default = utente loggato)
- Context `ActiveOperatorProvider` distribuisce l'operatore attivo a tutta l'app
- Il dropdown mostra nome + avatar di ogni operatore

## Fase 4: Integrazione con il sistema email

- La Edge Function `check-inbox` legge le credenziali IMAP dalla tabella `operators` invece che dai secrets globali
- L'invio email (cockpit) usa SMTP dell'operatore attivo
- Il `channel_messages` aggiunge colonna `operator_id` per sapere chi ha inviato/ricevuto

## Fase 5: Pagina Impostazioni Operatori

- Nuova rotta `/settings/operators`
- Lista operatori con stato (attivo/invitato/disabilitato)
- Form per invitare nuovo operatore
- Form per configurare credenziali di ogni operatore
- Solo admin può invitare e modificare altri

## Sicurezza
- Le password IMAP/SMTP sono cifrate nel DB (mai esposte al frontend)
- RLS: tutti gli utenti autenticati possono leggere gli operatori (dati condivisi), ma solo l'admin può modificare
- Le credenziali sensibili sono accessibili solo via Edge Function (service role)

## Cosa NON cambia
- I dati (partners, contatti, email scaricate) restano condivisi e visibili a tutti
- La struttura delle tabelle esistenti non viene toccata
- Il sistema di categorie/prompt appena creato funziona normalmente
