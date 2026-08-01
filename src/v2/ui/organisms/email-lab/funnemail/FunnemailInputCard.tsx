/**
 * FunnemailInputCard — Form di input per la simulazione dry-run.
 * UI logic-less: tutta la logica vive in useFunnemailSimulation.
 */
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Play, RotateCcw } from "lucide-react";

interface Props {
  loading: boolean;
  onRun: (input: { from: string; subject: string; body: string }) => void;
  onReset: () => void;
  hasResult: boolean;
}

const SAMPLES: Array<{ label: string; from: string; subject: string; body: string }> = [
  {
    label: "Lead interessato",
    from: "marco.rossi@logiplus.it",
    subject: "Re: Proposta servizi spedizioni 2026",
    body: "Buongiorno,\n\ngrazie per la proposta. Siamo interessati a capire meglio le tariffe per le spedizioni intercontinentali. Possiamo fissare una call la prossima settimana?\n\nCordiali saluti,\nMarco",
  },
  {
    label: "Out of office",
    from: "anna@partner.com",
    subject: "Auto: Out of office",
    body: "Sono fuori ufficio fino al 25/05. Per urgenze contattare il collega Luigi.",
  },
  {
    label: "Spam",
    from: "winner@lottery-xyz.tk",
    subject: "🎉 You won $1,000,000",
    body: "Click here to claim your prize now!!! Limited offer!",
  },
];

export function FunnemailInputCard({ loading, onRun, onReset, hasResult }: Props): React.ReactElement {
  const [from, setFrom] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");

  const loadSample = (s: typeof SAMPLES[number]) => {
    setFrom(s.from); setSubject(s.subject); setBody(s.body);
  };

  const canRun = from.trim().length > 3 && body.trim().length > 5 && !loading;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Email da simulare</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground self-center mr-1">Esempi:</span>
          {SAMPLES.map((s) => (
            <Button key={s.label} size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => loadSample(s)} disabled={loading}>
              {s.label}
            </Button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sim-from" className="text-xs">Mittente</Label>
          <Input id="sim-from" value={from} onChange={(e) => setFrom(e.target.value)}
            placeholder="nome@dominio.com" disabled={loading} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sim-subject" className="text-xs">Oggetto</Label>
          <Input id="sim-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="Oggetto email" disabled={loading} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sim-body" className="text-xs">Corpo</Label>
          <Textarea id="sim-body" value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Testo dell'email..." rows={8} disabled={loading} />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 gap-2" disabled={!canRun}
            onClick={() => onRun({ from: from.trim(), subject: subject.trim(), body: body.trim() })}>
            {loading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Simulazione…</>
              : <><Play className="h-3.5 w-3.5" /> Simula smistamento</>}
          </Button>
          {hasResult && (
            <Button variant="outline" size="icon" onClick={onReset} disabled={loading}
              title="Reset">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Dry-run: nessuna scrittura su CRM/contatti/email reali. Solo trace su pipeline_traces.
        </p>
      </CardContent>
    </Card>
  );
}