/**
 * SimpleHomePage — Menu esclusivo del "nuovo sistema semplificato".
 *
 * Vive sotto `/app` (routing separato da /v2/*). NON modifica nessuna pagina
 * esistente: ogni voce di menu è un link diretto alle pagine già funzionanti
 * in /v2/*. La voce "Sistema avanzato" porta all'intero set legacy.
 *
 * Aggiungere nuove voci = aggiungere oggetti a `ENTRIES` qui sotto. Niente
 * altro da toccare.
 */
import { Link, Navigate } from "react-router-dom";
import { Home, Users, Mail, Bot, LayoutGrid, ArrowRight } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Entry = {
  to: string;
  label: string;
  desc: string;
  icon: typeof Home;
};

const ENTRIES: ReadonlyArray<Entry> = [
  { to: "/v2/dashboard", label: "Home",       desc: "Riepilogo giornata e azioni",            icon: Home },
  { to: "/v2/explore/contacts", label: "Contatti",   desc: "Rubrica unificata, biglietti, lead", icon: Users },
  { to: "/v2/cockpit", label: "Messaggi",   desc: "Email, WhatsApp, LinkedIn",            icon: Mail },
  { to: "/v2/intelligence/agents", label: "Agenti", desc: "Chat e missioni AI",                  icon: Bot },
];

export default function SimpleHomePage() {
  const { status } = useAuth();
  if (status === "loading") return <PageSkeleton />;
  if (status === "unauthenticated") return <Navigate to="/v2/login" replace />;

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Comando rapido</h1>
            <p className="text-xs text-muted-foreground">Le azioni che usi ogni giorno.</p>
          </div>
          <Link
            to="/v2/command"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Sistema avanzato
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ENTRIES.map((e) => {
            const Icon = e.icon;
            return (
              <Link key={e.to} to={e.to} className="group focus:outline-none">
                <Card className={cn(
                  "transition-all border-border/60",
                  "hover:border-primary/40 hover:shadow-md focus-within:ring-2 focus-within:ring-primary/40",
                )}>
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 text-primary p-2.5 group-hover:bg-primary/15 transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-medium tracking-tight">{e.label}</h2>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{e.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground/70 mt-8 text-center">
          Aggiungeremo nuove voci qui in funzione delle necessità di sviluppo. Tutto il resto resta
          accessibile da <Link to="/v2/command" className="underline hover:text-foreground">Sistema avanzato</Link>.
        </p>
      </main>
    </div>
  );
}