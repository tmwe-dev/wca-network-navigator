

# Centralizzare AI dell'Estensione su Lovable AI

## Situazione attuale

Il modulo `brain.js` dell'estensione Partner Connect chiama direttamente `https://api.anthropic.com/v1/messages` con una API key Claude configurata dall'utente. Questo richiede:
- L'utente deve procurarsi e inserire una API key Anthropic
- Costi diretti per l'utente
- Gestione cifratura chiavi nell'estensione

## Cosa cambia

Sostituiamo la chiamata diretta ad Anthropic con una chiamata alla nostra Edge Function che usa Lovable AI (già pagato, zero config per l'utente).

## Piano

### 1. Creare Edge Function `extension-brain`

Nuova funzione dedicata in `supabase/functions/extension-brain/index.ts`:
- Riceve `{ messages, systemPrompt, maxTokens }` dall'estensione
- Chiama il gateway Lovable AI (`https://ai.gateway.lovable.dev/v1/chat/completions`) con `LOVABLE_API_KEY`
- Modello: `google/gemini-3-flash-preview` (veloce, gratis)
- Ritorna il testo della risposta in formato compatibile con il parsing esistente di brain.js
- CORS aperto (l'estensione chiama da qualsiasi dominio)
- Nessuna autenticazione JWT richiesta (l'estensione non ha il token utente)

### 2. Modificare `brain.js` — metodo `think()`

- Rimuovere il check `if (!this.config.claudeApiKey)` — non serve più
- Sostituire la fetch ad Anthropic (righe 187-201) con una fetch alla Edge Function:
  ```
  fetch(`${SUPABASE_URL}/functions/v1/extension-brain`, { ... })
  ```
- L'URL Supabase sarà hardcoded come costante (è pubblico)
- Adattare il parsing della risposta: da `data.content[0].text` a `data.content` (stringa diretta)
- Mantenere intatto tutto il resto: library check, Hydra enrichment, auto-save, token tracking

### 3. Semplificare config e popup

- Rimuovere da `brain.js` config: `claudeApiKey`, `claudeModel`, cifratura `_encApiKey`
- Rimuovere da `popup.js`: campo API key Claude, campo modello Claude
- Mantenere: budget token giornaliero, Supabase KB settings
- Aggiornare `background.js`: rimuovere mascheramento `claudeApiKey` nel get-config

### 4. Aggiornare `popup.html`

Rimuovere i campi input per API key Claude e selezione modello dalla sezione Brain Settings.

## File modificati

| File | Cosa |
|------|------|
| `supabase/functions/extension-brain/index.ts` | **Nuovo** — proxy verso Lovable AI |
| `public/partner-connect-extension/brain.js` | Fetch → Edge Function, rimozione config Claude |
| `public/partner-connect-extension/popup.js` | Rimozione campi API key/modello Claude |
| `public/partner-connect-extension/popup.html` | Rimozione input Claude settings |
| `public/partner-connect-extension/background.js` | Rimozione mascheramento claudeApiKey |

## Risultato

L'utente installa l'estensione e il Brain funziona **subito**, senza configurare nulla. Zero costi esterni, tutto centralizzato su Lovable AI.

