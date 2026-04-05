export interface ContentItem {
  name: string;
  text: string;
  category?: string;
  /** Tags for KB matching */
  kb_hint?: string;
}

export const CONTENT_CATEGORIES = [
  { key: "primo_contatto", label: "Primo contatto", icon: "Handshake" },
  { key: "follow_up", label: "Follow-up", icon: "RefreshCw" },
  { key: "richiesta", label: "Richiesta", icon: "Search" },
  { key: "proposta_servizi", label: "Proposta servizi", icon: "Briefcase" },
  { key: "partnership", label: "Partnership", icon: "Globe" },
  { key: "altro", label: "Altro", icon: "FileText" },
] as const;

export const DEFAULT_GOALS: ContentItem[] = [
  {
    name: "Primo contatto commerciale",
    text: `Aprire un dialogo con un partner mai contattato prima. L'obiettivo NON è vendere ma creare curiosità e ottenere una risposta.

Istruzioni strategiche per l'AI:
- Usa la tecnica "Label" (Chris Voss): identifica un aspetto del destinatario e nominalo ("Sembra che siate molto attivi nel settore...")
- Struttura: Hook personalizzato → Ponte di connessione → Una sola value proposition → Domanda aperta calibrata
- NON presentare tutti i servizi. Scegli quello più rilevante per il destinatario in base ai dati disponibili.
- MAI aprire con "Mi presento" o "La nostra azienda è..." — apri con LORO.
- Consulta KB: sezioni identità aziendale, 5 missioni fondamentali, tecniche primo contatto.`,
    category: "primo_contatto",
    kb_hint: "identita,vendita,email_modelli",
  },
  {
    name: "Richiesta informazioni servizi",
    text: `Raccogliere informazioni operative specifiche sul partner per qualificarlo come fornitore nel nostro database.

Istruzioni strategiche per l'AI:
- Fai 3-5 domande PRECISE e rispondibili in 5 minuti (transit time, copertura, certificazioni, volumi annui).
- Offri reciprocità: condividi un dato su di te per ogni dato che chiedi.
- Usa la tecnica del "Mirroring": ripeti una parola chiave dal profilo del destinatario per creare rapport.
- Consulta KB: sezioni identità aziendale, servizi offerti, criteri di qualificazione partner.`,
    category: "richiesta",
    kb_hint: "identita,vendita",
  },
  {
    name: "Presentazione servizi rapida",
    text: `Presentare in modo sintetico e incisivo i servizi principali, con focus su quelli più rilevanti per il destinatario.

Istruzioni strategiche per l'AI:
- NON fare un elenco di tutti i servizi. Scegli i 2-3 più rilevanti per il paese/settore del destinatario.
- Usa la tecnica "Anchor High": presenta il valore più alto prima (network globale, sistema real-time) e poi scendi nei dettagli.
- Ogni servizio deve avere un NUMERO concreto associato (paesi coperti, transit time, frequenza).
- CTA: proponi un meeting online di 15-20 minuti, MAI un generico "restiamo in contatto".
- Consulta KB: 5 missioni fondamentali, network building, servizi Transport Management.`,
    category: "primo_contatto",
    kb_hint: "identita,vendita",
  },
  {
    name: "Invito a meeting conoscitivo",
    text: `Invitare il partner a un meeting online o in persona per esplorare la collaborazione.

Istruzioni strategiche per l'AI:
- Proponi una durata specifica (15 o 20 minuti) — riduci la percezione di impegno.
- Offri 2-3 slot temporali concreti o proponi di usare un tool di scheduling.
- Spiega in 2 righe cosa GUADAGNERÀ il partner dal meeting, non cosa vuoi tu.
- Usa la tecnica del "che cosa perderebbe": fai percepire il costo dell'inazione.
- Consulta KB: tecniche di negoziazione, value proposition.`,
    category: "primo_contatto",
    kb_hint: "vendita,negoziazione",
  },
  {
    name: "Ricerca partner per network espresso e cargo aereo",
    text: `Reclutare partner affidabili per un network worldwide di corriere espresso e cargo aereo con booking real-time.

Istruzioni strategiche per l'AI:
- Enfatizza ESCLUSIVITÀ: un solo partner per paese — crea scarsità reale.
- Descrivi il sistema operativo: booking online, tracking unificato, SLA definiti, volumi bidirezionali.
- Usa numeri: paesi già attivi, spedizioni/mese nel network, timeline di selezione.
- Tono SELETTIVO: "Vi abbiamo identificato come candidato ideale" > "cerchiamo qualcuno".
- Consulta KB: 5 missioni, network building, partnership strategiche.`,
    category: "partnership",
    kb_hint: "identita,vendita,negoziazione",
  },
  {
    name: "Richiesta tariffe e accordo commerciale",
    text: `Richiedere tariffe per avviare una trattativa commerciale operativa.

Istruzioni strategiche per l'AI:
- Specifica ESATTAMENTE cosa serve: rotte, modalità (aereo/marittimo/terrestre), tipo (FCL/LCL/groupage), volumi stimati.
- Offri reciprocità: "In cambio possiamo condividere le nostre tariffe per [rotta]".
- Usa la tecnica dell'"Anchor": se hai un benchmark di mercato, menzionalo per orientare la trattativa.
- Non chiedere "il miglior prezzo" — chiedi "la vostra tariffa standard per [servizio specifico]".
- Consulta KB: negoziazione, 10 comandamenti, tecniche di pricing.`,
    category: "richiesta",
    kb_hint: "negoziazione,vendita",
  },
  {
    name: "Follow-up dopo primo contatto",
    text: `Riattivare un partner che non ha risposto o che ha mostrato interesse senza concretizzare.

Istruzioni strategiche per l'AI:
- CONTROLLA la storia interazioni: NON ripetere lo stesso approccio del messaggio precedente.
- Porta qualcosa di NUOVO: un dato di mercato, un caso d'uso, una novità del servizio.
- Usa la tecnica del "No strategico" (Chris Voss): "Ha rinunciato all'idea di espandere su [paese]?" — provoca risposta correttiva.
- Il follow-up deve essere PIÙ CORTO del primo contatto (max 6-8 righe).
- Se è il 3° tentativo, usa "last attempt": "È l'ultima volta che scrivo su questo tema, ma volevo assicurarmi..."
- Consulta KB: tecniche follow-up, ghosting recovery, domande calibrate.`,
    category: "follow_up",
    kb_hint: "vendita,negoziazione,email_modelli",
  },
  {
    name: "Proposta di partnership esclusiva per Paese",
    text: `Offrire al partner la possibilità di diventare referente esclusivo per un paese o area geografica.

Istruzioni strategiche per l'AI:
- Enfatizza la BIDIREZIONALITÀ: volumi in entrambe le direzioni, non solo da te a loro.
- Elenca vantaggi tangibili e misurabili: sistema booking, volumi dal network, tariffe preferenziali, visibilità.
- Proponi un percorso graduale: Test (5-10 spedizioni) → Valutazione → Accordo annuale.
- Usa "Loss Aversion": fai percepire cosa perderebbe il partner non partecipando.
- Tono da "pari a pari", mai da fornitore a cliente.
- Consulta KB: partnership, network building, negoziazione avanzata.`,
    category: "partnership",
    kb_hint: "identita,vendita,negoziazione",
  },
  {
    name: "Richiesta referenze e volumi",
    text: `Verificare affidabilità e capacità operativa del partner raccogliendo dati concreti.

Istruzioni strategiche per l'AI:
- Chiedi dati specifici: volumi annui (TEU, tonnellate, spedizioni), principali rotte, certificazioni (ISO, AEO, IATA, FIATA).
- Offri di condividere i tuoi stessi dati in cambio — reciprocità.
- Rendi facile la risposta: "Anche un breve elenco puntato o un link al vostro profilo aziendale".
- Consulta KB: criteri qualificazione, identità aziendale.`,
    category: "richiesta",
    kb_hint: "identita",
  },
  {
    name: "Cross-selling servizi aggiuntivi",
    text: `Proporre a un partner già attivo servizi complementari non ancora coperti nella collaborazione.

Istruzioni strategiche per l'AI:
- ANALIZZA la storia interazioni e i servizi già attivi per identificare GAP.
- Proponi UN solo servizio aggiuntivo alla volta (dangerous goods, project cargo, e-commerce, sdoganamento).
- Collega il nuovo servizio a un bisogno emerso dalle interazioni precedenti.
- Usa la tecnica dell'"Accusation Audit": "So che aggiungere un nuovo servizio può sembrare complesso, ma..."
- Offri un test gratuito o a condizioni speciali per il primo ordine.
- Consulta KB: servizi, vendita avanzata, tecniche di upselling.`,
    category: "follow_up",
    kb_hint: "vendita,negoziazione",
  },
];

