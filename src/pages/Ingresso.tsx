/**
 * Ingresso — porta d'accesso con due vie: V3 (operativo) e V2 (completo).
 *
 * Nessuna logica di business: solo scelta di destinazione. Le due versioni
 * restano entrambe attive e raggiungibili in ogni momento.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass, Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Porta = {
  readonly to: string;
  readonly titolo: string;
  readonly sottotitolo: string;
  readonly descrizione: string;
  readonly voci: readonly string[];
  readonly icona: React.ReactNode;
};

const PORTE: readonly Porta[] = [
  {
    to: "/v3/inbox",
    titolo: "Operativo",
    sottotitolo: "V3",
    descrizione: "Il ciclo del messaggio: contatti, inbox, comprensione, risposta, tracciamento.",
    voci: ["Inbox e conversazioni", "Contatti e pipeline", "Approvazioni e coda", "Command"],
    icona: <Compass className="h-5 w-5" aria-hidden="true" />,
  },
  {
    to: "/v2/command",
    titolo: "Completo",
    sottotitolo: "V2",
    descrizione: "Acquisizione lead, laboratorio AI, diagnostica e tutte le superfici storiche.",
    voci: ["Acquisizione e scraping", "Prompt Lab e Knowledge Base", "Osservabilità e telemetria", "Galassia di sistema"],
    icona: <Layers className="h-5 w-5" aria-hidden="true" />,
  },
];

export default function Ingresso(): React.ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-3xl space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">WCA Network Navigator</h1>
          <p className="text-sm text-muted-foreground">Scegli da dove entrare. Puoi passare da una all'altra in qualsiasi momento.</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {PORTE.map((porta) => (
            <Link
              key={porta.to}
              to={porta.to}
              className="group rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="h-full transition-colors group-hover:border-primary/60">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      {porta.icona}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {porta.sottotitolo}
                    </span>
                  </div>
                  <CardTitle className="text-lg">{porta.titolo}</CardTitle>
                  <CardDescription>{porta.descrizione}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {porta.voci.map((voce) => (
                      <li key={voce}>· {voce}</li>
                    ))}
                  </ul>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Entra
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
