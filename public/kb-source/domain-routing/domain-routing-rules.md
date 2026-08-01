---
title: Regole smistamento per dominio
tags: [domain_routing, procedures, email, routing, classification, operational-domains]
---

# Regole smistamento per dominio

## Obiettivo
Definire criteri chiari per il routing delle email ricevute verso i 4 domini (commercial, operative, administrative, support).

## Classi di email e routing

### CLASSE 1: EMAIL COMMERCIALE
**Dominio**: commercial@domain
**Destinatari**: Sales team, BD, commercial managers
**Urgenza**: ALTA

#### Segnali di riconoscimento
- Prospect non ancora cliente (no booking confermato)
- Richiesta di preventivo iniziale
- Domanda sulla roadmap/future features
- Interesse generale in partnership
- Lead freddo (referral, inbound)

#### Esempi di email
- "Potete inviarmi un preventivo per [SERVIZIO]?"
- "Siamo interessati a conoscere i vostri servizi"
- "Abbiamo una partnership da proporvi"
- "Quali sono le vostre tariffe per [SERVIZIO]?"

#### Risposta SLA
- **First contact** (prospect nuovo): entro 4 ore
- **Follow-up su preventivo**: entro 24 ore

#### Template di risposta commerciale
```
Caro [Nome],

Grazie per il vostro interesse! Sono [SALESPERSON], responsabile commerciale.

[RISPOSTA PERSONALIZZATA]

Possiamo parlare brevemente domani? Sono disponibile alle [ORE] al [PHONE].

Rimango in attesa.
```

---

### CLASSE 2: EMAIL OPERATIVA
**Dominio**: operative@domain
**Destinatari**: Logistica, operations, delivery teams
**Urgenza**: CRITICA

#### Segnali di riconoscimento
- Cliente ha booking confermato
- Richiesta su stato consegna/tracking
- Domanda su dettagli ordine
- Modifica booking (cambio data, indirizzo)
- Problema logistico (ritardo, danno, smarrimento)
- Richiesta di numero di tracking

#### Esempi di email
- "Dove è la mia consegna?"
- "Devo cambiare indirizzo di consegna"
- "Il pacco è arrivato danneggiato"
- "Ho ricevuto quantità sbagliata"
- "Posso rinviare la consegna a domani?"

#### Risposta SLA
- **Tracking/stato**: entro 1 ora
- **Modifica booking**: entro 2 ore
- **Problema logistico**: entro 30 minuti (escalation)

#### Template di risposta operativa
```
Caro [Nome],

Grazie per aver contattato. Sono [OPERATIVE_CONTACT], team logistica.

Ref. booking: [BOOKING_ID]
Status attuale: [STATUS]
ETA: [DATE/TIME]

[RISPOSTA SPECIFICA AL PROBLEMA]

Se urgente, potete contattarmi direttamente al [PHONE].
```

#### Checklist operativa
- [ ] Localizza booking nel sistema
- [ ] Verifica status con corriere (se necessario)
- [ ] Proposte soluzioni concrete (non scuse)
- [ ] Numero di tracking sempre presente
- [ ] Contatto diretto (telefono) se cliente è in ansia

---

### CLASSE 3: EMAIL AMMINISTRATIVA
**Dominio**: administrative@domain o admin@domain
**Destinatari**: Accounting, billing, administrative staff
**Urgenza**: MEDIA

#### Segnali di riconoscimento
- Richiesta di fattura
- Sollecito di pagamento ricevuto
- Domanda su documento bilancio
- Disputa su importo fatturato
- Richiesta di credito/rimborso
- Domanda su condizioni di pagamento
- Richiesta di nota di credito

#### Esempi di email
- "Potete mandarmi la fattura?"
- "Abbiamo ricevuto un sollecito di pagamento per..."
- "L'importo in fattura non corrisponde all'ordine"
- "Volevamo pagare con assegno, va bene?"
- "Potete fare una nota di credito per la merce danneggiata?"

#### Risposta SLA
- **Richiesta fattura**: entro 24 ore
- **Domanda pagamento**: entro 4 ore
- **Disputa importo**: entro 24 ore (investigazione)

#### Template di risposta amministrativa
```
Caro [Nome],

Sono [ADMIN_CONTACT], ufficio amministrativo.

Ho verificato i vostri dati:
- Booking/Ordine: [REF]
- Importo: €[AMOUNT]
- Status: [STATUS - Pagato/In sospeso/etc.]

[RISPOSTA SPECIFICA]

Se avete domande, rimango a disposizione al [PHONE].
```

