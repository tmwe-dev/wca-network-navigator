/**
 * FunnemailHubPage — landing "Tutto quello che puoi fare con Funnemail".
 * 5 card di ingresso che instradano verso le funzioni esistenti.
 * Zero logica: pura navigazione. Mantiene tutte le funzionalità V2.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { Sparkles, Inbox, Wand2, Users, BarChart3, Settings2, ArrowRight, ListChecks } from "lucide-react";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { FunnemailGlassCard } from "@/v2/ui/atoms/funnemail/FunnemailGlassCard";

interface HubCard {
  readonly to: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly title: string;
  readonly desc: string;
  readonly accent: string;
}

const CARDS: readonly HubCard[] = [
  {
    to: "/v2/funnemail-inbox",
    icon: Inbox,
    title: "Posta in arrivo",
    desc: "Leggi e gestisci le mail classificate dall'AI per cartella.",
    accent: "text-primary",
  },
  {
    to: "/v2/funnemail-inbox/sorting",
    icon: ListChecks,
    title: "Da smistare",
    desc: "Coda dei messaggi a bassa confidenza che chiedono il tuo controllo.",
    accent: "text-warning",
  },
  {
    to: "/v2/funnemail/playground",
    icon: Wand2,
    title: "Mail Playground",
    desc: "Scrivi e prova un'email con preset di tono e regole automatiche.",
    accent: "text-accent-foreground",
  },
  {
    to: "/v2/email-intelligence",
    icon: Users,
    title: "Cataloga mittenti",
    desc: "Gruppi, regole AI e suggerimenti per smistare ogni mittente.",
    accent: "text-secondary",
  },
  {
    to: "/v2/funnemail/statistiche-mittenti",
    icon: BarChart3,
    title: "Statistiche mittenti",
    desc: "Volumi, accuracy e mittenti più attivi visti dall'AI.",
    accent: "text-success",
  },
  {
    to: "/v2/email-intelligence?tab=rules",
    icon: Settings2,
    title: "Impostazioni avanzate",
    desc: "Regole, routing, eval e cache scout per chi configura Funnemail.",
    accent: "text-muted-foreground",
  },
];

export default function FunnemailHubPage(): React.ReactElement {
  React.useEffect(() => {
    const prev = document.title;
    document.title = "Funnemail · Tutto quello che puoi fare";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageTitleHeader
        icon={Sparkles}
        title="Funnemail"
        subtitle="Tutto quello che puoi fare"
      />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-8">
          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Il tuo centro email, governato dall'AI
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Sei card, sei modi per usare Funnemail. Apri, scrivi, classifica e misura:
              ogni funzione è collegata al motore di smistamento, alle regole e ai prompt che hai configurato.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <Link key={c.to} to={c.to} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
                  <FunnemailGlassCard hover className="h-full p-5">
                    <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ${c.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{c.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
                    <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-70 transition-opacity group-hover:opacity-100">
                      Apri <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </FunnemailGlassCard>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export { FunnemailHubPage };