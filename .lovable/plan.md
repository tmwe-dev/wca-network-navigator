

# Piano: Regole Commerciali AI — Sede Unica, History Obbligatoria, Tono per Tipologia

## Analisi Situazione Attuale

**Cosa esiste già:**
- History delle interazioni viene iniettata nei prompt (`generate-email` e `generate-outreach`) — ma solo ultime 5 interazioni e senza analisi semantica (tono, aperture, silenzi)
- Assegnazione agente esclusiva funziona (`client_assignments` + `exclusive_agent_id`)
- Knowledge Base strategica con tecniche di vendita
- Style preferences apprese dall'editing utente

**Cosa manca:**
1. **Nessun filtro anti-duplicazione per sede** — bulk e campagne possono contattare 3 persone della stessa azienda/sede contemporaneamente
2. **History non analizzata semanticamente** — il prompt riceve raw data ma non "comprende" che dopo 5 tentativi senza risposta serve un cambio strategia
3. **Nessuna distinzione partner vs cliente finale** — il sistema usa lo stesso tono per tutti (partners = `freight_forwarder` nella tabella `partners`, clienti finali = `imported_contacts` da fiere/settori industriali)
4. **Nessuna regola per sedi multiple della stessa azienda** — esistono duplicati (es. HP Global in Ho Chi Minh City e Hanoi) senza logica di coordinamento

## Modifiche Previste

### 1. Guardia Anti-Duplicazione per Sede (nuovo modulo)

Creare `supabase/functions/_shared/sameLocationGuard.ts`:
- Funzione `checkSameLocationContacts(companyName, city, contactId, userId)` che:
  - Cerca tutti i partner con stesso `company_name` (o simile) e stessa `city`
  - Controlla se negli ultimi 7 giorni è stata inviata una comunicazione a un altro contatto della stessa sede
  - Restituisce `{ allowed: boolean, reason?: string, otherContacts?: [...] }`
- Funzione `getSameCompanyBranches(companyName, userId)` che:
  - Restituisce tutte le sedi diverse della stessa azienda
  - Usata dal prompt per dire "la comunicazione è stata estesa anche alla sede di X"

Integrazione:
- `generate-email`: prima di generare, chiama il guard → se bloccato, ritorna errore 422 con messaggio chiaro
- `generate-outreach`: stessa logica
- Campagne bulk: il guard filtra i duplicati prima di inserire nella coda

### 2. Analisi History Semantica nel Prompt

Potenziare la sezione history in `generate-email/index.ts` e `generate-outreach/index.ts`:
- Aumentare il limite da 5 a 15 interazioni
- Aggiungere `channel_messages` (email ricevute/inviate) alla history
- Calcolare metriche pre-prompt:
  - `total_contacts_sent`: quante comunicazioni inviate
  - `last_response_date`: ultima risposta ricevuta (o null)
  - `days_since_last_contact`: giorni dall'ultimo contatto
  - `unanswered_count`: numero di email senza risposta
  - `tone_progression`: da formale a colloquiale se ci sono state risposte
- Iniettare nel prompt un blocco `ANALISI RELAZIONE` con queste metriche + istruzioni specifiche:
  - Se `unanswered_count >= 3`: "Cambia approccio, usa tecniche di re-engagement"
  - Se ci sono risposte positive: "Mantieni tono colloquiale, referenzia conversazione precedente"

### 3. Differenziazione Tono Partner vs Cliente Finale

Nel prompt system, aggiungere blocco `TIPOLOGIA INTERLOCUTORE`:

**Per partner** (source_type = "partner" + partner_type = "freight_forwarder"):
```
INTERLOCUTORE: PARTNER LOGISTICO
Questo è un potenziale partner commerciale, non un cliente finale.
Usa tono collaborativo, da alleanza commerciale.
Parla di: sinergie operative, network condivisi, complementarità dei servizi.
Proponi: integrazione sistemi, accesso tariffe partner, collaborazione strutturata.
```

**Per clienti finali** (source_type = "contact" o "prospect"):
```
INTERLOCUTORE: CLIENTE FINALE
Questo è un'azienda che necessita servizi di spedizione/logistica.
Usa tono commerciale orientato ai benefici.
Parla di: semplicità, risparmio, velocità, accesso diretto ai servizi.
Proponi: apertura account, accesso piattaforma, tariffe privilegiate.
```

### 4. Blocco Istruzioni Commerciali nella KB

Aggiungere una KB entry con le regole commerciali dalla richiesta utente come prompt operativo — così l'AI ha sempre accesso a:
- Obiettivo finale: convertire lead in cliente
- Leve: account, tariffe, semplificazione operativa
- Flusso: classificazione → assegnamento → follow-up → conversione

### 5. Coordinamento Sedi Multiple nel Prompt

Quando `getSameCompanyBranches` trova altre sedi:
- Iniettare nel prompt: "Questa azienda ha sedi anche a [city1, city2]. Stai scrivendo alla sede di [city]. Se opportuno, menziona che la comunicazione è stata estesa anche ad altri referenti in sedi diverse."
- Non bloccare l'invio, ma fornire contesto

## File Coinvolti

| File | Azione |
|------|--------|
| `supabase/functions/_shared/sameLocationGuard.ts` | **Nuovo** — guardia anti-duplicazione per sede |
| `supabase/functions/generate-email/index.ts` | Integrare guard, history estesa, tono per tipologia, coordinamento sedi |
| `supabase/functions/generate-outreach/index.ts` | Stessa integrazione |
| `supabase/functions/agent-execute/index.ts` | Aggiungere regole commerciali nel context injection |

## Ordine di Esecuzione

1. Creare `sameLocationGuard.ts` (guardia anti-duplicazione)
2. Potenziare history in `generate-email` (analisi semantica + metriche)
3. Aggiungere differenziazione tono partner/cliente in entrambe le Edge Function
4. Integrare coordinamento sedi multiple
5. Aggiungere regole commerciali nel context injection di `agent-execute`