#### Checklist amministrativa
- [ ] Verifica ordine esiste e corrisponde
- [ ] Controlla stato pagamento
- [ ] Allega documento richiesto (se esiste)
- [ ] Se manca documento: spiega processo
- [ ] Numeri IBAN, condizioni di pagamento sempre chiari

---

### CLASSE 4: EMAIL DI SUPPORT
**Dominio**: support@domain
**Destinatari**: Customer service, support manager, retention
**Urgenza**: ALTA

#### Segnali di riconoscimento
- Cliente ha un problema/reclamo
- Richiesta di assistenza post-consegna
- Feedback negativo
- Domanda su come usare il servizio
- Richiesta di estensione/cambio servizio
- Feedback positivo (apprezzamento)
- Segnalazione bug/problema tecnico

#### Esempi di email
- "Ho ricevuto il pacco, ma..."
- "Non so come usare il servizio"
- "Avete risolto il problema di cui avevo scritto?"
- "Siete stato fantastico, grazie!"
- "Non riesco a fare il login"

#### Risposta SLA
- **Reclamo/problema**: entro 2 ore (first contact)
- **Richiesta feedback positivo**: entro 24 ore (risposta)
- **Problema tecnico**: entro 4 ore (diagnosi)

#### Template di risposta support
```
Caro [Nome],

Sono [SUPPORT_CONTACT], customer support.

Ho visto che [SITUAZIONE]. Capisco il vostro disappunto.

[AZIONI CHE PRENDERÒ]

Vi farò sapere gli sviluppi entro [TIMELINE].

Se urgente, contattatemi al [PHONE].

Grazie della pazienza.
```

#### Checklist support
- [ ] Tono: empatico, non difensivo
- [ ] Localizza ordine/booking
- [ ] Propone soluzione concreta (non promesse vaghe)
- [ ] Stabilisce timeline chiara
- [ ] Follow-up proattivo se > 24 ore senza risoluzione

---

## Matrice di routing decisionale

```
EMAIL RICEVUTA
    ↓
[1] Cliente ha un booking confermato?
    NO → COMMERCIAL (prospect)
    SÌ → [2]
    ↓
[2] È un problema/reclamo/richiesta post-delivery?
    SÌ → SUPPORT
    NO → [3]
    ↓
[3] Riguarda logistica/tracking/consegna?
    SÌ → OPERATIVE
    NO → [4]
    ↓
[4] Riguarda fatture/pagamenti/billing?
    SÌ → ADMINISTRATIVE
    NO → [Default: OPERATIVE per booking client]
```

---

## Regole di escalation tra domini

### Se COMMERCIAL riceve richiesta operativa (es. tracking su prospect)
- Rispondi: "Perfetto, abbiamo ancora il booking in preparazione. Ecco lo status..."
- Poi gira a OPERATIVE per follow-up

### Se OPERATIVE riceve richiesta amministrativa (es. fattura da client)
- Rispondi: "Perfetto, vi metto in contatto con amministrazione che vi invierà la fattura"
- Gira a ADMINISTRATIVE, metti cliente in CC

### Se SUPPORT riceve richiesta commerciale (es. upsell)
- Non vendere da support (erode fiducia)
- Rispondi: "Ottima domanda! Vi collego con il team commerciale che vi farà una proposta"
- Gira a COMMERCIAL

---

## Gestione email ambigue

Se non è chiaro quale dominio, applica questa priorità:

1. **Se c'è pericolo operativo** (merce danneggiata, ritardo consegna, missing shipment) → OPERATIVE
2. **Se è reclamo/problema** → SUPPORT
3. **Se è finanziario/legale** → ADMINISTRATIVE
4. **Se è opportunity commerciale** → COMMERCIAL

---

## Metriche di routing

- **Accuracy**: % di email routate al dominio corretto (goal: > 95%)
- **First-response time**: tempo medio prima risposta per categoria (goal: < 4 ore)
- **Cross-routing**: quante email sono state routate male e richiedono giro (goal: < 5%)
- **Customer satisfaction**: % di clienti soddisfatti della risposta per dominio (goal: > 80%)

---

## Template di auto-risposta per ciascun dominio

### Commercial
"Grazie per averci contattato! Il team commerciale vi risponderà entro 4 ore."

### Operative
"Ci siamo! Stiamo verificando il vostro booking e vi rispondiamo urgentemente entro 1 ora."

### Administrative
"Abbiamo ricevuto. Ufficio amministrativo vi risponderà entro 24 ore."

### Support
"Siamo qui per aiutarvi! Vi contatteremo entro 2 ore per risolvere il vostro problema."
