# WCA Network Navigator

CRM con intelligenza artificiale per il freight forwarding globale.

## Stack

- React 18 + TypeScript + Vite
- Supabase (PostgreSQL + Auth + Edge Functions)
- AI Gateway: OpenAI, Anthropic, Google Gemini, xAI, Qwen, OpenRouter
- ElevenLabs per agenti vocali
- Three.js per visualizzazioni 3D
- Tailwind CSS + shadcn/ui

## Setup

1. `npm install`
2. Copia `.env.example` in `.env` e configura le variabili
3. `npm run dev`

## Struttura

```
src/
├── components/    — Componenti React organizzati per dominio
├── data/          — Data Access Layer e dati statici
├── hooks/         — Hook personalizzati
├── i18n/          — Traduzioni (it/en)
├── integrations/  — Client Supabase e tipi auto-generati
├── lib/           — Utility, API wrapper, logging
├── pages/         — Pagine dell'applicazione (v1)
├── test/          — Setup e helper per i test
└── v2/            — Componenti e pagine evolute (v2 UI)

supabase/
├── functions/     — 77 Edge Functions in Deno
├── migrations/    — Migrazioni database SQL
└── config.toml    — Configurazione progetto

docs/              — Documentazione tecnica
e2e/               — Test End-to-End (Playwright)
```

## Funzionalità Principali

### CRM & Pipeline
- Pipeline Kanban con drag-and-drop
- Lead scoring AI automatico
- Gestione partner con contatti multipli
- Business card scanner con OCR

### Outreach Engine
- Missioni con cadenza automatica (email, WhatsApp, LinkedIn)
- A/B testing email con significatività statistica
- Template dinamici con variabili contestuali
- Holding pattern per contatti in attesa

### Email Intelligence
- Classificazione AI delle email in arrivo
- Gestione sender e regole per indirizzo
- Thread tracking con message-id/references
- Oracle AI per suggerimenti di risposta

### Sistema di Memoria Hydra
- 3 livelli di memoria (L1 working / L2 session / L3 long-term)
- Embedding pgvector 1536-dim per ricerca semantica
- Promozione automatica tra livelli
- Knowledge Base con RAG

### AI Agents
- 47 tool AI per agenti conversazionali
- Agenti vocali con ElevenLabs
- AI Arena con ContactCard 3D
- Autonomous cycle per task pianificati
- Decision log con audit trail

### Multi-canale
- Email (IMAP/SMTP)
- WhatsApp (estrazione AI)
- LinkedIn (estrazione profilo AI)

### Analytics & Monitoring
- Dashboard con metriche real-time
- AI Lab per testing scenari
- Telemetria e diagnostica
- Error tracking con Sentry

## Comandi

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Avvia il server di sviluppo |
| `npm run build` | Build di produzione |
| `npm run test` | Esegui test unitari |
| `npm run test:ci` | Test con coverage |
| `npm run lint` | Linting ESLint |
| `npm run typecheck` | Type checking TypeScript |

## Testing

- **Unit test**: Vitest con jsdom, 183+ file test, 1500+ test case
- **E2E test**: Playwright con 32 spec
- **Coverage**: Soglie minime configurate in `vitest.config.ts`
- **CI/CD**: GitHub Actions con lint → type-check → test → build → e2e

## Sicurezza

- RLS (Row Level Security) su tutte le tabelle con dati utente
- Auth Guard centralizzato (`getClaims`) su tutte le Edge Functions
- Rate limiting con token bucket sulle risorse AI
- Input validation con Zod/Regex
- Security headers (HSTS, X-Frame-Options, CSP)
- CORS restrittivo con whitelist origini

## Documentazione

- `docs/API.md` — Referenza completa Edge Functions
- `docs/ARCHITECTURE.md` — Architettura e moduli
- `docs/DEVELOPMENT.md` — Guida sviluppo
- `docs/EDGE-FUNCTIONS.md` — Template e protocolli backend
- `docs/MANUALE_AGENTI_AI.md` — Guida agenti AI
- `docs/GUIDA_CONFIG_11LABS.md` — Configurazione ElevenLabs

## Licenza

Proprietario — Tutti i diritti riservati.
