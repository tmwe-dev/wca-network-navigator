/**
 * LandingPage — Public landing with hero, features, pricing, and CTA
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Users, Brain, Mail, Shield, Zap,
  CheckCircle2, ArrowRight, Play, Building2, Network
} from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Globe, title: "17 Network WCA", desc: "Gestisci partner in tutti i network World Cargo Alliance da un'unica piattaforma." },
  { icon: Brain, title: "AI Agent Autonomo", desc: "Missioni multi-step: scrape, analizza, componi email, tutto supervisionato." },
  { icon: Mail, title: "Outreach Multicanale", desc: "Email, WhatsApp, LinkedIn. Campagne A/B con scheduling intelligente." },
  { icon: Users, title: "CRM Logistics-Native", desc: "Scoring automatico, deduplicazione, enrichment dati da fonti multiple." },
  { icon: Shield, title: "Enterprise-Ready", desc: "Multi-tenant, RBAC, audit trail, GDPR compliance, SOC2 starter." },
  { icon: Zap, title: "Automazione Totale", desc: "Dal primo import CSV al report finale, tutto automatizzabile." },
];

const PLANS = [
  {
    name: "Free", price: "€0", period: "/mese", popular: false,
    features: ["100 partner", "Ricerca manuale", "100 crediti AI", "3 template email"],
    cta: "Inizia Gratis", tier: "free",
  },
  {
    name: "Pro", price: "€49", period: "/mese", popular: true,
    features: ["Partner illimitati", "Campagne CRM", "500 crediti AI/mese", "20 template", "Download automatizzato", "Supporto prioritario"],
    cta: "Prova Pro", tier: "pro",
  },
  {
    name: "Enterprise", price: "€199", period: "/mese", popular: false,
    features: ["Tutto di Pro", "Multi-workspace", "Dominio custom", "Branding personalizzato", "2000+ crediti AI/mese", "SSO & RBAC avanzato", "SLA dedicato", "DPA GDPR incluso"],
    cta: "Contattaci", tier: "enterprise",
  },
];

export function LandingPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">WCA Network Navigator</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Funzionalità</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Prezzi</a>
            <a href="#demo" className="text-muted-foreground hover:text-foreground transition-colors">Demo</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Accedi</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Inizia Gratis</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center relative">
          <Badge variant="secondary" className="mb-4">
            <Zap className="h-3 w-3 mr-1" /> Powered by AI Agent
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-tight">
            La piattaforma AI per i{" "}
            <span className="text-primary">freight forwarder</span>{" "}
            che vogliono crescere
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Gestisci 12.000+ partner WCA, automatizza l'outreach multicanale e lascia che l'AI faccia il lavoro operativo. Dalla ricerca al contratto.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="gap-2 text-base">
                Inizia Gratis <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#demo">
              <Button size="lg" variant="outline" className="gap-2 text-base">
                <Play className="h-4 w-4" /> Guarda la Demo
              </Button>
            </a>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> 17 network globali</div>
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> 12.000+ partner</div>
            <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> 190+ paesi</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Tutto ciò che serve al tuo team</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Una piattaforma completa per la gestione dei partner logistici.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border/50 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <f.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Video */}
      <section id="demo" className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Guarda come funziona</h2>
          <p className="text-muted-foreground mb-8">2 minuti per scoprire come WCA Network Navigator trasforma il tuo workflow.</p>
          <div className="aspect-video bg-muted rounded-2xl border border-border/50 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Play className="h-16 w-16 text-primary/50 mx-auto" />
              <p className="text-sm text-muted-foreground">Video demo in arrivo</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Prezzi trasparenti</h2>
            <p className="mt-3 text-muted-foreground">Inizia gratis, scala quando sei pronto.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map((plan) => (
              <Card key={plan.name} className={cn(
                "relative flex flex-col",
                plan.popular && "border-primary ring-2 ring-primary/20"
              )}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Più popolare</Badge>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link to="/auth" className="w-full">
                    <Button variant={plan.popular ? "default" : "outline"} className="w-full">
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Network className="h-5 w-5 text-primary" />
                <span className="font-bold">WCA Network Navigator</span>
              </div>
              <p className="text-sm text-muted-foreground">La piattaforma AI per freight forwarder.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Prodotto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Funzionalità</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Prezzi</a></li>
                <li><a href="#demo" className="hover:text-foreground">Demo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Legale</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-foreground">Termini di Servizio</Link></li>
                <li><Link to="/dpa" className="hover:text-foreground">DPA GDPR</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Risorse</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/docs" className="hover:text-foreground">Documentazione</Link></li>
                <li><Link to="/v2" className="hover:text-foreground">Dashboard</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border/40 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} WCA Network Navigator. Tutti i diritti riservati.
          </div>
        </div>
      </footer>
    </div>
  );
}
