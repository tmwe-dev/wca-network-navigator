---
title: Gestione richieste fattura
tags: [administrative, procedures, email, invoices, billing, financial]
---

# Gestione richieste fattura

## Obiettivo
Rispondere a richieste di fattura in modo rapido, verificare i riferimenti e fornire una risposta professionale.

## Procedura verifica riferimenti

### Step 1: Raccolta dati
Quando ricevi una richiesta di fattura, il cliente può fornire:
- Numero d'ordine/Booking Reference (es. "WCA-2026-04-001")
- Email di ordine originale
- Data ordine approssimativa (es. "aprile")
- Importo indicativo

### Step 2: Ricerca nei sistemi
- Verifica booking/ordine nel sistema
- Conferma: cliente, quantità, importo, data
- Verifica che ordine sia **completato** (non annullato o parziale)
- Controlla se fattura è già stata emessa

### Step 3: Risposta appropriata

#### Se fattura esiste già
"La vostra fattura è stata emessa il [DATE] con numero [INV_NUM]. La allego a questa email."

#### Se fattura non esiste ma ordine confermato
"Ho trovato il vostro ordine (Ref [BOOKING_NUM]). Preparo la fattura e ve la invio entro [HOURS] ore."

#### Se ordine non trovato
"Non trovo l'ordine con i dati forniti. Potete darmi il numero di booking esatto o la data approssimativa? Con quel dato lo trovo subito."

## Elementi obbligatori in una fattura

Verifica che contenga:
- [ ] Numero fattura unico e progressivo
- [ ] Data emissione
- [ ] Dati cliente (ragione sociale, indirizzo, P.IVA)
- [ ] Descrizione servizio/prodotto
- [ ] Quantità e prezzo unitario
- [ ] Totale lordo e netto (se IVA)
- [ ] Condizioni di pagamento (scadenza)
- [ ] Numero conto bancario (per bonifico)
- [ ] Numero d'ordine di riferimento cliente

## Template risposta

```
Caro [Nome],

Ho trovato il vostro ordine:

Ref.: [BOOKING_NUMBER]
Data ordine: [DATE]
Importo: €[AMOUNT]

La fattura è stata emessa il [INVOICE_DATE] con numero [INVOICE_NUM].

La allego in PDF. Se avete domande o discrepanze, scrivetemi pure.

Scadenza pagamento: [DUE_DATE]
Modalità pagamento: Bonifico IBAN [IBAN]

Grazie!
```

## Escalation

### Cliente dice "Non ha ricevuto la fattura"
Verifica:
1. Che l'email del cliente sia corretta nei nostri dati
2. Se è in spam/posta indesiderata
3. Reinvio della fattura con conferma di ricezione
4. Se necessario: copia cartacea per fax/posta

### Cliente contesta l'importo
- Chiedi di specificare la discrepanza ("Mi sembra più alto" non va bene)
- Verifica con team operativo che servizio sia completo
- Se errore nostro: emetti nota di credito
- Se errore cliente: spiega componenti fattura

### Richiesta fattura per ordine annullato
- Conferma annullamento
- Offri nota di credito se già pagato
- Se non pagato: chiedi conferma annullamento per iscritto prima di procedere

## Note importanti
- Fatture sono documenti legali: conserva copia nel sistema
- Non puoi richiederla al cliente: devi emetterla tu dal tuo sistema
- Se cliente chiede fattura per acquisto 2+ anni fa: verifica archivio, potrebbe essere soggetto a conservazione legale
