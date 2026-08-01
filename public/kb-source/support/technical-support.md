---
title: Richieste assistenza tecnica
tags: [support, procedures, email, technical-support, troubleshooting, diagnosis]
---

# Richieste assistenza tecnica

## Obiettivo
Raccogliere informazioni complete su problemi tecnici, diagnosticare la causa e guidare il cliente verso soluzione o escalation.

## Procedura diagnostica

### Step 1: Raccolta informazioni (OBBLIGATORIA)

Quando cliente segnala problema tecnico, raccogli:

#### Informazioni essenziali
- **Descrizione**: "Cosa non funziona?" (dettagliato, non "non funziona")
- **Quando è successo**: data e ora esatta
- **Frequenza**: sempre, a volte, una volta sola?
- **Impatto**: cosa non può fare il cliente?

#### Informazioni tecniche
- **Sistema**: Windows/Mac/Linux? Quale versione?
- **Browser**: Chrome/Firefox/Safari? Quale versione?
- **Dispositivo**: Desktop/Laptop/Mobile? Quale modello?
- **Connessione**: WiFi/Ethernet/Mobile? Velocità (se possibile)?
- **Azioni fatte**: cosa ha provato il cliente? (es. "Ho riavviato", "Ho cancellato i cookie")

#### Errori visualizzati
- **Messaggio di errore esatto**: copincolla del testo
- **Screenshot**: specialmente se c'è messaggio d'errore
- **Video**: se comportamento è intermittente/complesso

### Template raccolta info

```
Caro [Nome],

Grazie per aver segnalato il problema. Per aiutarvi al meglio, ho bisogno di qualche dettaglio:

1. Qual è esattamente il problema che state riscontrando?
2. Quando è successo per la prima volta?
3. Accade sempre o solo a volte?
4. Quale dispositivo state usando? (Windows/Mac, browser, etc.)
5. Avete visto un messaggio di errore? Se sì, copincollate il testo esatto.
6. Avete già provato qualcosa? (es. riavvio, cambio browser)

Potete mandarmi anche uno screenshot se vi aiuta a spiegare meglio.

Nel frattempo vi dico se è un problema noto.

Grazie!
```

### Step 2: Diagnosi

Sulla base delle info, determina:

**È un problema noto?**
- Sì → go to Step 3a (Soluzione rapida)
- No → go to Step 3b (Troubleshooting)

**È correlato al sistema del cliente?**
- Browser cache corrotta → pulizia cache
- Versione browser obsoleta → aggiornamento
- Connessione lenta → test velocità

**È un nostro bug/problema?**
- Segni: "Accade a tutti gli utenti", "Errore di database", "Timeout"
- Azione: escalation immediata a team tecnico

### Step 3a: Soluzione rapida (problema noto)

Se è un problema noto, dai soluzione diretta:

```
Ho identificato il vostro problema. Accade quando [CONDIZIONE].

La soluzione è semplice:
1. [PASSO 1]
2. [PASSO 2]
3. [PASSO 3]

Fatemi sapere se funziona. Se no, vi aiuto ulteriormente!
```

Problemi noti comuni:
- **Cache**: "Svuotate cache e cookie del browser, riavviate"
- **Connessione**: "Cambiate da WiFi a Ethernet", "Riavviate il router"
- **Versione**: "Aggiornate il browser all'ultima versione"
- **Doppio login**: "Fate logout totale dal browser, poi login di nuovo"

### Step 3b: Troubleshooting guidato

Se non è noto, guida il cliente step-by-step:

```
Perfetto, ho registrato il problema. Proviamo insieme:

STEP 1: ISOLAMENTO
- Provate su un browser diverso (Firefox se usate Chrome, Safari se usate Firefox)
- Se funziona: è un problema di browser
- Se non funziona: continua Step 2

STEP 2: PULIZIA
- Svuotate cache e cookie: [LINK CON ISTRUZIONI]
- Riavviate il browser completamente
- Riprovateci
- Se funziona: risolto!
- Se non funziona: continua Step 3

STEP 3: RESET
- Fate logout completamente
- Aspettate 30 secondi
- Login da nuovo
- Se funziona: risolto!
- Se non funziona: continua Step 4

STEP 4: ESCALATION
Se ancora non funziona, il problema potrebbe essere dal nostro lato. Vi faccio parlar con il team tecnico.
```

### Step 4: Escalation tecnica (se necessario)

Se il cliente ha provato tutto:
- Crea ticket con team tecnico
- Includi tutte le info raccolte
- Dagli una ETA ("Vi farò sapere entro 24 ore")
- Rimani il punto di contatto del cliente

Template:

```
Caro [Nome],

Ho provato varie soluzioni ma il problema persiste. Lo segnalo al nostro team tecnico.

Ticket assegnato: [TICKET_ID]
Team tecnico vi contatterà entro [HOURS] ore per investigare ulteriormente.

Nel frattempo rimango a vostra disposizione se ricordati altre info.

Grazie della pazienza!
```

## Soluzioni comuni rapide

| Problema | Soluzione |
|----------|-----------|
| "Pagina non carica" | Svuotate cache, cambiate browser, verificate connessione |
| "Timeout/lentezza" | Verificate velocità internet, provate orario diverso (server potrebbe essere sovraccarionico) |
| "Login non funziona" | Verificate CAPS LOCK, reset password, prova incognito/anonimo |
| "Download fallito" | Riavviate download, verificate spazio disco, prova browser diverso |
| "Errore di sincronizzazione" | Logout totale + login, svuota cache, riavvia device |

## Quando dire "Non è supportato"

Se cliente chiede assistenza per:
- Software/tool di terze parti (non nostri)
- Problema del suo sistema/network
- Personalizzazione che va oltre scope

Risposta:

```
Caro [Nome],

Il vostro problema sembra legato a [CAUSA ESTERNA], che non è direttamente nel nostro scope di supporto.

Vi consiglio di contattare [TEAM APPROPRIATO], che potrà aiutarvi meglio.

Rimango qui se il problema è dal nostro lato e preferite che vi supporti io.
```

## Documentazione

Dopo ogni caso tecnico:
- Crea knowledge base article se è ripetibile
- Classifica: Bug / Feature Request / User Error / External Issue
- Se bug confermato: comunica timeline fix al cliente
