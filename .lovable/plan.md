

# Piano: Sezione Biglietti da Visita Dedicata nel CRM

## Stato attuale

Il sistema ha gia':
- Tabella `business_cards` con matching trigger automatico (partner + contatti)
- Toggle "Biglietti da visita" nell'import (solo etichetta origine)
- Filtro `metPersonally` con icona Handshake nella lista contatti
- Hook `useBusinessCards` con CRUD completo
- Campo `photo_url` nella tabella (mai usato)

**Cosa manca**: una sezione dedicata per caricare **foto** di biglietti da visita, OCR/AI parsing dell'immagine, miniatura visibile nei contatti matchati, deep search automatica post-creazione.

## Soluzione: 4 interventi

### 1. Nuovo tab "Biglietti" nel CRM

Aggiungere un quarto tab in `CRM.tsx` con icona `ContactRound`:

```text
Contatti | Prospect | Import | Biglietti
```

Lazy-load di un nuovo componente `BusinessCardsHub.tsx`.

### 2. Componente `BusinessCardsHub.tsx`

Interfaccia dedicata con:

**Upload zona** — drag & drop immagini (JPG, PNG, HEIC). Le foto vengono caricate nello storage bucket `import-files` e il URL salvato in `photo_url`.

**AI Parsing** — Dopo upload, chiama una nuova edge function `parse-business-card` che:
- Riceve l'URL dell'immagine
- Usa Gemini 2.5 Flash (vision) per estrarre: company_name, contact_name, email, phone, mobile, position, address, website
- Restituisce JSON strutturato
- Il frontend crea il record in `business_cards` con i dati estratti + `photo_url`

**Lista cards** — Mostra tutti i biglietti da visita con:
- Miniatura della foto (aspect-ratio 16/9, rounded)
- Nome contatto + azienda
- Badge match status (matched/unmatched/pending)
- Filtri per evento, status match
- Bottone "Deep Search" per lanciare `deep-search-contact` sul contatto matchato

**Form evento** — Campo evento (es. "Cosmoprof 2026"), data incontro, location, note. Compilabile prima o dopo l'upload.

### 3. Edge function `parse-business-card`

Nuova funzione che:
- Riceve `{ imageUrl, userId }`
- Scarica l'immagine dallo storage
- Invia a Gemini 2.5 Flash con prompt vision: "Estrai i dati del biglietto da visita"
- Restituisce JSON strutturato con i campi della tabella `business_cards`
- Costo: 2 crediti

### 4. Miniatura biglietto nel `ContactDetailPanel.tsx`

Quando un contatto ha un `matched_contact_id` in `business_cards`:
- Query per recuperare il business card matchato
- Mostrare una card compatta con:
  - Miniatura della foto del biglietto (se presente)
  - Icona Handshake + nome evento + data incontro
  - Link per vedere il biglietto completo

Questo appare sopra la sezione enrichment nel pannello dettaglio.

## File da creare/modificare

| File | Azione |
|------|--------|
| `src/pages/CRM.tsx` | Aggiungere tab "Biglietti" |
| `src/components/contacts/BusinessCardsHub.tsx` | Creare — hub completo biglietti |
| `supabase/functions/parse-business-card/index.ts` | Creare — OCR via Gemini vision |
| `src/components/contacts/ContactDetailPanel.tsx` | Modificare — mostrare miniatura biglietto matchato |
| `src/hooks/useBusinessCards.ts` | Aggiungere hook per upload foto + parsing |

## Flusso utente

1. Vado su CRM → tab "Biglietti"
2. Trascino la foto di un biglietto da visita
3. L'AI estrae automaticamente nome, azienda, email, telefono
4. Inserisco evento "Cosmoprof 2026" e data
5. Il trigger DB fa il matching automatico con contatti/partner esistenti
6. Il contatto matchato mostra la miniatura del biglietto nel suo pannello dettaglio
7. Posso filtrare "Incontrati personalmente" nella lista contatti per vedere solo quelli con biglietto

