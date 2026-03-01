/**
 * Sales Knowledge Base — Guida per la generazione di email B2B
 * nel settore freight forwarding / logistica internazionale.
 *
 * 10 sezioni operative focalizzate su email outbound.
 */

export const DEFAULT_SALES_KNOWLEDGE_BASE = `
# SALES KNOWLEDGE BASE — Guida per Email B2B nel Freight Forwarding

---

## 1. PRINCIPI FONDAMENTALI DI VENDITA B2B

1. **Costruisci relazione, non vendere**: Il primo contatto non è mai una vendita. È un invito a conoscersi. Non proporre tariffe, proponi valore.
2. **Il cliente compra fiducia, non prezzo**: Nel freight forwarding la merce vale milioni. Il partner vuole sapere che sei affidabile, reattivo e competente. Dimostralo con fatti, non promesse.
3. **Personalizza sempre**: Un'email generica finisce nel cestino. Cita il nome, la città, il network condiviso, un servizio specifico. Ogni email deve sembrare scritta a mano.
4. **Ascolta prima di parlare**: Se hai dati sul partner (profilo, servizi, zone), usali per mostrare che hai studiato la loro azienda. Non parlare di te — parla di come puoi aiutare loro.
5. **Monitoraggio proattivo**: Non aspettare che il cliente ti cerchi. Comunica aggiornamenti prima che te li chiedano. Questa è la differenza tra un forwarder e un partner.

---

## 2. STRUTTURA EMAIL EFFICACE

### La regola delle 5 righe (primo contatto)
Un'email di primo contatto deve essere leggibile in 30 secondi:
- **Riga 1**: Hook — perché gli stai scrivendo (network condiviso, riferimento, dato di mercato)
- **Riga 2-3**: Value proposition — cosa fai e perché è rilevante per LUI
- **Riga 4**: Social proof — una metrica, un cliente, una certificazione
- **Riga 5**: CTA — un'azione sola, semplice, a basso impegno

### Struttura dettagliata
1. **Saluto**: Breve, personale. "Dear [Nome]," — mai "Dear Sir/Madam"
2. **Hook di apertura** (1 frase): Collega te al destinatario
3. **Contesto** (1-2 frasi): Chi sei, cosa fai, perché è rilevante
4. **Valore specifico** (2-3 frasi): Cosa puoi fare per lui concretamente
5. **Prova** (1 frase): Dato, certificazione, volume, referenza
6. **CTA** (1 frase): Proposta chiara e a basso impegno
7. **Chiusura**: Cordiale, professionale

### Lunghezza
- Primo contatto: 80-120 parole (mai oltre 150)
- Follow-up: 50-80 parole
- Proposta dettagliata: max 200 parole con bullet points

---

## 3. TECNICHE DI APERTURA (HOOK)

Ogni email deve iniziare con un motivo per cui il destinatario dovrebbe continuare a leggere:

### Hook per network condiviso
- "As fellow [WCA/FIATA] members, I wanted to reach out..."
- "I noticed we're both part of [network] and I believe we could complement each other on [rotta/servizio]..."
- "Our shared [network] membership made me look into your company..."

### Hook per riferimento geografico
- "We're expanding our [air/ocean] coverage in [country/region] and your company stood out..."
- "Looking at the growing trade lane between [paese A] and [paese B], I see a natural fit..."

### Hook per complimento specifico
- "I was impressed by your [certificazione/servizio/presenza in X paesi]..."
- "Your expertise in [dangerous goods/project cargo/perishables] caught my attention..."

### Hook per dato di mercato
- "With [trade lane] volumes up X% this year, having a reliable partner in [country] is critical..."
- "The [e-commerce/pharma/automotive] sector in [region] is growing fast..."

### REGOLA: Mai iniziare con "I am writing to..." o "Let me introduce myself". Inizia sempre dal destinatario o dal contesto condiviso.

---

## 4. COME USARE I DATI DEL PARTNER

Quando generi un'email, hai accesso a questi dati dal database. Usali TUTTI quelli disponibili per personalizzare:

### Campi disponibili e come usarli

| Campo | Come usarlo nell'email |
|-------|----------------------|
| **company_name** | Sempre nel saluto e nel corpo. Mai generico. |
| **contact name** | Usalo nel "Dear [Nome]". Se assente, usa "Dear [company_name] Team". |
| **contact title/role** | Adatta il tono (CEO → strategico, Ops Manager → pratico). |
| **country_name / city** | Riferimento geografico nell'hook. Menziona trade lane rilevanti. |
| **network_name** | Hook primario: "As fellow [network] members..." |
| **services** | Collega i TUOI servizi ai LORO. Se fanno air freight, proponi la tua copertura air. |
| **rating** | Se alto (4-5), menziona la loro reputazione. Se basso o assente, non citarlo. |
| **profile_description** | Estrai parole chiave per personalizzare la value proposition. |
| **enrichment_data** | Se presente, usa dati dal sito web per dimostrare che hai studiato l'azienda. |
| **member_since** | Se di lunga data, valorizza la loro esperienza nel network. |
| **website** | Se hai dati dal sito, cita qualcosa di specifico che hai notato. |

### Regole di personalizzazione
1. **Usa almeno 3 campi** in ogni email per renderla unica
2. **Mai inventare dati** — se un campo è vuoto, omettilo
3. **Collega i dati alla tua proposta** — non elencarli, integrali nel discorso
4. **Priorità**: network condiviso > paese/città > servizi > rating > profilo

### Esempio di integrazione dati
Se hai: company_name="Global Express Ltd", country="Germany", network="WCA", services=["air_freight","ocean_fcl"], rating=4.5

→ "As fellow WCA members, I was pleased to see Global Express Ltd's strong reputation in Germany. With your expertise in air and ocean freight, I believe there's a natural synergy with our [servizio] capabilities on the Italy–Germany corridor."

---

## 5. PROTOCOLLO DI VENDITA IN 5 FASI (adattato per email)

### Fase 1 — CONNESSIONE (Email 1)
- Obiettivo: Aprire il dialogo
- Tono: Cordiale, curioso, non invasivo
- Contenuto: Hook + breve presentazione + CTA leggera (call/meeting)
- NON includere: Tariffe, listini, proposte dettagliate

### Fase 2 — SCOPERTA (Email 2, dopo risposta o follow-up)
- Obiettivo: Capire i bisogni del partner
- Tono: Consulenziale, interessato
- Contenuto: Domande mirate sulle loro esigenze (rotte, volumi, problemi attuali)
- Includere: Riferimento alla prima email, un dato personalizzato in più

### Fase 3 — PROPOSTA (Email 3)
- Obiettivo: Presentare valore specifico
- Tono: Professionale, concreto
- Contenuto: Proposta su misura basata sulle info raccolte
- Includere: Bullet points con servizi rilevanti, una metrica, un differenziatore

### Fase 4 — GESTIONE OBIEZIONI (Email 4, se necessario)
- Obiettivo: Superare resistenze
- Tono: Empatico, rassicurante
- Contenuto: Risposta all'obiezione specifica + social proof
- Includere: Caso studio breve o referenza

### Fase 5 — CHIUSURA (Email 5)
- Obiettivo: Ottenere commitment
- Tono: Diretto, propositivo
- Contenuto: Riepilogo valore + CTA concreta (invio prova, call operativa, quotazione)
- NON: Pressione eccessiva, urgenza artificiale

---

## 6. ADATTAMENTO DEL TONO

### Per ruolo del destinatario

**CEO / Owner / Managing Director**
- Tono: Formale ma non rigido
- Focus: Partnership strategica, crescita, visione
- Evitare: Dettagli operativi, tecnicismi
- CTA: "Exploring a strategic partnership", "brief introductory call"

**Operations Manager / Logistics Manager**
- Tono: Pratico, diretto
- Focus: Efficienza, affidabilità, problem solving
- Includere: Dati operativi, transit time, copertura
- CTA: "Discussing specific routes", "sharing our service capabilities"

**Sales / Business Development**
- Tono: Dinamico, reciproco
- Focus: Vantaggi reciproci, volumi, opportunità condivise
- Includere: Potenziale di scambio bidirezionale
- CTA: "Exchange of rate cards", "mutual business opportunities"

### Per area geografica

**Far East (Cina, Giappone, Corea, Sud-est asiatico)**
- Più formale, rispettoso della gerarchia
- Menzionare longevità e stabilità dell'azienda
- Evitare tono troppo diretto o informale al primo contatto

**Middle East & India**
- Valorizzare la relazione personale
- Menzionare referenze nella regione
- Tono rispettoso, non aggressivo

**Europa**
- Tono diretto e professionale
- Focus su efficienza e qualità del servizio
- Meno formalità, più concretezza

**Americas (USA, LATAM)**
- USA: Diretto, orientato ai risultati, breve
- LATAM: Più caloroso, importanza della relazione

**Africa**
- Tono rispettoso e professionale
- Menzionare esperienza nella regione
- Sensibilità alle sfide logistiche locali

---

## 7. TECNICHE DI PERSUASIONE B2B

### Social Proof
- "Gestiamo oltre [X] spedizioni al mese da/per [paese]"
- "Siamo membri [network] dal [anno], con rating [X]/5"
- "I nostri partner in [regione] includono aziende come..."

### Reciprocità
- "Saremo felici di condividere la nostra analisi sulle rotte [zona] senza impegno"
- "Posso inviarti il nostro profilo servizi completo per valutazione"

### Urgenza appropriata (mai artificiale)
- "Con la peak season in arrivo, è il momento giusto per allinearci"
- "I nuovi regolamenti [IMO/doganali] in vigore da [data] rendono importante avere un partner preparato"

---

## 8. PATTERN DI FOLLOW-UP

### Timing ottimale
- Follow-up 1: 3-5 giorni lavorativi dopo la prima email
- Follow-up 2: 7-10 giorni dopo il primo follow-up
- Follow-up 3 (finale): 14 giorni dopo — cambio angolo o chiusura

### Regole di follow-up
1. MAI ripetere la stessa email — ogni follow-up aggiunge valore nuovo
2. Cambia angolo ad ogni tentativo (nuovo servizio, nuovo dato, nuova rotta)
3. Mantieni brevità (50-80 parole)
4. Non usare tono accusatorio ("Non ho ricevuto risposta")
5. Usa tono consultivo ("Volevo aggiungere un'informazione che potrebbe essere utile")

### Esempio di escalation
- Email 1: Presentazione + network condiviso
- Follow-up 1: Dato di mercato rilevante per il loro paese
- Follow-up 2: Case study o referenza specifica
- Follow-up 3: Proposta diretta e bassa pressione ("Se preferisci che non ti contatti più, nessun problema")

---

## 9. OGGETTO EMAIL, CTA, FRASI DI FIDUCIA E ERRORI

### Oggetto email — Pattern efficaci
- Max 6-8 parole, mai tutto maiuscolo, mai punti esclamativi
- Includere un elemento specifico (nome, network, paese, servizio)
- **Buoni**: "[Network] member — [servizio] in [paese]", "Air freight from [A] to [B]?", "Quick question about [rotta]"
- **Da evitare**: "Partnership opportunity", "Introduction of our company", "URGENT: [qualsiasi cosa]"

### Call-to-action
- UNA sola CTA per email, specifica e a basso impegno
- **Buone**: "Would you be open to a 15-minute call next week?", "Can I send you our service profile?"
- **Da evitare**: "Let me know if you're interested", "Feel free to contact me"

### Frasi che costruiscono fiducia
- "We treat every shipment as if it were our own"
- "Our approach is simple: communicate before you need to ask"
- "Reliability is not just our promise — it's our daily practice"
- "We believe the best partnerships are built on transparency and consistent results"

### Chiusure efficaci
- "I look forward to exploring how we can support each other"
- "Thank you for your time — I'm confident we can add value to your operations"

### Errori da evitare
1. **Genericità**: "We are a leading logistics company" → Tutti lo dicono. Sii specifico.
2. **Email troppo lunghe**: Max 150 parole al primo contatto.
3. **Promesse vaghe**: "Best service" / "Competitive rates" → Dati concreti.
4. **Focus su di te**: Il 70% dell'email deve parlare del destinatario.
5. **Tono supplicante**: "I would really appreciate if you could..." → Sii propositivo.
6. **Multiple CTA**: Una sola azione per email.
7. **Nessuna personalizzazione**: Se l'email potrebbe essere inviata a chiunque, è sbagliata.
8. **Follow-up identici**: Ogni messaggio deve aggiungere qualcosa di nuovo.
9. **Allegati al primo contatto**: Mai. Red flag per filtri spam.

---

## 10. EMAIL MODELLO COMPLETE

### Modello 1 — Primo contatto (~100 parole)

**Subject**: WCA member — ocean freight partnership, Italy–[Country]

Dear [Contact Name],

As fellow WCA members, I came across [Company Name] and was impressed by your [services/reputation/presence in city].

We are [Your Company], based in [Your City], Italy, specializing in [your key services] with strong coverage across the Mediterranean and Europe. I believe there's a natural synergy between our operations, particularly on the [Country]–Italy trade lane.

We currently handle [X] shipments monthly on this corridor with [transit time/differentiator].

Would you be open to a brief call next week to explore how we could support each other?

Best regards,
[Signature]

---

### Modello 2 — Follow-up (~70 parole)

**Subject**: Re: WCA member — a quick update on [trade lane]

Dear [Contact Name],

Following up on my previous message — I wanted to share that we've recently expanded our [service] capacity on the [A]–[B] route, with [specific improvement: weekly departures / faster transit / new warehouse].

This could be relevant for [Company Name]'s operations in [region]. Happy to share details if useful.

Best regards,
[Signature]

---

### Modello 3 — Proposta operativa (~150 parole)

**Subject**: [Company Name] + [Your Company] — service overview

Dear [Contact Name],

Thank you for your interest in exploring a partnership. Based on our conversation, here's a summary of how we can support [Company Name]:

**Our capabilities on the [Country]–Italy corridor:**
- **Ocean FCL**: Weekly departures from [port], transit [X] days, door-to-door
- **Air freight**: Daily connections via [hub], 48h transit for urgent cargo
- **Customs clearance**: In-house team, same-day release for standard goods
- **Warehousing**: [X] sqm facility in [city] for distribution and cross-docking

**What sets us apart:**
- Proactive tracking with updates before you ask
- Dedicated point of contact for your account
- [Network] member since [year], rating [X]/5

I'd suggest we start with a trial shipment to demonstrate our service level. Shall I prepare a spot rate for a specific route?

Best regards,
[Signature]
`;
