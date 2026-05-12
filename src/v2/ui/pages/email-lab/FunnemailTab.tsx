/**
 * FunnemailTab — placeholder per Round B.
 * Mostra cosa farà la simulazione di smistamento (timeline stage-by-stage)
 * e linka subito a /v2/pipeline-traces (vista live già funzionante) come
 * fallback finché l'edge `simulate-funnemail-classify` non è pronta.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, Construction } from "lucide-react";

export function FunnemailTab(): React.ReactElement {
  return (
    <div className="space-y-4">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Construction className="h-4 w-4 text-amber-400" />
          <CardTitle className="text-sm">Round B — in arrivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-foreground/80">
          <p>
            Qui potrai compilare un'email finta (mittente, oggetto, body) e vedere il "viaggio"
            stage-by-stage: injection guard, classificazione AI, scout mittente, auto-route, policy
            engine, triage. Ogni step mostrerà prompt usato, output AI, durata e azioni proposte —
            senza scrivere niente nel database reale.
          </p>
          <p className="text-foreground/65">
            Richiede una nuova edge <code className="rounded bg-muted px-1">simulate-funnemail-classify</code>
            (read-only wrapper di <code className="rounded bg-muted px-1">classify-inbound-message</code>):
            la consegno nel prossimo round.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Nel frattempo: Pipeline Traces (live)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-foreground/75">
          <p>
            Le pipeline reali di smistamento Funnemail sono già tracciate stage-by-stage.
            Vai alla pagina Pipeline Traces e filtra per <code className="rounded bg-muted px-1">classify-inbound-message</code>
            o per uno dei suoi stage: <code className="rounded bg-muted px-1">classified</code>,
            <code className="rounded bg-muted px-1">scouted</code>,
            <code className="rounded bg-muted px-1">routed</code>,
            <code className="rounded bg-muted px-1">policy_applied</code>.
          </p>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/v2/pipeline-traces">
              <Activity className="h-3.5 w-3.5" />
              Apri Pipeline Traces
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}