export const DEFAULT_PROPOSALS: ContentItem[] = [
  {
    name: "Collaborazione trasporti aerei e corriere espresso",
    text: `Proposta operativa per servizi di trasporto aereo e corriere espresso internazionale.

Dettagli per l'AI:
- Tariffe competitive con accordi su volumi — specificare range di peso (doc/non-doc, -45kg, 45-100kg, 100-300kg, 300kg+)
- Transit time garantiti con tracking door-to-door in real-time
- Network attivo su [inserire N] paesi con partner verificati
- Consolidamenti regolari su hub principali (indicare frequenza settimanale)
- SLA: pickup entro 24h, POD entro 48h dalla consegna`,
    category: "proposta_servizi",
    kb_hint: "identita,vendita",
  },
  {
    name: "Servizio door-to-door con tracking e sdoganamento",
    text: `Offerta di servizio completo door-to-door.

Dettagli per l'AI:
- Servizio end-to-end: ritiro → trasporto internazionale → sdoganamento → consegna finale
- Tracking real-time su ogni milestone della spedizione
- Ufficio doganale dedicato per pratiche import/export complesse
- Gestione documentale completa (packing list, fattura, certificato origine, EUR.1)
- Assicurazione all-risk opzionale con copertura fino a [valore]`,
    category: "proposta_servizi",
    kb_hint: "identita",
  },
  {
    name: "Partnership distribuzione locale e ultimo miglio",
    text: `Proposta di partnership per distribuzione locale nel paese del destinatario.

Dettagli per l'AI:
- Magazzinaggio con gestione inventario WMS-based
- Consegna ultimo miglio con flotta dedicata o partner locali qualificati
- Capacità B2C e B2B con gestione resi
- Ideale per clienti che necessitano di presenza operativa nel mercato del partner
- Modello revenue sharing o tariffa fissa — flessibilità nella struttura commerciale`,
    category: "partnership",
    kb_hint: "identita,vendita",
  },
  {
    name: "Accordo groupage marittimo FCL/LCL",
    text: `Proposta per servizi di groupage marittimo con consolidamenti regolari.

Dettagli per l'AI:
- FCL (20'/40'/40'HC) e LCL con partenze settimanali sulle rotte principali
- Consolidamento in hub strategici con transit time competitivi
- Tariffe all-in (origine → destino) o modulari per massima trasparenza
- Tracking container in real-time con alert automatici
- Volume minimo per attivazione: [N] TEU/mese — scala di prezzi per volume`,
    category: "proposta_servizi",
    kb_hint: "identita",
  },
  {
    name: "Network trasporto terrestre europeo",
    text: `Proposta di integrazione nel network di trasporto terrestre europeo.

Dettagli per l'AI:
- FTL e LTL con copertura capillare su [N] paesi europei
- Transit time garantiti con tracking GPS in tempo reale
- Assicurazione all-risk inclusa fino a [valore] per spedizione
- Partenze giornaliere/settimanali sulle rotte principali
- Flotta mista: propria + partner selezionati con standard verificati`,
    category: "partnership",
    kb_hint: "identita",
  },
  {
    name: "Logistica integrata: stoccaggio, picking, distribuzione",
    text: `Offerta di servizi di logistica integrata e outsourcing logistico.

Dettagli per l'AI:
- Magazzino con gestione inventario, picking & packing personalizzato
- Distribuzione capillare B2B e B2C nel mercato del partner
- Integrazione IT con sistemi ERP/WMS del cliente
- Reportistica completa: KPI logistici, SLA, audit trail
- Scalabilità: capacità di gestire picchi stagionali (Black Friday, Natale)`,
    category: "proposta_servizi",
    kb_hint: "identita",
  },
  {
    name: "Spedizioni dangerous goods ADR/IATA",
    text: `Proposta per gestione spedizioni merci pericolose certificate.

Dettagli per l'AI:
- Certificazione ADR (terrestre) e IATA DGR (aereo) — personale formato e autorizzato
- Copertura classi 1-9 con documentazione conforme (DGD, SDS, packaging certificato)
- Assicurazione specifica per classe di pericolo
- Compliance normativa garantita con audit periodici
- Network di partner DG-qualified su [N] paesi`,
    category: "proposta_servizi",
    kb_hint: "identita",
  },
  {
    name: "Partnership e-commerce logistics e fulfillment",
    text: `Proposta di collaborazione per e-commerce logistics e fulfillment.

Dettagli per l'AI:
- Fulfillment B2C e B2B con gestione resi completa
- Packaging personalizzato con branding del cliente
- Consegna express (24-48h) nel mercato domestico del partner
- Integrazione con piattaforme: Shopify, WooCommerce, Amazon, eBay, Alibaba
- Scalabilità per picchi: fino a [N]x il volume standard`,
    category: "partnership",
    kb_hint: "identita,vendita",
  },
  {
    name: "Trasporti project cargo e carichi eccezionali",
    text: `Proposta per gestione project cargo e trasporti fuori sagoma.

Dettagli per l'AI:
- Studio di fattibilità ingegneristico per ogni progetto
- Permessi speciali, scorta tecnica, route survey
- Assicurazione dedicata per singolo progetto
- Esperienza documentata: impianti industriali, energia rinnovabile, infrastrutture
- Team project dedicato con PM single-point-of-contact`,
    category: "proposta_servizi",
    kb_hint: "identita",
  },
  {
    name: "Gestione traffico import/export con sdoganamento",
    text: `Proposta per gestione completa del traffico import/export con dogana dedicata.

Dettagli per l'AI:
- Classificazione merci, calcolo dazi, gestione certificati di origine
- Procedure preferenziali (EUR.1, Form A, REX)
- Regimi speciali: temporanea importazione, perfezionamento attivo/passivo, deposito doganale
- Consulenza normativa su sanzioni, dual-use, embargo
- Interfaccia digitale con Agenzia delle Dogane (AIDA/NCTS)`,
    category: "proposta_servizi",
    kb_hint: "identita",
  },
];
