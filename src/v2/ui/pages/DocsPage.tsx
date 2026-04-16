/**
 * DocsPage — User-facing documentation (commercial, not technical KB)
 */
import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, Users, Brain, Mail, Globe, Shield, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DocSection = {
  id: string;
  icon: React.ElementType;
  title: string;
  articles: { title: string; content: string }[];
};

const DOCS: DocSection[] = [
  {
    id: "getting-started", icon: Zap, title: "Iniziare",
    articles: [
      { title: "Primo accesso", content: "Dopo aver effettuato la registrazione e il login, verrai guidato attraverso un wizard di onboarding in 5 step. Potrai importare i tuoi partner da un file CSV, creare il tuo primo agente AI, lanciare una missione di analisi e generare un report." },
      { title: "Import partner CSV", content: "Vai su Import e carica un file CSV con le colonne: company_name, email, phone, country, website. Il sistema normalizzerà automaticamente i numeri di telefono e deduplicherà i contatti esistenti." },
      { title: "Navigare la piattaforma", content: "La sidebar laterale contiene tutte le sezioni principali: Dashboard, Network (mappa partner), CRM (gestione contatti), Outreach (campagne), Agenti AI, e Settings. Usa ⌘K per la ricerca rapida." },
    ],
  },
  {
    id: "network", icon: Globe, title: "Network WCA",
    articles: [
      { title: "Directory WCA", content: "La sezione Network mostra tutti i partner dei 17 network WCA organizzati per paese. Ogni partner ha una scheda con informazioni aziendali, contatti, e storico interazioni." },
      { title: "Ricerca e filtri", content: "Usa i filtri globali per cercare per paese, tipo ufficio (HQ/Branch), stato del lead, e disponibilità di email/telefono. I filtri sono persistenti durante la sessione." },
      { title: "Deep Search", content: "Il Deep Search arricchisce automaticamente le informazioni del partner analizzando il sito web, profili LinkedIn e fonti pubbliche. Richiede crediti AI." },
    ],
  },
  {
    id: "crm", icon: Users, title: "CRM e Contatti",
    articles: [
      { title: "Gestione contatti", content: "Il CRM centralizza tutti i contatti importati e quelli scoperti dall'AI. Ogni contatto ha un lead score (0-100) calcolato automaticamente in base a completezza dati, interazioni e risposte." },
      { title: "Lead scoring", content: "Il punteggio si basa su: email presente (+15), telefono (+10), risposta ricevuta (+25), meeting programmato (+20), business card associata (+10). Il punteggio si aggiorna in tempo reale." },
      { title: "Deduplicazione", content: "Il sistema identifica automaticamente i duplicati confrontando email, numeri di telefono e nomi aziendali con soglia di sovrapposizione >70%." },
    ],
  },
  {
    id: "ai-agents", icon: Brain, title: "Agenti AI",
    articles: [
      { title: "Cosa sono gli agenti", content: "Gli agenti AI sono assistenti autonomi che possono eseguire missioni multi-step: analizzare siti web, comporre email personalizzate, classificare risposte e aggiornare il CRM. Ogni azione richiede la tua approvazione." },
      { title: "Creare un agente", content: "Vai su Agenti → Nuovo Agente. Configura il tono di voce, la lingua, le competenze e i tool a disposizione. L'agente eredita la Knowledge Base del sistema e può accedere ai tuoi contatti." },
      { title: "Missioni", content: "Una missione è una sequenza di azioni che l'agente esegue su un set di contatti. Esempio: 'Per ogni partner in Italia senza email, scrapa il sito e aggiorna il contatto'. L'agente pianifica, presenta un piano d'azione e attende approvazione." },
    ],
  },
  {
    id: "outreach", icon: Mail, title: "Outreach e Campagne",
    articles: [
      { title: "Campagne multicanale", content: "Crea campagne su Email, WhatsApp e LinkedIn con test A/B integrati. Il sistema rispetta i limiti giornalieri per canale e le fasce orarie lavorative del destinatario." },
      { title: "Template email", content: "I template supportano variabili dinamiche (nome azienda, paese, servizi). L'AI può generare varianti personalizzate per ogni destinatario basandosi sul contesto." },
      { title: "Tracking risposte", content: "Le risposte vengono classificate automaticamente dall'AI (positiva, negativa, out-of-office, bounce) e il lead status del contatto si aggiorna di conseguenza." },
    ],
  },
  {
    id: "security", icon: Shield, title: "Sicurezza e Compliance",
    articles: [
      { title: "GDPR", content: "I dati sono processati in conformità al GDPR. Ogni organizzazione ha un workspace isolato con RLS (Row Level Security) a livello database. È disponibile un DPA firmabile dalla sezione Settings." },
      { title: "Autenticazione", content: "Supporto per email+password con whitelist, RBAC multi-ruolo (admin, operator, viewer), e audit trail completo di tutte le azioni." },
      { title: "SOC2", content: "La piattaforma segue le best practice SOC2 Type I: crittografia at-rest e in-transit, logging strutturato, controllo accessi basato su ruoli, backup automatici." },
    ],
  },
];

export function DocsPage(): React.ReactElement {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("getting-started");

  const filtered = search.trim()
    ? DOCS.map(s => ({
        ...s,
        articles: s.articles.filter(a =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.content.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(s => s.articles.length > 0)
    : DOCS.filter(s => s.id === activeSection);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Documentazione</h1>
          </div>
          <p className="text-muted-foreground mb-6">Tutto quello che devi sapere per usare WCA Network Navigator.</p>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca nella documentazione..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <nav className="md:w-56 shrink-0">
            <ul className="space-y-1">
              {DOCS.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => { setActiveSection(s.id); setSearch(""); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      activeSection === s.id && !search ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <s.icon className="h-4 w-4 shrink-0" />
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="flex-1 space-y-6">
            {filtered.map((section) => (
              <div key={section.id}>
                {search && (
                  <div className="flex items-center gap-2 mb-3">
                    <section.icon className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">{section.title}</h2>
                    <Badge variant="secondary">{section.articles.length}</Badge>
                  </div>
                )}
                <div className="space-y-4">
                  {section.articles.map((article) => (
                    <Card key={article.title} className="border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                          {article.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">{article.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>Nessun risultato per "{search}"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
