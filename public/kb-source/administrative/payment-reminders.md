---
title: Solleciti pagamento ricevuti
tags: [administrative, procedures, email, payment-reminders, collections, follow-up]
---

# Solleciti pagamento ricevuti

## Obiettivo
Rispondere a richieste di pagamento con tono appropriato, verificare lo stato e risolvere proattivamente.

## Procedura verifica stato pagamento

### Step 1: Localizzare la fattura
Il cliente riceve sollecito per:
- Numero fattura (es. INV-2026-0001)
- Importo
- Data scadenza

Verifica nei sistemi:
- Fattura esiste e corrisponde
- Stato: Pagata / Non pagata / Parzialmente pagata

### Step 2: Azioni in base allo stato

#### Se fattura PAGATA
"Verifico subito. Nel nostro sistema risulta pagata il [DATE] con riferimento [PAGAMENTO]. Potrebbe essere una questione di sincronizzazione. Vi invio lo screenshot del nostro estratto conto per chiarire."

#### Se fattura NON PAGATA
"Confermo che risulta in sospeso. Vi faccio un riepilogo e vediamo come procedere."

#### Se pagamento parziale
"Risulta versato il 50% (€X) il [DATE]. Vi devo ancora €Y. Possiamo accordarci per il saldo?"

### Step 3: Comunicazione appropriata

**Tono**: Professionale, cordiale, NON aggressivo
- Evita: "Vi avevamo detto di pagare..."
- Usa: "Vediamo come risolvere questa questione insieme"

## Template risposta

### Scenario 1: Fattura in sospeso da < 5 giorni
```
Caro [Nome],

Ho visto la notifica di sollecito. Effettivamente la fattura [INV_NUM] (€[AMOUNT]) è scaduta il [DUE_DATE].

Potete procedere al pagamento sul conto:
IBAN: [IBAN]
Causale: Fattura [INV_NUM]

Se avete domande sull'importo, sono qui. Grazie!
```

### Scenario 2: Fattura in sospeso da > 15 giorni
```
Caro [Nome],

Purtroppo il nostro sistema mostra la fattura [INV_NUM] (€[AMOUNT]) ancora in sospeso da [DAYS] giorni.

Voglio risolvere questa situazione. Potete dirmi:
1. Se il pagamento è già stato inviato? (vi servo il numero di tracciamento)
2. Se c'è un problema con l'importo?
3. Se preferite rateizzare?

Rimango disponibile al [PHONE] o via email per chiarire subito.

Grazie della collaborazione.
```

### Scenario 3: Pagamento ricevuto ma non riconciliato
```
Caro [Nome],

Buone notizie! Ho trovato il vostro pagamento di €[AMOUNT] ricevuto il [DATE]. Stava semplicemente in processo di riconciliazione.

La fattura [INV_NUM] è ora marcata come pagata. Mi scuso per il sollecito prematuro.

Grazie mille!
```

## Gestione situazioni critiche

### Cliente dice "Ho pagato ma non ricevete"
Azioni:
1. Chiedi numero di tracciamento bonifico
2. Verifica nel conto bancario
3. Se pagamento è effettivamente arrivato: evidenzia quando reconciliato
4. Se non arrivato: rivedi il numero IBAN (potrebbe essere sbagliato)

### Cliente dice "Non ho soldi adesso"
Opzioni da offrire:
- Rateizzazione: "Possiamo dividerlo in 2 rate? Prima metà ora, seconda fra 15 giorni?"
- Estensione termine: "Posso estendervi il termine a [DATA]?"
- Sconto se anticipato: "Se pagate entro 3 giorni, applico uno sconto del 2%?"

### Cliente contesta l'importo
- Sospendi sollecito
- Apri conversazione sulla discrepanza (vedi KB "Gestione richieste fattura")
- Riprendi sollecito solo se fattura è stata confermata corretta

## Escalation

**Se sollecito è arrivato da terzo (agente di riscossione)**:
- Contatta cliente per telefono immediatamente
- Spiega che sei in grado di risolvere direttamente
- Proponi opzioni di pagamento flessibili
- Comunica al tuo fornitore di servizi di riscossione lo status

**Se pagamento è più di 30 giorni in ritardo**:
- Documenta tutte le comunicazioni
- Considera interessamento legale
- Contatta responsabile account del cliente direttamente (non solo email)

## Nota sulla riservatezza
Quando ricevi sollecito da terzo, non divulgare dettagli del cliente a nessun altro.
