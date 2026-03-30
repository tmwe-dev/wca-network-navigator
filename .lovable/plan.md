

# ElevenLabs: Riconnessione API Key + Caricamento Voci Dinamico

## Due problemi

1. **API Key scaduta/invalida** — l'errore 401 conferma che la chiave ElevenLabs collegata non funziona. Va riconnessa.
2. **Voci hardcoded** — le 18 voci nel settings sono statiche. Serve una edge function che interroghi l'API ElevenLabs per scaricare tutte le voci disponibili (incluse quelle clonate dall'utente).

## Soluzione

### 1. Riconnettere ElevenLabs
Chiederti di riconnettere il connettore ElevenLabs con una nuova API key valida.

### 2. Nuova edge function `list-elevenlabs-voices`
Chiama `GET https://api.elevenlabs.io/v1/voices` con la API key e ritorna l'elenco completo delle voci (nome, ID, categoria, lingua, anteprima URL).

### 3. Aggiornare ElevenLabsSettings.tsx
- Aggiungere un pulsante "Carica voci da ElevenLabs" che chiama la nuova edge function
- Mostrare le voci in griglia raggruppate per categoria (premade, cloned, generated)
- Ogni voce ha: nome, lingua, genere, pulsante play (usa preview_url dall'API, senza consumare TTS)
- Mantenere i preset hardcoded come fallback se la chiamata API fallisce
- Aggiungere nella tab "Avanzate" un campo per inserire/aggiornare la API key (salvata come secret backend)

### 4. Verifica stato API key
Nella tab "Avanzate", invece di mostrare sempre "Configurata" in verde, fare un check reale chiamando la edge function e mostrare lo stato effettivo (valida/scaduta/mancante).

## File coinvolti

| File | Azione |
|------|--------|
| Connettore ElevenLabs | Riconnessione con nuova API key |
| `supabase/functions/list-elevenlabs-voices/index.ts` | **Nuovo** — proxy verso API ElevenLabs per elenco voci |
| `src/components/settings/ElevenLabsSettings.tsx` | Aggiungere caricamento dinamico voci + verifica stato key |

