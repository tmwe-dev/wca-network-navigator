import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Globe, Users, Mail, Send, Sparkles, Building2, Calendar, Settings, BookOpen, Chrome, Search, Puzzle } from "lucide-react";

const sections = [
  {
    icon: Globe,
    title: "Operations Center",
    description: "Dashboard centrale per la gestione globale dei partner e dei download",
    details: [
      "Griglia paesi con statistiche: partner totali, email, telefoni, profili scaricati, copertura directory",
      "Statistiche globali aggregate con contatori animati",
      "Job di download in background con terminale live e monitoraggio progresso",
      "Pannello partner per paese con dettaglio contatti e stato arricchimento",
      "Strumenti avanzati: resync profili, WCA browser integrato, configurazione delay",
      "Assistente AI integrato per analisi e suggerimenti operativi",
      "Indicatore stato sessione WCA in tempo reale",
    ],
  },
  {
    icon: Users,
    title: "Partner Hub",
    description: "Navigazione a 3 livelli per esplorare e gestire i partner WCA",
    details: [
      "Navigazione: griglia paesi → workbench paese → lista partner flat",
      "Filtri avanzati: network, certificazioni (IATA, ISO, AEO, BASC, C-TPAT), servizi, rating, anni WCA, scadenza membership",
      "Deep Search bulk con barra progresso e possibilità di stop",
      "Selezione multipla con azioni: invio email, creazione attività workspace, deep search",
      "Dettaglio partner completo: contatti personali, social link, rating con breakdown, servizi offerti",
      "Indicatore qualità contatti: verde (completo), ambra (parziale), rosso (mancante)",
      "Mini-globo 3D nella scheda partner per visualizzare la posizione geografica",
    ],
  },
  {
    icon: Mail,
    title: "Campaigns",
    description: "Selezione partner tramite globo 3D interattivo e invio batch",
    details: [
      "Globo 3D interattivo con marker per paese e connessioni di rete animate",
      "Selezione partner per paese con click sul globo",
      "Filtro per network WCA attivo",
      "Invio batch a Campaign Jobs per gestione coda email/call",
      "Preview email personalizzata prima dell'invio",
      "Aurora boreale animata come effetto visivo",
    ],
  },
  {
    icon: Send,
    title: "Email Composer",
    description: "Composizione e invio email HTML con variabili dinamiche",
    details: [
      "Editor email HTML con variabili dinamiche: {{company_name}}, {{contact_name}}, {{city}}, {{country}}",
      "Selezione destinatari per paese, partner singolo o batch da campaign jobs",
      "Allegati da template caricati nelle impostazioni (per categoria)",
      "Link personalizzati configurabili",
      "Anteprima live dell'email con dati reali del destinatario",
      "Invio diretto tramite SMTP configurato nelle impostazioni",
    ],
  },
  {
    icon: Sparkles,
    title: "Email Workspace",
    description: "Generazione email AI personalizzate con arricchimento dati integrato",
    details: [
      "Generazione email AI personalizzate basate sul profilo del partner e documenti di riferimento",
      "Lista contatti con indicatori arricchimento: enriched, website trovato, LinkedIn trovato",
      "Deep Search integrata con barra progresso e possibilità di stop",
      "Eliminazione bulk attività completate o selezionate",
      "Filtri: enriched/non enriched, paese, tipo attività",
      "Barra obiettivo con documenti di riferimento caricabili e link configurabili",
      "Canvas email con anteprima e invio diretto",
    ],
  },
  {
    icon: Building2,
    title: "Prospect Center",
    description: "Gestione prospect italiani importati da Report Aziende",
    details: [
      "Griglia ATECO interattiva con ranking automatico basato su rilevanza settoriale",
      "Filtri avanzati: fatturato, numero dipendenti, regione, provincia, codice ATECO",
      "Importazione automatica tramite estensione Chrome Report Aziende",
      "Ricerca rapida per nome azienda o partita IVA",
      "Dettaglio prospect con dati finanziari, contatti e link social",
      "Wizard di importazione con mappatura campi automatica",
    ],
  },
  {
    icon: Calendar,
    title: "Agenda",
    description: "Calendario reminder, attività e follow-up",
    details: [
      "Calendario con vista mensile e indicatori giornalieri",
      "Reminder con priorità (alta, media, bassa) e data di scadenza",
      "Tab attività con gestione batch: completamento, cancellazione, riassegnazione",
      "Collegamento diretto al partner associato con apertura dettaglio",
      "Vista per scadenza: oggi, questa settimana, in ritardo",
      "Completamento con un click e segna come annullato",
    ],
  },
  {
    icon: Settings,
    title: "Impostazioni",
    description: "Configurazione completa del sistema in 9 tab",
    details: [
      "Generale: numero WhatsApp aziendale per link automatici",
      "Email: configurazione SMTP (host, porta, utente, password) con test invio integrato",
      "Connessioni: credenziali WCA (email/password) + estensione Chrome + credenziali LinkedIn (email/password) + estensione Chrome + cookie manuale li_at",
      "Import/Export: caricamento e scaricamento dati in CSV e JSON con selezione campi",
      "Blacklist: gestione aziende da escludere dalle campagne con sincronizzazione WCA",
      "Report Aziende: credenziali (email/password) + estensione Chrome per importazione prospect",
      "Template: upload allegati per categoria (presentazioni, listini, certificati)",
      "Profilo AI: personalizzazione tono, stile e istruzioni per la generazione email",
      "Abbonamento: visualizzazione piano attivo, crediti residui e storico consumi",
    ],
  },
];

