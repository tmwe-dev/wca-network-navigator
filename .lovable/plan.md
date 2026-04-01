

# Test LinkedIn con Biglietti da Visita — Dati Minimi per Stress Test

## Idea

Invece dei 5 contatti hardcoded, la pagina `/test-linkedin` caricherà **5 biglietti da visita dal DB** selezionati per livelli crescenti di completezza dati, per testare come il sistema si comporta con informazioni scarse.

## 5 Contatti Selezionati (dal DB reale)

| # | Nome | Azienda | Email | Phone | Livello |
|---|------|---------|-------|-------|---------|
| 1 | Manikandan M | Shiftco | ❌ | ❌ | Solo nome+azienda+posizione |
| 2 | Carlos Fernandez | Racing Cargo | ❌ | ❌ | Solo nome+azienda (nome comune) |
| 3 | Sunil Mampallil Joseph | Shepherd Shipping | ✅ | ❌ | Nome+azienda+email |
| 4 | Raechel Lobo | Skyfer Logistic Inc. | ✅ | ❌ | Nome+azienda+email+posizione |
| 5 | Henry Zheng | Genius Int'l Logistics | ✅ | ❌ | Nome+azienda+email+posizione (nome cinese) |

Questo testa: ricerca senza email, con email aziendale, nomi comuni, nomi internazionali, aziende con nomi complessi.

## Modifiche

### File: `src/pages/TestLinkedInSearch.tsx`

1. Sostituire l'array `TEST_CONTACTS` hardcoded con i 5 biglietti da visita selezionati sopra
2. Aggiungere colonna "Dati disponibili" nella tabella risultati che mostra quali campi sono presenti (badge colorati: ✅ nome, ✅ email, ❌ phone, ecc.)
3. Aggiungere etichetta "Livello difficoltà" per ogni contatto (Facile/Medio/Difficile) in base alla quantità di dati
4. Rendere i campi email/country opzionali nell'interfaccia `TestContact` (dato che molti biglietti non hanno email)

### Dettagli
- Un solo file modificato: `TestLinkedInSearch.tsx`
- I dati sono hardcoded dal DB (non serve query live) per semplicità e riproducibilità del test

