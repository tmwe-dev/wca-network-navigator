

# Deep Search: Ricerca automatica social e loghi per partner

## Obiettivo
Creare un sistema automatico che, con un click, cerca i profili social (LinkedIn, Facebook, ecc.) dei contatti di un'azienda partner e il logo aziendale, senza intervento manuale.

## Componenti

### 1. Migrazione database
- Aggiungere colonna `logo_url` (text, nullable) alla tabella `partners` per salvare il logo aziendale

### 2. Nuova edge function: `deep-search-partner`
Riceve un `partnerId` e:
1. Recupera il partner (nome azienda, sito web, citta, paese) e i suoi contatti dalla tabella `partner_contacts`
2. Per ogni contatto con nome, usa **Firecrawl** per cercare il profilo LinkedIn (query: `"Nome Contatto" "Nome Azienda" site:linkedin.com/in`)
3. Usa **Lovable AI (Gemini)** per analizzare i risultati e estrarre gli URL dei profili social corretti
4. Salva i link trovati nella tabella `partner_social_links` (evitando duplicati)
5. Se il partner ha un sito web, estrae il logo (da favicon o og:image) e lo salva in `partners.logo_url`

Chiavi API necessarie: `FIRECRAWL_API_KEY` e `LOVABLE_API_KEY` (gia configurate).

### 3. Modifiche UI in `src/pages/Agents.tsx`
- Aggiungere un pulsante **"Deep Search"** (con icona ricerca/AI) nell'header del dettaglio agente, accanto ai pulsanti esistenti
- Mostrare stato di caricamento durante la ricerca
- Dopo il completamento, i social link appaiono automaticamente grazie all'invalidazione della cache
- Mostrare il **logo aziendale** accanto al nome dell'azienda (al posto o accanto alla bandiera del paese) quando disponibile

### 4. Modifiche a `src/components/agents/SocialLinks.tsx`
- Nessuna modifica strutturale: i link trovati dalla deep search vengono salvati nella stessa tabella `partner_social_links` e appaiono automaticamente

### 5. Configurazione deploy
- Aggiungere `[functions.deep-search-partner]` con `verify_jwt = false` in `supabase/config.toml`

## Dettaglio tecnico

### Edge function `deep-search-partner`

```text
Input: { partnerId: string }

Flow:
1. GET partner + partner_contacts dal DB
2. Per ogni contatto:
   a. Firecrawl search: "{name} {company} linkedin"
   b. AI analizza risultati -> estrae URL LinkedIn
   c. INSERT in partner_social_links (platform: "linkedin", contact_id: contatto)
3. Per il logo:
   a. Firecrawl scrape del sito web del partner (formato: links + metadata)
   b. Estrae og:image o favicon
   c. UPDATE partners SET logo_url = ...
4. Return: { success, socialLinksFound, logoFound }
```

### UI: Pulsante Deep Search nell'header AgentDetail

Posizione: accanto al pulsante "Scheda completa", un nuovo pulsante:
- Icona: Search + Sparkles
- Testo: "Deep Search"
- Loading spinner durante l'esecuzione
- Toast di successo/errore al completamento

### Logo nell'header

Quando `partner.logo_url` e presente, mostrare un'immagine 48x48 arrotondata al posto della bandiera grande. La bandiera viene spostata come badge piccolo sovrapposto.

## File da modificare/creare

1. **Migrazione DB**: aggiunta colonna `logo_url`
2. **Nuovo file**: `supabase/functions/deep-search-partner/index.ts`
3. **Modifica**: `src/pages/Agents.tsx` (pulsante Deep Search + logo)
4. **Modifica**: `supabase/config.toml` (configurazione funzione)

