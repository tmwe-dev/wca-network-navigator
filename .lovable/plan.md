

# Fix Contact Picker — Dati non visibili

## Problema principale

Il campo restituito dalla funzione `get_country_stats()` si chiama `total_partners`, ma il codice del picker cerca `partner_count` o `count`:

```js
// Riga 59 — SBAGLIATO
count: Number(r.partner_count || r.count || 0)  // sempre 0!
```

Questo causa: bandiere visibili ma tutte con conteggio **0**, il che rende il picker inutilizzabile.

## Secondo problema

Le query per Partner, Contatti e BCA richiedono `shouldSearch = true` (3+ caratteri digitati OPPURE un paese selezionato). Siccome i conteggi sono tutti 0, l'utente non ha incentivo a cliccare su un paese, e senza cliccare non vede nulla.

## Correzioni

### 1. Fix campo conteggio (riga 59 di `EmailComposerContactPicker.tsx`)
Cambiare `r.partner_count || r.count` in `r.total_partners`:
```js
count: Number(r.total_partners || 0),
```

### 2. Mostrare risultati anche senza filtro attivo
Rimuovere la condizione `shouldSearch` dalle query di ogni tab. Se non c'e ne ricerca ne paese selezionato, caricare i primi 200 risultati (gia limitati da `.limit(200)`). Questo permette all'utente di navigare immediatamente i dati senza dover prima digitare o selezionare un paese.

In alternativa, caricare automaticamente i dati quando si seleziona un tab (senza richiedere 3 caratteri minimi), mantenendo il filtro paese come opzionale.

### 3. Aggiungere `is_active` filter ai partner
Le query partner nel picker non filtrano per `is_active`. Aggiungere `.eq("is_active", true)` per coerenza con il resto dell'app (attualmente non causa problemi perche tutti sono attivi, ma e una protezione necessaria).

## File da modificare

| File | Modifica |
|------|----------|
| `src/components/global/EmailComposerContactPicker.tsx` | Fix mapping `total_partners`, rimuovere gate `shouldSearch` dalle query, aggiungere filtro `is_active` |

