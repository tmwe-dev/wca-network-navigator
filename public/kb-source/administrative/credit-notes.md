---
title: Note di credito e rettifiche
tags: [administrative, procedures, email, credit-notes, refunds, corrections]
---

# Note di credito e rettifiche

## Obiettivo
Gestire richieste di rettifica, rimborso o storno con procedure corrette e documentate.

## Quando emettere una nota di credito

Una nota di credito (credit note) è appropriata quando:
- Fattura contiene errore di importo
- Quantità fornita è inferiore a quella fatturata
- Qualità del servizio è inferiore agli standard (sconto/rimborso parziale)
- Cliente richiede restituzione merce (se applicabile)
- Storno di fattura per ordine annullato

## Procedure verifica

### Step 1: Analisi della richiesta
Quando cliente chiede rimborso/rettifica:
1. Localizza fattura originale (numero, data, importo)
2. Verifica se pagamento è stato ricevuto
3. Determina motivo della rettifica (errore nostro, client change, qualità, etc.)
4. Calcola importo credit note

### Step 2: Classificazione del motivo

| Motivo | Azione | Responsabile |
|--------|--------|--------------|
| Errore di calcolo | Emetti credit note subito | Amministrazione |
| Errore di quantità | Verifica con operativo, emetti credit note | Team operativo |
| Problema qualità | Richiedi documentazione, valuta rimborso | Quality Manager |
| Ordine annullato | Emetti credit note per intero importo | Amministrazione |
| Sconto negoziato | Emetti credit note per importo sconto | Commercial |

### Step 3: Documentazione

Prima di emettere credit note, raccogli:
- Motivo per iscritto dal cliente
- Foto/evidenza del problema (se qualità)
- Approvazione da responsabile commerciale se sconto > 10%
- Copia della fattura originale

## Procedura emissione credit note

### Elementi obbligatori della nota di credito
- [ ] Numero progressivo (es. CN-2026-0001)
- [ ] Data emissione
- [ ] Riferimento alla fattura originale (numero, data, importo)
- [ ] Descrizione motivo rettifica
- [ ] Importo credit note (lordo e netto se IVA)
- [ ] Dati cliente
- [ ] Firma/autorizzazione di emissione

### Timing
- **Credit note deve essere emessa entro 5 giorni lavorativi** dalla richiesta verificata
- Se cliente è in attesa: comunica lo status (es. "In approvazione, vi farò sapere domani")

## Template comunicazione credit note

```
Caro [Nome],

Ho completato la verifica della vostra richiesta di rettifica.

Fattura originale: [INV_NUM] del [DATE] - €[AMOUNT]
Motivo rettifica: [MOTIVO]
Importo credit note: €[CREDIT_AMOUNT]

La nota di credito [CN_NUM] è stata emessa il [DATE].

Questa può essere utilizzata per:
✓ Compensare i futuri ordini
✓ Richiesta di rimborso (se non avete altri ordini in sospeso)

Se preferite rimborso diretto, processate il bonifico entro [DAYS] giorni lavorativi.

Ancora mi scuso per l'inconveniente. Contattatemi se altre domande.
```

## Gestione situazioni complesse

### Cliente chiede rimborso ma ordine è già completato e consegnato
- **Se < 14 giorni dalla consegna**: rimborso completo (se non usato/danneggiato)
- **Se > 14 giorni**: credit note solo per servizio non svolto

### Cliente vuole rimborso ma ha pagato con carta
- Rimborso va sulla stessa carta (non bonifico)
- Comunica: "Rimborso sarà disponibile sul vostro conto in 5-7 giorni lavorativi"

### Credit note per sconto commerciale negoziato
Template diverso:
```
Caro [Nome],

Come concordato, vi applico uno sconto del 5% sulla fattura [INV_NUM].

Credit note [CN_NUM] - €[AMOUNT] - valida per prossimi ordini

Vi contatto il mese prossimo per vedere come integrare questo sconto nei vostri pagamenti futuri.
```

### Cliente chiede rettifica su fattura molto vecchia (> 1 anno)
- Verifica conservazione archivio (obbligo legale)
- Consulta ragioniere se rettifica genera conseguenze fiscali
- Emetti comunque credit note per trasparenza, ma documenta nel file cliente

## Escalation

**Se cliente non accetta credit note e insiste su rimborso contante**:
1. Verifica politiche aziendali su rimborsi diretti
2. Offri pagamento tramite assegno (tracciato) se non bonifico
3. Documenta autorizzazione del rimborso da parte di management
4. Mantieni traccia completa per audit trail

**Se sconto richiesto è > 20% dell'ordine**:
- Non autorizzare da solo
- Escalation a Commercial Director
- Richiedi approvazione per iscritto prima di emettere credit note
