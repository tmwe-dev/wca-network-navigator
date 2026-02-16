
# Welcome Wizard & Autenticazione Multi-Tenant

## Panoramica

Trasformazione del sistema da single-tenant a multi-tenant con:
- Autenticazione (Email+Password + Google)
- Onboarding wizard in 3 step
- Sistema crediti a consumo
- API keys BYOK (Bring Your Own Key) per AI

## Step 1: Database & Autenticazione

### Tabelle da creare

1. **`profiles`** - Profilo utente
   - `id` UUID PK
   - `user_id` UUID → auth.users (ON DELETE CASCADE, UNIQUE)
   - `display_name` TEXT
   - `language` TEXT DEFAULT 'it' (it, en, es, fr, de, pt, zh)
   - `onboarding_completed` BOOLEAN DEFAULT false
   - `created_at`, `updated_at`

2. **`user_api_keys`** - Chiavi API per provider AI
   - `id` UUID PK
   - `user_id` UUID → auth.users
   - `provider` TEXT (openai, google, anthropic)
   - `api_key` TEXT (cifrata lato server)
   - `is_active` BOOLEAN DEFAULT true
   - `created_at`, `updated_at`
   - UNIQUE(user_id, provider)

3. **`user_wca_credentials`** - Credenziali WCA per utente
   - `id` UUID PK
   - `user_id` UUID → auth.users (UNIQUE)
   - `wca_username` TEXT
   - `wca_password` TEXT (cifrata lato server)
   - `created_at`, `updated_at`

4. **`user_credits`** - Saldo crediti
   - `id` UUID PK
   - `user_id` UUID → auth.users (UNIQUE)
   - `balance` INTEGER DEFAULT 0
   - `total_consumed` INTEGER DEFAULT 0
   - `updated_at`

5. **`credit_transactions`** - Log operazioni crediti
   - `id` UUID PK
   - `user_id` UUID → auth.users
   - `amount` INTEGER (positivo = ricarica, negativo = consumo)
   - `operation` TEXT (ai_call, enrichment, scraping, topup)
   - `description` TEXT
   - `created_at`

### RLS Policies
- Ogni tabella: utente vede/modifica solo i propri dati
- `user_id = auth.uid()`

### Trigger
- Auto-creazione profilo + crediti iniziali (es. 100 crediti gratis) su signup

## Step 2: Pagine Auth

- `/auth` - Login/Signup con Email+Password
- Google OAuth via Lovable Cloud
- Redirect a `/onboarding` se `onboarding_completed = false`
- Redirect a `/` (dashboard) se completato

## Step 3: Onboarding Wizard (3 step)

### Step 1: Profilo & Lingua
- Nome visualizzato
- Lingua preferita (select con bandiere)
- Breve benvenuto/spiegazione del sistema

### Step 2: Credenziali WCA
- Username WCA
- Password WCA
- Spiegazione: "Queste credenziali servono per accedere alla directory WCA e scaricare i contatti dei tuoi network"
- Link diretto a WCA per registrarsi se non hanno account
- Pulsante "Salta" (opzionale, può configurare dopo)

### Step 3: Configurazione AI
- Spiegazione modello BYOK: "Porta le tue chiavi API per usare l'AI al massimo. Oppure usa i crediti inclusi."
- 3 sezioni espandibili:
  - **OpenAI**: campo API key + link a platform.openai.com/api-keys
  - **Google AI (Gemini)**: campo API key + link a aistudio.google.com/apikey
  - **Anthropic (Claude)**: campo API key + link a console.anthropic.com
- Indicatore crediti gratuiti disponibili
- Pulsante "Salta" (userà solo crediti)

## Step 4: Protezione Route

- `ProtectedRoute` wrapper che verifica autenticazione
- Redirect non autenticati a `/auth`
- Redirect utenti senza onboarding a `/onboarding`

## File coinvolti

| File | Azione |
|------|--------|
| Migration SQL | Nuovo - tabelle profiles, user_api_keys, etc. |
| `src/pages/Auth.tsx` | Nuovo |
| `src/pages/Onboarding.tsx` | Nuovo |
| `src/components/onboarding/StepProfile.tsx` | Nuovo |
| `src/components/onboarding/StepWCA.tsx` | Nuovo |
| `src/components/onboarding/StepAI.tsx` | Nuovo |
| `src/components/auth/ProtectedRoute.tsx` | Nuovo |
| `src/hooks/useProfile.ts` | Nuovo |
| `src/App.tsx` | Modificare - aggiungere route protette |

## Note importanti

- Le RLS policies esistenti (tutte `true`) restano invariate per ora → in futuro si potranno scoped per utente
- Il wizard è skippable in ogni step tranne il profilo/lingua
- I crediti iniziali gratuiti incentivano l'esplorazione
