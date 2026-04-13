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
- `src/pages/` — Pagine dell'applicazione
- `src/components/` — Componenti React organizzati per dominio
- `src/v2/` — Componenti e pagine evolute
- `src/data/` — Data Access Layer
- `src/hooks/` — Hook personalizzati
- `supabase/functions/` — 65+ Edge Functions in Deno
- `supabase/migrations/` — Migrazioni database

## Funzionalità Principali
- CRM con pipeline Kanban e lead scoring AI
- Outreach engine con missioni e cadenza automatica
- Email Intelligence con classificazione AI e gestione sender
- Sistema di memoria Hydra a 3 livelli (L1/L2/L3)
- Knowledge Base con RAG semantico (pgvector 1536-dim)
- 47 tool AI per agenti conversazionali
- Agenti vocali con ElevenLabs
- AI Arena con ContactCard 3D
- Multi-canale: Email, WhatsApp, LinkedIn
- A/B testing email con significatività statistica
