export interface EmailType {
  id: string;
  name: string;
  icon: string;
  category: string;
  prompt: string;
  tone: string;
}

export const DEFAULT_EMAIL_TYPES: EmailType[] = [
  {
    id: "primo_contatto",
    name: "Primo contatto",
    icon: "🤝",
    category: "primo_contatto",
    prompt: "Presentarsi come Transport Management e verificare la possibilità di avviare una collaborazione operativa con il partner, esplorando sinergie nei servizi di spedizione e logistica internazionale.",
    tone: "professionale",
  },
  {
    id: "follow_up",
    name: "Follow-up",
    icon: "🔄",
    category: "follow_up",
    prompt: "Riprendere il dialogo con un partner già contattato in precedenza, verificare l'interesse a proseguire la conversazione e proporre i prossimi passi concreti per avviare la collaborazione.",
    tone: "professionale",
  },
  {
    id: "richiesta_info",
    name: "Richiesta info",
    icon: "📋",
    category: "richiesta",
    prompt: "Raccogliere informazioni dettagliate sui servizi offerti dal partner per valutarne l'inserimento nel nostro database fornitori qualificati.",
    tone: "professionale",
  },
  {
    id: "proposta",
    name: "Proposta",
    icon: "💼",
    category: "proposta_servizi",
    prompt: "Descrivere in modo sintetico i nostri servizi principali (trasporto aereo, marittimo, terrestre, corriere espresso) e proporre un incontro di approfondimento.",
    tone: "professionale",
  },
  {
    id: "partnership",
    name: "Partnership",
    icon: "🌐",
    category: "partnership",
    prompt: "Comunicare che stiamo costruendo un network mondiale con sistema di booking in real-time per servizi di corriere espresso e cargo aereo, cercando partner affidabili.",
    tone: "professionale",
  },
  {
    id: "network_espresso",
    name: "Network espresso",
    icon: "✈️",
    category: "partnership",
    prompt: "Proposta di ingresso nel network espresso e cargo aereo con copertura di specifici Paesi, sistema di booking real-time e tariffe dedicate.",
    tone: "professionale",
  },
];

export const TONE_OPTIONS = [
  { value: "formale", label: "Formale", icon: "🎩" },
  { value: "professionale", label: "Professionale", icon: "💼" },
  { value: "amichevole", label: "Amichevole", icon: "😊" },
  { value: "diretto", label: "Diretto", icon: "🎯" },
];
