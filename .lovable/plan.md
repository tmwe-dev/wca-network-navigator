

# Potenziamento Email Workspace: Elimina, Deep Search e Info Avanzate

## 1. Pulsante Elimina Attivita

Aggiungere nell'header del Workspace (accanto a "Genera Tutte") un pulsante **"Elimina"** visibile solo quando ci sono elementi selezionati. Usa il hook `useDeleteActivities` gia esistente con dialog di conferma.

**File: `src/pages/Workspace.tsx`**
- Importare `useDeleteActivities` e `Trash2`
- Aggiungere un pulsante rosso "Elimina (N)" che appare quando `selectedIds.size > 0`
- Dialog di conferma prima dell'eliminazione
- Dopo l'eliminazione: pulisce la selezione e deseleziona l'attivita corrente se era tra quelle eliminate

## 2. Deep Search dal Workspace

Aggiungere un pulsante **"Deep Search"** nell'header, accanto a Elimina. Funziona come nel Partner Hub: loop sequenziale sulle attivita selezionate (o tutte se nessuna selezionata), invocando `deep-search-partner` per ogni partner. Include progresso visivo e pulsante Stop.

**File: `src/pages/Workspace.tsx`**
- Aggiungere stato per `deepSearching`, `deepSearchProgress`, `deepSearchAbortRef`
- Pulsante "Deep Search" con icona `Sparkles` che lancia il loop
- Pulsante "Stop" durante l'esecuzione
- Feedback progresso inline "Deep Search 3/12..."

## 3. Informazioni Arricchite nella Lista Contatti

Aggiungere indicatori visivi su ogni card nella ContactListPanel per mostrare a colpo d'occhio lo stato di arricchimento e i link utili.

**File: `src/components/workspace/ContactListPanel.tsx`**
- Icona LinkedIn (se presente) accanto al nome del contatto
- Indicatore "enriched" (pallino verde) se il partner ha `enriched_at` valorizzato
- Icona globo/website se il partner ha un sito web

Per ottenere questi dati, la query `useAllActivities` gia include i dati partner (`company_name`, `country_code`, ecc.). Serve aggiungere i campi `enriched_at`, `website` e `logo_url` alla select dei partner nella query.

**File: `src/hooks/useActivities.ts`**
- Nella funzione `useAllActivities`, espandere la select dei partner per includere `enriched_at, website, logo_url`
- Aggiornare il tipo `AllActivity` per includere questi campi

## 4. Filtro aggiuntivo "Enriched / Non Enriched"

**File: `src/components/workspace/ContactListPanel.tsx`**
- Aggiungere due nuovi filtri combinabili: "Arricchito" (`enriched_at` presente) e "Non arricchito"

## Riepilogo modifiche

| File | Modifica |
|------|----------|
| `src/pages/Workspace.tsx` | Pulsanti Elimina + Deep Search + Stop nell'header |
| `src/hooks/useActivities.ts` | Aggiungere `enriched_at, website, logo_url` alla query partner e al tipo `AllActivity` |
| `src/components/workspace/ContactListPanel.tsx` | Icone LinkedIn/website/enrichment su ogni card + filtri "Arricchito"/"Non arricchito" |

