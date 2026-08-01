---
title: Segnali di conversione prospect→client
tags: [domain_routing, procedures, email, conversion, lead-qualification, prospect-to-client]
---

# Segnali di conversione prospect→client

## Obiettivo
Riconoscere quando un prospect diventa cliente e applicare il routing corretto ai domini email operativi/amministrativi.

## Pattern di conversione

Un prospect passa a status "CLIENT CONVERTITO" quando:

### 1. Ordine confermato
**Segnale**: Ricezione di Ordine di Acquisto (PO) firmato

- Cliente sottoscrive impegno economico
- Booking è stato creato nel sistema
- Importo è > 0 e confermato

**Routing**: operative@domain (booking, consegna, tracking)

### 2. Primo pagamento ricevuto
**Segnale**: Bonifico ricevuto sul nostro conto

- Importo corrisponde almeno al 30% dell'ordine
- Provenienza è verificata come il cliente
- Data è registrata nel sistema

**Routing**: operative@ + administrative@ (preparazione consegna, generazione fattura)

### 3. Sottoscrizione contratto/accordo
**Segnale**: Cliente ha firmato accordo commerciale

- Contratto è stato sottoscritto (digitale o cartaceo)
- Termini e condizioni sono stati accettati esplicitamente
- Data inizio servizio è definita

**Routing**: operative@ (attivazione, consegna, setup)

## Pattern per categoria di prodotto/servizio

### Se è consegna fisica
✓ Conversione = Booking + Indirizzo di consegna verificato
→ **Routing**: operative@

### Se è servizio ricorrente
✓ Conversione = Primo pagamento ricevuto + Modulo setup completato
→ **Routing**: operative@ + administrative@ (per gestione fatture ricorrenti)

### Se è partnership strategica
✓ Conversione = Contratto firmato + Riunione kickoff completata
→ **Routing**: operative@ + support@ (con escalation a leadership)

## Verifica automatica di conversione

Sistema dovrebbe controllare (al momento della ricezione email):

```
if (email_from_customer == booking.contact_email) {
  // Localizza il booking
  booking = findBookingByCustomer(email_from)
  
  if (booking.status == "CONFERMATO" || booking.status == "PAGATO") {
    // Client convertito: usa routing operativo
    route_to = ["operative", "administrative", "support"]
  } else if (booking.status == "DRAFT") {
    // Ancora prospect: usa routing commerciale
    route_to = ["commercial"]
  }
}
```

## Segnali di escalation interno

Quando prospect diventa cliente, notifica:
- **Team Operativo**: "Nuovo booking [ID], cliente [NAME], consegna [DATE]"
- **Amministrazione**: "Nuovo cliente, aspettare fatturazione per [REF]"
- **Commercial**: "Lead [NAME] convertito, follow-up per upsell disponibile dal [DATE]"

---

## Eccezioni e casi particolari

### Cliente rinuncia dopo primo ordine
Se cliente annulla entro 14 giorni:
- Status torna a "PROSPECT"
- Routing torna a "commercial"
- Keep in CRM per re-engagement

### Cliente fa ordine, poi dispare
Se cliente non contatta per > 90 giorni dopo conversione:
- Status diventa "DORMANT"
- Routing rimane operativo ma assegna a retention team
- Campaign di re-engagement

### Partner/Distributor che rende
Se cliente rivende i nostri servizi:
- Conversione acontece con partner agreement firmato
- Routing include "support" (li supportiamo loro, loro supportano end customer)
- Livello escalation più alto per dispute resolution

---

## Timeline di conversione

| Giorno | Evento | Routing |
|--------|--------|---------|
| 0 | PO ricevuta | operative |
| 1 | Pagamento received | operative + administrative |
| 2 | Consegna confermata | operative |
| 3+ | Cliente contatta | operative (per support pre/post consegna) |
| +7 | Post-consegna follow-up | support (feedback) |
| +30 | Check-in upsell | commercial (se è partnership) |

---

## Action items al momento di conversione

[ ] Crea booking/ordine nel sistema
[ ] Assegna numero di riferimento univoco
[ ] Notifica team operativo
[ ] Carica PO nel file cliente
[ ] Se pagamento: registra nella contabilità
[ ] Se contratto: archivia digitalmente
[ ] Aggiorna contact status in CRM: "CONVERTED"
[ ] Agenda follow-up di consegna
[ ] Schedule post-delivery check-in

---

## Come comunicare la conversione internamente

Template notifica:

```
CONVERSIONE PROSPECT → CLIENT

Cliente: [NAME] ([EMAIL])
Booking Ref: [BOOKING_ID]
Importo: €[AMOUNT]
Tipo Servizio: [SERVICE]
Data Consegna: [DATE]

Responsabile Operativo: [TEAM]
Responsabile Billing: [ACCOUNTING]

Prossimo step: [NEXT_ACTION] da completare entro [DATE].
```

---

## Metriche di conversione da tracciare

- **Conversion Rate**: % di prospect che diventano clienti (goal: > 15%)
- **Time to Conversion**: giorni da first contact a payment received
- **Deal Size at Conversion**: importo medio primo ordine
- **Repeat Rate**: % di clienti convertiti che fanno secondo ordine (goal: > 40%)
