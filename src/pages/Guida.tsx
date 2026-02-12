import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Globe, Download, Database, Mail, Calendar, Settings, BookOpen } from "lucide-react";

const sections = [
  {
    icon: Globe,
    title: "Partner Hub",
    description: "Consultazione, ricerca e filtro dei partner WCA",
    details: [
      "Elenco completo dei partner con filtri per paese, network, servizi e certificazioni",
      "Dettaglio partner con contatti personali, servizi offerti, rating e social link",
      "Selezione multipla per azioni bulk (assegnazione attività)",
      "Deep Search automatico per arricchimento dati (logo, social, descrizione)",
      "Indicatore qualità contatti: verde (completo), ambra (parziale), rosso (mancante)",
    ],
  },
  {
    icon: Download,
    title: "Acquisizione Partner",
    description: "Pipeline automatizzata per scaricare profili WCA",
    details: [
      "Scarica automaticamente i profili dalla directory WCA tramite l'estensione Chrome",
      "Estrae contatti privati (nome, email, telefono) dalle pagine profilo",
      "Retry automatici per i partner senza contatti (fino a 3 tentativi)",
      "Protezione anti-throttling con delay configurabile tra le richieste",
      "Pausa automatica notturna per evitare blocchi da parte di WCA",
    ],
  },
  {
    icon: Database,
    title: "Download Management",
    description: "Scansione della directory WCA e creazione job di download",
    details: [
      "Seleziona i paesi e i network da scansionare",
      "Scansione della directory WCA per ottenere la lista dei membri",
      "Creazione di job di download in background con monitoraggio live",
      "Verifica copertura: confronto tra membri trovati e partner già nel database",
      "Indicatore stato sessione WCA in tempo reale",
    ],
  },
  {
    icon: Mail,
    title: "Campaigns",
    description: "Invio email ai partner selezionati",
    details: [
      "Globo 3D interattivo per selezionare partner per paese",
      "Preview dell'email personalizzata prima dell'invio",
      "Lista partner selezionati con dettagli contatto",
    ],
  },
  {
    icon: Calendar,
    title: "Agenda",
    description: "Calendario reminder e follow-up",
    details: [
      "Crea reminder con data di scadenza e priorità",
      "Collegamento diretto al partner associato",
      "Vista per scadenza: oggi, questa settimana, in ritardo",
      "Segna come completato con un click",
    ],
  },
  {
    icon: Settings,
    title: "Impostazioni",
    description: "Configurazione e gestione dati",
    details: [
      "Connessione WCA: sincronizzazione cookie tramite estensione Chrome",
      "Import/Export: caricamento e scaricamento dati in CSV e JSON",
      "Blacklist: gestione aziende da escludere dalle campagne",
      "Configurazione network: gestione dei network WCA monitorati",
    ],
  },
];

const Guida = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary" />
          Guida Progetto
        </h1>
        <p className="text-muted-foreground mt-1">
          Panoramica delle funzionalità di WCA Partners CRM
        </p>
      </div>

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
    </div>
  );
};

export default Guida;
