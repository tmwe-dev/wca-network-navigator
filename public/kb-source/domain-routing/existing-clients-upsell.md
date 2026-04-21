---
title: Gestione clienti convertiti (upsell)
tags: [domain_routing, procedures, email, upsell, cross-sell, retention, existing-customers]
---

# Gestione clienti convertiti (upsell)

## Obiettivo
Gestire email commerciali provenienti da clienti già convertiti, riconoscendoli e applicando strategie di upsell/cross-sell appropriate.

## Riconoscimento del cliente convertito

Un client email va a **COMMERCIAL (con tag "EXISTING CLIENT")** se:

### Criteri di identificazione
1. **Email proviene da dominio clienti** (stesso dominio dell'ordine originale)
2. **Cliente ha almeno 1 booking completato** (pagato o consegnato)
3. **Email contiene richiesta commerciale** (preventivo nuovo servizio, domanda su espansione, etc.)

### Verifica nel sistema
```
if (customer_email IN (customers_with_completed_booking)) {
  customer_type = "EXISTING_CLIENT"
  route_to = "commercial"
  tag = "UPSELL_OPPORTUNITY"
}
```

---

## Strategie per client vs prospect

### PROSPECT NUOVO
- Vendi VALUE: "Ecco perché dovete sceglierci"
- Vendi FIDUCIA: "Ecco cos'hanno ottenuto altri"
- Vendi CONVENIENZA: "Ecco quanto vi conviene"

**Tone**: Persuasivo, consultivo, cautamente fiducioso

### CLIENT ESISTENTE
- Rafforza PARTNERSHIP: "Continuiamo a crescere insieme"
- Vendi ESPANSIONE: "Come possiamo scalare il vostro volume?"
- Vendi ECONOMIA: "Se consolidate, abbiamo sconti"

**Tone**: Familiare, consulenziale, assume trust già costruito

---

## Tipi di opportunità upsell/cross-sell

### UPSELL (upgrade dello stesso servizio)
Esempio: cliente che ordina 500 pezzi/mese chiede di salire a 1000

**Approccio**:
```
Caro [Nome],

Perfetto! Se consolidate su 1000 pezzi/mese, posso offrirvi:
- Sconto volumi: -15% vs. tariffa attuale
- Priorità consegna: garantito entro 24h
- Account manager dedicato

Convenienza stimata: €[RISPARMIO]/anno.

Interessato?
```

### CROSS-SELL (nuovo servizio/prodotto complementare)
Esempio: cliente che usa logistica chiede se fate anche warehousing

**Approccio**:
```
Caro [Nome],

Ottima domanda! Oltre a logistica offriamo anche:
- Warehousing (stoccaggio fino 10.000 pallets)
- Reverse logistics (resi e rottami)
- Customs clearance (per import/export)

Facciamo una call per capire se una di queste vi serve?
```

### RETENTION (servizio aggiuntivo per cliente a rischio)
Esempio: cliente non ha ordinato in 3 mesi, comunica per ridimensionamento

**Approccio**:
```
Caro [Nome],

So che state ridimensionando momentaneamente. Resto a disposizione quando vi serve riprendere.

Nel frattempo, posso aiutarvi con:
- Ottimizzazione magazzino (non spendete in storage inutile)
- Consolidamento ordini (ordinate meno frequentemente, più grande)

Parliamone?
```

---

## Template di risposta a richiesta commerciale da existing client

### Scenario 1: Richiesta di preventivo per nuovo servizio

```
Caro [Nome],

Bellissimo sentire da voi! Sono [COMMERCIAL_CONTACT], e da quando abbiamo iniziato a lavorare insieme nel [MONTH] ho apprezzato moltissimo la vostra collaborazione.

VOSTRA RICHIESTA:
[RECAP DI QUELLO CHE CHIEDETE]

COME POSSIAMO AIUTARVI:
Abbiamo diverse opzioni:
1. [OPZIONE 1] - Consigliata per voi perché [MOTIVO]
2. [OPZIONE 2] - Se preferite [CONDIZIONE]
3. [OPZIONE 3] - Alternativa risparmiosa

VALORE AGGIUNTO (vs competitor):
- [DIFFERENZIALE 1]
- [DIFFERENZIALE 2]
- [DIFFERENZIALE 3]

SCONTO PER CLIENTI FEDELI:
Dato che lavoriamo bene insieme, offrirvi uno sconto del 10% su questo nuovo servizio.

PROSSIMO STEP:
Possiamo fare una call domani alle [ORA] per approfondire? Mi piacerebbe capire i vostri volumi e tempi.

Vi contatto domani mattina se non sentite da voi.

Cordiali saluti,
[NAME]
```

### Scenario 2: Rinnovo/estensione servizio

```
Caro [Nome],

Come state? Vi scrivo perché il vostro contratto [SERVIZIO] scade il [DATE].

RIEPILOGO ATTUALE:
- Servizio: [TIPO]
- Volumi medi: [VOLUME]/mese
- Importo annuale: €[AMOUNT]
- Performance: [METRICA] (on-time delivery, quality score, etc.)

PROPOSTE PER IL RINNOVO:
Dato il vostro crescente volume, posso offrirvi:
1. **Rinnovo standard**: Stesse condizioni, valido altri 12 mesi
2. **Upgrade smart**: Aggiungete [SERVIZIO] a costo ridotto (risparmio netto €X/anno)
3. **Piano premium**: Accesso prioritario, support 24/7, account manager dedicato

Le tariffe sono le stesse di quest'anno, senza aumenti.

VALIDITÀ OFFERTA:
Questi prezzi valgono se confermato entro [DATE]. Dopo, dovrò aggiornare per inflazione.

NEXT STEP:
Vi mando il nuovo contratto questo pomeriggio. Leggetelo con calma e parliamone lunedì.

Nel frattempo, se avete dubbi, sono qui!

Cordiali saluti,
[NAME]
```

### Scenario 3: Cliente in difficoltà temporanea

```
Caro [Nome],

So dal tracking che le vostre consegne sono calate negli ultimi mesi. Va tutto bene?

Mi piacerebbe capire se:
- Il mercato è in pausa? (normale, capita)
- Avete trovato alternative? (sono tutto orecchi, vogliamo continuare ad aiutarvi)
- C'è un problema con noi? (raccontatemi e lo risolviamo)

SE VOLETE SCALARE INDIETRO:
Capiamo benissimo. Offriamo flessibilità senza penali se comunicate in anticipo.

SE VOLETE RIPRENDERE IN FUTURO:
Vi terrò riservate le capacità di prima e i vostri prezzi rimangono gli stessi.

SE VOLETE INNOVARE:
Magari potete esplorare servizi nuovi o formati diversi che vi costano meno?

Mi piacerebbe una call veloce. Rimango a disposizione lunedì o martedì mattina.

A presto,
[NAME]
```

---

## Elementi chiave nella comunicazione commercial a existing client

### ✓ SEMPRE INCLUDI
- Recap della relazione (quando abbiamo iniziato)
- Gratitudine per la partnership
- Riconoscimento della loro performance/loyalty
- Cifre concrete (volumi, risparmi, metriche)
- Opzioni multiple (non una sola proposta)
- Timing e next step chiarissimi

### ✗ MAI FARE
- Non iniziare con "Abbiamo una promozione"
- Non offri stesso prezzo a tutti (personalizza per loyalty)
- Non ignorare la loro storia con noi
- Non usare tono "telemarketer"
- Non vendere senza consultare le loro esigenze

---

## Strategia per cliente che chiede sconto

Se cliente existing dice "Il competitor mi offre a meno":

```
Caro [Nome],

Capisco che guardate altre opzioni. È giusto verificare il mercato.

Prima di decidere, voglio che considerate:

DIFFERENZIALI NOSTRI vs COMPETITOR:
1. Abbiamo il vostro storico (sappiamo come servite meglio)
2. Performance: [METRICA] vs industry [INDUSTRY_AVERAGE]
3. Supporto: vi conoscete il driver, il vostro account manager, il nostro ops team
4. Flessibilità: vi ricordare quando vi salvammo con consegna d'emergenza?

COSA POSSO FARE:
Se il prezzo è la barriera, parliamo di come strutturare meglio il vostro ordine:
- Consolidamento mensile (vs settimanale) = [RISPARMIO]%
- Volume commitment (vi assicurate prezzo) = [RISPARMIO]%
- Servizi ottimizzati (eliminate quello che non serve) = [RISPARMIO]%

Insieme potremmo risparmiare [TOTAL_SAVINGS]% vs attuale, restando con noi.

Mi date 30 minuti venerdì per parlarci? Portiamo tutto sulla tavola.

Se comunque decidete di andare, vi farò un passaggio ordinato (non lo facciamo a nessuno).

Sto in attesa.
[NAME]
```

---

## Metriche di upsell

- **Repeat order rate**: % di clienti che fanno almeno 2 ordini (goal: > 50%)
- **Average order growth**: incremento medio per cliente anno su anno (goal: > 10%)
- **Upsell conversion**: % di clienti che accettano upgrade (goal: > 20%)
- **Customer lifetime value**: totale revenue per cliente nel tempo (goal: > €10k)
- **Churn rate**: % di clienti che smettono di ordinare (goal: < 5%/anno)
