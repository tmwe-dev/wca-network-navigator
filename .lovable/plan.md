

## Diagnosi e Piano di Ristrutturazione Contatti

### Analisi del record "ADAMO PARFUM SRL"

Ho trovato il record. Ecco il confronto:

| Campo | Valore salvato | Valore nel raw_data |
|-------|---------------|---------------------|
| `company_name` | ADAMO PARFUM SRL | `alias_2`: "ADAMO PARFUM SRL", `name_2`: "ADAMO PARFUM SRL" |
| `name` | **"Cliente"** ← ERRATO | `alias`: "Cliente", `name`: "Cliente" |
| `email` | info@adamoparfum.com | ✓ corretto |
| `phone` | NULL | `phone`: "NULL" (stringa) |
| `address` | NULL | `address`: "Via dell'Industria, 58A 20037 Paderno Dugnano (Milan)" |

**Problema principale**: il campo sorgente `name` / `alias` contiene etichette generiche come "Cliente", "log", "Nuovo utente" — **non** nomi di persone. Questi sono stati mappati nel campo `name` della tabella. Numeri:
- **721 record** con `name` = "Cliente"
- **269 record** con `name` = "log"
- **112 record** con `name` = "Nuovo utente"

Inoltre, il campo `address` dal file sorgente non è stato mappato correttamente e molti `phone` con valore stringa "NULL" non sono stati puliti.

---

### Piano: Ristrutturazione completa della sezione Contatti

#### 1. Pulizia dati (migrazione SQL)

- Convertire `name` = "Cliente" / "log" / "Nuovo utente" in `NULL` (non sono nomi reali)
- Recuperare `address` e `city` dal `raw_data` dove mancano
- Pulire `phone` con valore stringa "NULL"

#### 2. Concetto di "Gruppo di carico"

Aggiungere `group_name` alla tabella `import_logs` — è il nome logico che l'utente assegna al batch di contatti al momento dell'upload (es. "Global", "Cosmoprof 2024", "Pitti Uomo"). In alternativa, si può usare il campo `origin` già presente sui contatti come raggruppatore naturale.

**Scelta proposta**: aggiungere colonna `group_name text` su `import_logs` e propagare il valore come filtro. Durante l'import, l'utente potrà dare un nome al gruppo. Per i dati esistenti, il `file_name` diventa il gruppo di default.

#### 3. Pagina Contatti ridisegnata

La pagina `/contacts` diventa un browser di gruppi di carico:
- **Barra superiore**: selettore del gruppo di carico (dropdown con nome gruppo + conteggio record)
- **Filtri secondari**: paese, origine, ricerca
- **Lista contatti**: raggruppati per paese/origine all'interno del gruppo selezionato
- I contatti qui sono in fase "pre-circuito" — non hanno ancora avuto interazioni reali

#### 4. Nuova pagina "Circuito di Attesa" (`/holding-pattern`)

Una dashboard separata che mostra SOLO i contatti che hanno ricevuto almeno un'interazione reale (email, chiamata, WhatsApp, meeting). Include:
- Tabella con colonne: Azienda, Contatto, Data 1° contatto, Data ultimo contatto, N° interazioni, Note, Status
- Filtri per status (contacted, in_progress, negotiation, converted, lost)
- Timeline espandibile per ogni riga
- KPI in alto: totali per fase del circuito

Un contatto passa dalla pagina Contatti al Circuito di Attesa quando viene registrata la prima interazione reale.

#### 5. File da creare/modificare

| File | Azione |
|------|--------|
| Migrazione SQL | Pulizia "Cliente"/"log", aggiunta `group_name` a `import_logs` |
| `src/hooks/useContacts.ts` | Aggiungere filtro per `import_log_id` / gruppo |
| `src/components/contacts/ContactFiltersBar.tsx` | Aggiungere selettore gruppo di carico |
| `src/components/contacts/ContactListPanel.tsx` | Adattare alla selezione per gruppo |
| `src/pages/HoldingPattern.tsx` | **Nuovo** — Dashboard circuito di attesa |
| `src/components/holding/HoldingDashboard.tsx` | **Nuovo** — Tabella + KPI |
| `src/App.tsx` | Aggiungere rotta `/holding-pattern` |
| `src/components/layout/AppSidebar.tsx` | Aggiungere voce "Circuito di Attesa" |

