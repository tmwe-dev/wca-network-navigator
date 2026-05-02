/**
 * sidebarContextRegistry — single source of truth per i banner contestuali
 * di TUTTE le sidebar filtri. Ogni voce descrive come l'area si presenta
 * all'utente quando apre la linguetta filtri.
 *
 * Usato da `FiltersDrawer` e `ContextFiltersRail` per renderizzare
 * `SidebarBanner` con icona/titolo/descrizione coerenti.
 */
import {
  IdCard,
  Globe,
  Mail,
  MessageCircle,
  Linkedin,
  Calendar,
  ListTodo,
  Inbox,
  Send,
  Plane,
  Users,
  Sparkles,
  Megaphone,
  Beaker,
  Bot,
  FlaskConical,
  Brain,
  Layers,
  PenTool,
  ContactRound,
  Briefcase,
} from "lucide-react";
import type { SidebarBannerProps } from "./SidebarBanner";

export type SidebarContextKey =
  | "network"
  | "crm-contacts"
  | "bca"
  | "cockpit"
  | "workspace"
  | "outgoing"
  | "circuit"
  | "attivita"
  | "agenda"
  | "inbox-email"
  | "inbox-whatsapp"
  | "inbox-linkedin"
  | "inreach"
  | "sorting"
  | "coda-ai"
  | "ab-test"
  | "arena"
  | "campaigns"
  | "email-intelligence"
  | "email-forge"
  | "email-composer";

type Meta = Pick<SidebarBannerProps, "icon" | "title" | "description" | "tone">;

export const SIDEBAR_BANNER_REGISTRY: Record<SidebarContextKey, Meta> = {
  network: {
    icon: Globe,
    title: "WCA Partner",
    description:
      "17 network logistici globali: filtra per paese, qualità dei dati e disponibilità contatti.",
    tone: "primary",
  },
  "crm-contacts": {
    icon: ContactRound,
    title: "Contatti CRM",
    description:
      "Clienti e aziende importate: stati commerciali, origini, canali, match WCA e storico operativo.",
    tone: "info",
  },
  bca: {
    icon: IdCard,
    title: "Biglietti da visita",
    description:
      "Business Card scansionate da eventi: filtra per evento, stato match e disponibilità contatti.",
    tone: "info",
  },
  cockpit: {
    icon: Layers,
    title: "Cockpit",
    description:
      "Vista operativa unificata: origini, paesi, canali e qualità dei contatti in lavorazione.",
    tone: "primary",
  },
  workspace: {
    icon: Briefcase,
    title: "Workspace",
    description:
      "Cantieri di lavoro per email AI: stato della generazione e flag operativi sui contatti.",
    tone: "primary",
  },
  outgoing: {
    icon: Send,
    title: "In Uscita",
    description:
      "Coda dei messaggi pianificati: filtra per stato di invio e ricerca testo libero.",
    tone: "primary",
  },
  circuit: {
    icon: Plane,
    title: "Circuito",
    description:
      "Lead nelle fasi del workflow commerciale: filtra per fase del percorso di vendita.",
    tone: "primary",
  },
  attivita: {
    icon: ListTodo,
    title: "Attività",
    description:
      "Task operativi assegnati: filtra per stato di avanzamento e priorità.",
    tone: "primary",
  },
  agenda: {
    icon: Calendar,
    title: "Agenda",
    description:
      "Promemoria, attività e follow-up pianificati: filtra per tipo e priorità.",
    tone: "primary",
  },
  "inbox-email": {
    icon: Mail,
    title: "Inbox Email",
    description:
      "Posta in arrivo: filtra per stato di lettura e categoria assegnata dal classificatore.",
    tone: "primary",
  },
  "inbox-whatsapp": {
    icon: MessageCircle,
    title: "Inbox WhatsApp",
    description:
      "Conversazioni WhatsApp ricevute via extension: filtra per stato di lettura.",
    tone: "primary",
  },
  "inbox-linkedin": {
    icon: Linkedin,
    title: "Inbox LinkedIn",
    description:
      "Messaggi LinkedIn ricevuti via extension: filtra per stato di lettura.",
    tone: "primary",
  },
  inreach: {
    icon: Inbox,
    title: "Inreach",
    description:
      "Bacheca multicanale unificata: scegli canale e modalità di raggruppamento.",
    tone: "primary",
  },
  sorting: {
    icon: ListTodo,
    title: "Approvazioni",
    description:
      "Smistamento dei messaggi AI in attesa di approvazione operatore.",
    tone: "primary",
  },
  "coda-ai": {
    icon: Bot,
    title: "Coda AI",
    description:
      "Azioni proposte dagli agenti AI: filtra per priorità e cerca per testo.",
    tone: "accent",
  },
  "ab-test": {
    icon: FlaskConical,
    title: "A/B Test",
    description:
      "Esperimenti di outreach in corso o conclusi: filtra per stato del test.",
    tone: "accent",
  },
  arena: {
    icon: Sparkles,
    title: "AI Arena",
    description:
      "Cockpit del Direttore LUCA: scegli focus operativo e canale di lavoro.",
    tone: "accent",
  },
  campaigns: {
    icon: Megaphone,
    title: "Campagne",
    description:
      "Liste e segmenti per outreach massivo: filtra per tipo partner e query AI.",
    tone: "primary",
  },
  "email-intelligence": {
    icon: Brain,
    title: "Email Intelligence",
    description:
      "Mittenti rilevati nella inbox: classificali per addestrare il filtro automatico.",
    tone: "accent",
  },
  "email-forge": {
    icon: PenTool,
    title: "Email Forge — Lab AI",
    description:
      "Officina prompt per generare email: tipo, stile, qualità e knowledge base.",
    tone: "accent",
  },
  "email-composer": {
    icon: Users,
    title: "Email Composer",
    description:
      "Selettore destinatari per la composizione manuale delle email.",
    tone: "primary",
  },
};