const extensionSection = {
  icon: Chrome,
  title: "Estensioni Chrome",
  description: "3 estensioni dedicate per automazione e raccolta dati",
  subsections: [
    {
      name: "WCA World",
      details: [
        "Auto-login con credenziali salvate nelle impostazioni",
        "Sincronizzazione automatica cookie di sessione WCA",
        "Scraping directory WCA: lista membri per paese e network",
        "Download profili partner con contatti privati",
        "Comunicazione bidirezionale con la webapp tramite postMessage",
      ],
    },
    {
      name: "LinkedIn",
      details: [
        "Auto-login con credenziali email/password salvate",
        "Sincronizzazione automatica cookie li_at",
        "Estrazione dati profilo: nome, titolo, azienda, bio, foto",
        "Verifica stato sessione LinkedIn attiva",
        "Pagina download dedicata con istruzioni installazione",
      ],
    },
    {
      name: "Report Aziende",
      details: [
        "Auto-login al portale Report Aziende",
        "Scraping automatico prospect con dati finanziari completi",
        "Importazione diretta nel Prospect Center",
        "Estrazione contatti aziendali e link social",
      ],
    },
  ],
};

const deepSearchSection = {
  icon: Search,
  title: "Deep Search",
  description: "Flusso di arricchimento automatico dei partner",
  details: [
    "Scoperta sito web: estrazione dominio dall'email aziendale o ricerca tramite Firecrawl",
    "Scraping sito web: estrazione contenuti principali (about, servizi, contatti)",
    "Analisi AI: elaborazione dei contenuti per generare descrizione, servizi e punti chiave",
    "Logo automatico: recupero favicon tramite Google Favicon API (https://www.google.com/s2/favicons)",
    "Link WhatsApp: generazione automatica del link wa.me dal numero di telefono",
    "Social link: scoperta automatica profili LinkedIn, Facebook, Instagram, Twitter",
    "Disponibile come azione singola o bulk (selezione multipla nel Partner Hub e Workspace)",
    "Barra progresso con contatore e possibilità di stop durante l'esecuzione bulk",
  ],
};

const Guida = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary" />
          Guida Progetto
        </h1>
        <p className="text-muted-foreground mt-1">
          Panoramica completa di WCA Partners CRM — tutte le funzionalità e i moduli disponibili
        </p>
      </div>

      {/* Sezioni principali */}
      <div className="grid gap-4">
        {sections.map((section) => (
          <Card key={section.title} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                  <section.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {section.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Estensioni Chrome */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Puzzle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{extensionSection.title}</CardTitle>
              <CardDescription>{extensionSection.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {extensionSection.subsections.map((sub) => (
            <div key={sub.name}>
              <h4 className="font-medium text-sm mb-1.5">{sub.name}</h4>
              <ul className="space-y-1">
                {sub.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Deep Search */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <deepSearchSection.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{deepSearchSection.title}</CardTitle>
              <CardDescription>{deepSearchSection.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {deepSearchSection.details.map((detail, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Guida;
