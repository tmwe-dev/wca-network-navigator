export interface ContentItem {
  name: string;
  text: string;
  category?: string;
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
    text: "Presentarsi come Transport Management e verificare la possibilità di avviare una collaborazione operativa con il partner, esplorando sinergie nei servizi di spedizione e logistica internazionale.",
    category: "primo_contatto",
  },
  {
    name: "Richiesta informazioni servizi",
    text: "Raccogliere informazioni dettagliate sui servizi offerti dal partner per valutarne l'inserimento nel nostro database fornitori qualificati, ai fini di future richieste operative e quotazioni.",
    category: "richiesta",
  },
  {
    name: "Presentazione servizi rapida",
    text: "Descrivere in modo sintetico i nostri servizi principali (trasporto aereo, marittimo, terrestre, corriere espresso) e proporre un incontro di approfondimento per valutare opportunità di collaborazione.",
    category: "primo_contatto",
  },
  {
    name: "Invito a meeting conoscitivo",
    text: "Invitare il partner a un meeting online o in presenza per una conoscenza reciproca, presentazione delle rispettive capacità operative e valutazione di potenziali collaborazioni commerciali.",
    category: "primo_contatto",
  },
  {
    name: "Ricerca partner per network espresso e cargo aereo",
    text: "Comunicare che stiamo costruendo un network mondiale con sistema di booking in real-time per servizi di corriere espresso e cargo aereo, cercando partner affidabili a cui affidare la copertura di specifici Paesi.",
    category: "partnership",
  },
  {
    name: "Richiesta tariffe e accordo commerciale",
    text: "Richiedere il listino tariffe aggiornato per i principali servizi (import/export, aereo, marittimo, terrestre) e avviare una trattativa per definire un accordo commerciale operativo.",
    category: "richiesta",
  },
  {
    name: "Follow-up dopo primo contatto",
    text: "Riprendere il dialogo con un partner già contattato in precedenza, verificare l'interesse a proseguire la conversazione e proporre i prossimi passi concreti per avviare la collaborazione.",
    category: "follow_up",
  },
  {
    name: "Proposta di partnership esclusiva per Paese",
    text: "Offrire al partner la possibilità di diventare il nostro referente esclusivo per un determinato Paese o area geografica, con vantaggi reciproci in termini di volumi e priorità operativa.",
    category: "partnership",
  },
  {
    name: "Richiesta referenze e volumi",
    text: "Verificare l'affidabilità e la capacità operativa del partner richiedendo referenze commerciali, volumi gestiti annualmente, principali rotte servite e certificazioni possedute.",
    category: "richiesta",
  },
  {
    name: "Cross-selling servizi aggiuntivi",
    text: "Proporre a un partner già attivo l'estensione della collaborazione a servizi complementari non ancora coperti, come dangerous goods, project cargo, e-commerce logistics o sdoganamento.",
    category: "follow_up",
  },
];

export const DEFAULT_PROPOSALS: ContentItem[] = [
  {
    name: "Collaborazione trasporti aerei e corriere espresso",
    text: "Proposta di collaborazione per servizi di trasporto aereo e corriere espresso internazionale con tariffe competitive, tempi di transito garantiti e tracking completo door-to-door. Possibilità di accordi su volumi con tariffe dedicate per le principali rotte.",
    category: "proposta_servizi",
  },
  {
    name: "Servizio door-to-door con tracking e sdoganamento",
    text: "Offerta di servizio completo door-to-door che include ritiro, trasporto internazionale, sdoganamento import/export e consegna finale. Tracking in tempo reale su ogni spedizione e assistenza dedicata per pratiche doganali complesse.",
    category: "proposta_servizi",
  },
  {
    name: "Partnership distribuzione locale e ultimo miglio",
    text: "Proposta di partnership per la distribuzione locale nel vostro Paese: servizi di magazzinaggio, gestione ordini, consegna ultimo miglio con flotta dedicata. Ideale per clienti che necessitano di presenza operativa nel vostro mercato.",
    category: "partnership",
  },
  {
    name: "Accordo groupage marittimo FCL/LCL",
    text: "Proposta di accordo per servizi di groupage marittimo FCL e LCL con consolidamenti settimanali sulle principali rotte. Tariffe competitive per container completi e servizio di consolidamento per partite parziali con partenze regolari.",
    category: "proposta_servizi",
  },
  {
    name: "Network trasporto terrestre con tempi garantiti",
    text: "Proposta di integrazione nel nostro network di trasporto terrestre europeo con flotta propria e partner selezionati. Servizio FTL e LTL con tempi di transito garantiti, tracking GPS e assicurazione all-risk inclusa.",
    category: "partnership",
  },
  {
    name: "Logistica integrata: stoccaggio, picking, distribuzione",
    text: "Offerta di servizi di logistica integrata comprensivi di stoccaggio in magazzino, gestione inventario, picking & packing e distribuzione capillare. Soluzione completa per clienti che necessitano di outsourcing logistico nel vostro mercato.",
    category: "proposta_servizi",
  },
  {
    name: "Spedizioni dangerous goods ADR/IATA",
    text: "Proposta di accordo per la gestione di spedizioni di merci pericolose con certificazione ADR per il terrestre e IATA DGR per l'aereo. Personale formato e autorizzato, documentazione conforme e assicurazione specifica per ogni classe di pericolo.",
    category: "proposta_servizi",
  },
  {
    name: "Partnership e-commerce logistics e fulfillment",
    text: "Proposta di collaborazione per servizi di e-commerce logistics: fulfillment B2C e B2B, gestione resi, packaging personalizzato e consegna express. Integrazione con le principali piattaforme e-commerce e marketplace internazionali.",
    category: "partnership",
  },
  {
    name: "Trasporti project cargo e carichi eccezionali",
    text: "Proposta per la gestione di trasporti project cargo e carichi fuori sagoma: studio di fattibilità, permessi speciali, scorta tecnica e assicurazione dedicata. Esperienza in impianti industriali, energia rinnovabile e infrastrutture.",
    category: "proposta_servizi",
  },
  {
    name: "Gestione traffico import/export con sdoganamento dedicato",
    text: "Proposta per la gestione completa del traffico import/export con ufficio doganale dedicato: classificazione merci, calcolo dazi, gestione certificati di origine, procedure preferenziali e consulenza su regimi doganali speciali.",
    category: "proposta_servizi",
  },
];
