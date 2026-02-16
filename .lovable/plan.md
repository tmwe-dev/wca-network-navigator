

# Assistente AI Integrato nell'Operations Center

## Panoramica

Hai gia' tutto il necessario per costruire un assistente AI potente e operativo. Il progetto ha Lovable AI configurato (usato gia' per `analyze-partner` e `parse-profile-ai`), e tutte le tabelle del database sono accessibili dalle backend functions. L'assistente potra' leggere dati, rispondere a domande sul contenuto e eseguire azioni concrete.

## Architettura

L'assistente sara' composto da tre parti:

1. **Backend function** (`supabase/functions/ai-assistant/index.ts`) -- riceve i messaggi dell'utente, interroga il database in autonomia tramite tool calling, e risponde con dati reali
2. **Componente UI** (`src/components/operations/AiAssistantDialog.tsx`) -- popup/dialog con chat streaming, richiamabile da un pulsante nell'Operations Center
3. **Pulsante di attivazione** nell'header di Operations.tsx

## Capacita' dell'Assistente

| Domanda esempio | Cosa fa il backend |
|---|---|
| "Quanti partner ha il Brasile?" | Query `partners WHERE country_code = 'BR'` |
| "Quali paesi non hanno profili?" | Query `get_country_stats()` + filtra `without_profile > 0` |
| "Trova partner con rating > 4 in Germania" | Query `partners WHERE country_code = 'DE' AND rating > 4` |
| "Quali job sono attivi?" | Query `download_jobs WHERE status = 'running'` |
| "Riassumi il partner XYZ" | Legge `raw_profile_markdown` e genera riassunto |
| "Avvia download per la Francia" | Crea record in `download_jobs` (azione attiva) |
| "Mostra le email mancanti in Italia" | Query partner IT senza email |

## Implementazione Tecnica

### 1. Edge Function: `supabase/functions/ai-assistant/index.ts`

Usa il pattern **tool calling** di Lovable AI (Gemini) per dare all'AI accesso strutturato al database:

**Tools disponibili per l'AI:**
- `query_partners` -- cerca partner per paese, rating, tipo, presenza email/profilo
- `get_country_stats` -- statistiche aggregate per paese
- `query_jobs` -- stato dei download jobs
- `get_partner_detail` -- dettaglio completo di un partner specifico
- `count_records` -- conteggi veloci per qualsiasi tabella/filtro

L'AI riceve la domanda dell'utente, decide quale tool usare, il backend esegue la query Supabase corrispondente, e l'AI formula la risposta con i dati reali.

**System prompt** descrive il contesto del sistema: tabelle disponibili, significato dei campi, network WCA, tipi di partner, e le azioni possibili.

**Modello**: `google/gemini-3-flash-preview` (veloce, buon reasoning, costo contenuto).

### 2. Componente UI: `src/components/operations/AiAssistantDialog.tsx`

- Dialog/Sheet che si apre dal pulsante nell'header di Operations
- Chat con streaming token-by-token (SSE) come da pattern Lovable AI
- Cronologia messaggi nella sessione (non persistita nel DB per semplicita' iniziale)
- Indicatore "sta pensando..." durante le tool calls
- Supporto markdown nelle risposte (tabelle, liste, grassetto)
- Rispetta il tema chiaro/scuro di Operations

### 3. Integrazione in Operations.tsx

- Pulsante con icona `MessageSquare` o `Bot` nell'header, accanto al toggle tema
- Il dialog riceve il contesto corrente (paesi selezionati, filtro attivo) come contesto iniziale per l'AI

## Flusso Dati

```text
Utente digita domanda
  --> Frontend invia POST a /ai-assistant (streaming)
    --> Edge function costruisce messaggi con system prompt
    --> Chiama Lovable AI Gateway con tools definiti
    --> AI decide: usa tool "query_partners" con parametri
    --> Edge function esegue query Supabase
    --> Ritorna risultato all'AI
    --> AI formula risposta naturale
    --> Streaming SSE al frontend
  --> Frontend renderizza token per token
```

## File da Creare/Modificare

| File | Azione |
|---|---|
| `supabase/functions/ai-assistant/index.ts` | NUOVO -- edge function con tool calling |
| `src/components/operations/AiAssistantDialog.tsx` | NUOVO -- UI chat popup |
| `src/pages/Operations.tsx` | Aggiungere pulsante + import dialog |
| `supabase/config.toml` | Aggiungere entry per `ai-assistant` |

## Dettagli Implementativi

### Tools dell'AI (definiti nella edge function)

```text
1. search_partners(country_code?, has_email?, has_profile?, min_rating?, limit?)
   -> SELECT da partners con filtri, ritorna nome/citta/email/rating

2. get_country_overview(country_code?)
   -> Chiama get_country_stats() RPC, ritorna totali per paese

3. list_active_jobs()
   -> SELECT da download_jobs WHERE status IN ('running','pending')

4. get_partner_by_name(name)
   -> SELECT da partners WHERE company_name ILIKE '%name%'

5. count_by_filter(table, filter_description)
   -> Query dinamica sicura con conteggio
```

### Sicurezza

- La edge function usa `SUPABASE_SERVICE_ROLE_KEY` per accedere ai dati (stessa cosa che fanno le altre funzioni esistenti)
- Le query sono parametrizzate e costruite dal codice, non dall'AI direttamente (l'AI sceglie solo quale tool chiamare e con quali parametri tipizzati)
- Nessuna possibilita' di SQL injection: i tool hanno parametri strutturati

### Costi

- Usa Lovable AI gia' incluso nel progetto
- Modello `gemini-3-flash-preview`: basso costo per messaggio
- Le tool calls aggiungono 1-2 round-trip extra ma restano sotto i 3 secondi totali

## Espansioni Future

- Persistenza conversazioni nel database
- Azioni attive (avvia download, crea reminder, segna preferito) oltre alla sola lettura
- Contesto automatico: "stai guardando l'Italia con 31 partner senza profilo"
- Suggerimenti rapidi pre-compilati ("Paesi con piu' gap", "Partner top rated")

