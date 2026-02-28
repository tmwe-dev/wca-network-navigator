

## Problema

Quando si lancia "Genera Tutte", il sistema tenta di generare email anche per partner senza indirizzo email, causando errori 422 ripetuti. L'utente vuole semplicemente che questi partner vengano esclusi automaticamente.

## Piano

### 1. Filtrare le attività senza email prima della generazione (`Workspace.tsx`)

Nel metodo `handleGenerateAll`, prima di iterare, filtrare le attività che hanno un contatto con email disponibile. Usare i dati già presenti in `AllActivity.selected_contact.email` o i dati del partner (`partners.email` non è nel select corrente, ma `selected_contact` sì).

Aggiungere un pre-filtro:
```
const withEmail = toGenerate.filter(a => 
  a.selected_contact?.email || /* fallback partner email check */
);
```

Se alcune attività vengono escluse, mostrare un toast informativo: "X partner esclusi (email mancante)".

### 2. Verificare i dati disponibili nel tipo `AllActivity`

Il tipo `AllActivity` in `useActivities.ts` include `selected_contact.email`. Bisogna verificare se serve anche il campo `partners.email` (email generica del partner) come fallback. Il select attuale non lo include — va aggiunto alla query.

### 3. Aggiungere `email` al select di `partners` in `useAllActivities`

Modificare la query in `useAllActivities` per includere `email` nel select dei partners:
```
partners(company_name, company_alias, country_code, country_name, city, enriched_at, website, logo_url, email)
```

Aggiornare il tipo `AllActivity.partners` di conseguenza.

### File da modificare
- `src/hooks/useActivities.ts` — aggiungere `email` al select partners + tipo
- `src/pages/Workspace.tsx` — filtrare attività senza email in `handleGenerateAll`

