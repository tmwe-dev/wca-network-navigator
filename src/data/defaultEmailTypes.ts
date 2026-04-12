export interface EmailType {
  id: string;
  name: string;
  icon: string;
  category: string;
  prompt: string;
  tone: string;
  /** KB categories to prioritize for this email type */
  kb_categories?: string[];
  /** Tactical structure instructions */
  structure?: string;
}

export const DEFAULT_EMAIL_TYPES: EmailType[] = [
  {
    id: "primo_contatto",
    name: "Primo contatto",
    icon: "Handshake",
    category: "primo_contatto",
    tone: "professionale",
    kb_categories: ["identita", "vendita", "email_modelli"],
    prompt: `Obiettivo: Aprire un dialogo con un partner mai contattato. Non vendere — creare curiosità e ottenere una risposta.

STRUTTURA OBBLIGATORIA:
1. HOOK (riga 1): Collega il tuo messaggio a qualcosa di specifico del destinatario (network condiviso, paese, servizio). MAI aprire con "Mi chiamo..." o "La nostra azienda...". Usa la tecnica "Label" di Chris Voss: "Sembra che la vostra azienda sia molto attiva su..."
2. PONTE (2-3 righe): Spiega brevemente PERCHÉ scrivi e cosa avete in comune. Cita un network condiviso se esiste.
3. VALUE PROPOSITION (2-3 righe): UNA sola proposta di valore concreta e misurabile. Non elencare tutti i servizi.
4. CALL-TO-ACTION (1 riga): Domanda aperta calibrata — MAI "Sei interessato?" (chiusa). Usa: "Quale sarebbe il modo migliore per esplorare...?" o "Che ne pensate di un breve call di 15 minuti?"

VINCOLI:
- Massimo 8-10 righe totali (escluso saluto/chiusura)
- Una sola CTA, mai due
- Non menzionare MAI prezzi o tariffe nel primo contatto
- Usa la tecnica dell'"accusation audit" se appropriato: anticipa obiezioni ("So che ricevete molte email come questa...")`,
    structure: "hook → ponte → value → CTA",
  },
  {
    id: "follow_up",
    name: "Follow-up",
    icon: "RefreshCw",
    category: "follow_up",
    tone: "professionale",
    kb_categories: ["vendita", "negoziazione", "email_modelli"],
    prompt: `Obiettivo: Riattivare un partner che non ha risposto o che ha mostrato interesse senza concretizzare. Ottenere una risposta, anche negativa.

STRUTTURA OBBLIGATORIA:
1. CONTESTO (1 riga): Richiama brevemente il contatto precedente SENZA ripetere il contenuto. "Riprendo il filo della nostra conversazione di [data]..."
2. NUOVO VALORE (2-3 righe): Porta qualcosa di NUOVO — un dato di mercato, una novità del tuo servizio, un caso simile. MAI ripetere la stessa proposta.
3. TECNICA DEL "NO" STRATEGICO (Chris Voss): Usa una domanda che permette al destinatario di dire "no" senza chiudere la porta: "Ha rinunciato all'idea di espandere la vostra rete su [paese]?" — questo provoca una risposta correttiva.
4. CTA SOFT: Proponi un'azione minima ("Anche solo due righe di feedback sarebbero preziose").

VINCOLI:
- Massimo 6-8 righe (i follow-up devono essere PIÙ CORTI del primo contatto)
- CONTROLLA la storia interazioni: se ci sono email precedenti, NON ripetere lo stesso approccio
- Se è il 3° follow-up senza risposta, usa la tecnica "last attempt": "È l'ultima volta che scrivo su questo tema..."
- Tono leggermente più diretto del primo contatto`,
    structure: "contesto → nuovo valore → domanda strategica → CTA soft",
  },
  {
    id: "richiesta_info",
    name: "Richiesta info",
    icon: "ClipboardList",
    category: "richiesta",
    tone: "professionale",
    kb_categories: ["identita", "vendita"],
    prompt: `Obiettivo: Raccogliere informazioni operative sul partner (servizi, rotte, certificazioni, volumi) per qualificarlo come fornitore.

STRUTTURA OBBLIGATORIA:
1. CONTESTUALIZZAZIONE (2 righe): Spiega perché stai cercando un partner per quella specifica area/servizio. Mostra che hai già valutato il loro profilo.
2. DOMANDE SPECIFICHE (3-5 bullet points): Fai domande precise e facili da rispondere. MAI domande vaghe come "Parlami dei vostri servizi". Esempi:
   - "Coprite servizi door-to-door per import aereo su [paese]?"
   - "Qual è il vostro transit time medio per groupage marittimo da [porto]?"
   - "Avete certificazioni per merci pericolose (ADR/IATA DGR)?"
3. RECIPROCITÀ (1-2 righe): Offri qualcosa in cambio — un profilo della tua azienda, le tue rotte principali, o un accordo di reciprocità.
4. CTA PRATICA: Proponi il formato di risposta ("Anche un breve elenco puntato sarebbe perfetto").

VINCOLI:
- Massimo 3-5 domande per email (non sovraccaricare)
- Le domande devono essere rispondibili in 5 minuti
- Usa la tecnica del "mirroring": ripeti una parola chiave dal profilo del destinatario`,
    structure: "contesto → domande specifiche → reciprocità → CTA",
  },
  {
    id: "proposta",
    name: "Proposta servizi",
    icon: "Briefcase",
    category: "proposta_servizi",
    tone: "professionale",
    kb_categories: ["identita", "vendita", "negoziazione", "email_modelli"],
    prompt: `Obiettivo: Presentare una proposta di servizio concreta e convincente che porti a una trattativa.

STRUTTURA OBBLIGATORIA:
1. HOOK PERSONALIZZATO (1-2 righe): Collega la proposta a un bisogno specifico del destinatario (usa dati dal profilo, dalla deep search, dai servizi).
2. PROPOSTA CORE (3-4 righe): Descrivi l'offerta con benefici concreti. Usa numeri quando possibile (transit time, copertura paesi, frequenza consolidamenti). Applica la tecnica "Anchor High" della negoziazione: presenta il valore prima del dettaglio operativo.
3. DIFFERENZIATORE (1-2 righe): Cosa ti rende diverso? Network dedicato, sistema booking real-time, copertura esclusiva? UNO solo, quello più rilevante per il destinatario.
4. URGENZA SOFT (1 riga): Crea un senso di opportunità senza pressione: "Stiamo finalizzando i partner per [area] entro [mese]" — mai "offerta limitata" o "solo per oggi".
5. CTA CHIARA: "Possiamo organizzare una call di 20 minuti per approfondire i dettagli operativi?"

VINCOLI:
- Massimo 12-15 righe
- MAI elencare TUTTI i servizi — focalizza su 1-2 rilevanti per il destinatario
- I numeri battono sempre le parole generiche: "12 paesi coperti" > "ampia copertura"
- Usa la base_proposal come fondamento ma adattala al destinatario specifico`,
    structure: "hook → proposta → differenziatore → urgenza → CTA",
  },
  {
    id: "partnership",
    name: "Partnership",
    icon: "Globe",
    category: "partnership",
    tone: "professionale",
    kb_categories: ["identita", "vendita", "negoziazione", "email_modelli"],
    prompt: `Obiettivo: Proporre una partnership strutturata per costruire un network operativo nel paese del destinatario.

STRUTTURA OBBLIGATORIA:
1. VISIONE (2 righe): Presenta il progetto di network in modo ambizioso ma concreto. "Stiamo costruendo un network di partner selezionati per [servizio] con copertura su [N] paesi..."
2. RUOLO DEL PARTNER (2-3 righe): Spiega ESATTAMENTE cosa ti aspetti dal partner e cosa offri in cambio. Bidirezionalità è la chiave: volumi in entrambe le direzioni.
3. VANTAGGI TANGIBILI (3-4 bullet points): Elenca benefici misurabili:
   - Sistema di booking real-time
   - Volumi garantiti da [N] paesi del network
   - Tariffe preferenziali e priority handling
   - Visibilità nel nostro portale partner
4. PROSSIMI PASSI (2 righe): Proponi un percorso chiaro: "Fase 1: Call conoscitiva → Fase 2: Test con 5 spedizioni → Fase 3: Accordo annuale"

VINCOLI:
- Tono da "pari a pari" — NON da fornitore a cliente
- Enfatizza la reciprocità: cosa CI GUADAGNA il partner
- Usa la tecnica del "Loss Aversion": fai percepire cosa perderebbe il partner non partecipando
- Massimo 15 righe`,
    structure: "visione → ruolo partner → vantaggi → prossimi passi",
  },
  {
    id: "network_espresso",
    name: "Network espresso",
    icon: "Plane",
    category: "partnership",
    tone: "professionale",
    kb_categories: ["identita", "vendita", "negoziazione"],
    prompt: `Obiettivo: Reclutare un partner per il network espresso e cargo aereo con sistema di booking in real-time.

STRUTTURA OBBLIGATORIA:
1. OPPORTUNITÀ (2 righe): "Stiamo selezionando UN partner per [paese] nel nostro network express/cargo aereo con booking real-time. Il vostro profilo su [network] ci ha colpito per..."
2. IL SISTEMA (3-4 righe): Descrivi il sistema operativo:
   - Booking online in real-time con tariffe pre-concordate
   - Tracking unificato per il cliente finale
   - Volumi bidirezionali da [N] paesi già attivi nel network
   - SLA definiti (pickup entro 24h, POD entro 48h)
3. ESCLUSIVITÀ (1-2 righe): Enfatizza che cerchi UN solo partner per paese — crea scarsità reale, non artificiale.
4. CTA CON TIMELINE: "Stiamo chiudendo le selezioni per [area] entro [mese]. Sareste disponibili per una call questa settimana?"

VINCOLI:
- Massimo 12 righe — questo è un messaggio di reclutamento, deve essere incisivo
- Usa dati concreti: "15 paesi già attivi", "200+ spedizioni/mese nel network"
- La scarsità deve essere VERA — un partner per paese
- Tono selettivo: "abbiamo scelto voi" > "cerchiamo qualcuno"`,
    structure: "opportunità → sistema → esclusività → CTA con timeline",
  },
];

export const TONE_OPTIONS = [
  { value: "formale", label: "Formale", icon: "GraduationCap" },
  { value: "professionale", label: "Professionale", icon: "Briefcase" },
  { value: "amichevole", label: "Amichevole", icon: "Smile" },
  { value: "diretto", label: "Diretto", icon: "Target" },
];
