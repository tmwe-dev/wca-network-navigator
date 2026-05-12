/**
 * ToolsBanner — banner collassabile con i link agli strumenti già esistenti
 * per gestire prompt, test, audit e tracing del sistema.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown, ChevronRight, Library, BookOpen, FlaskConical, GitBranch,
  Activity, MessageCircle, Wand2, Sparkles,
} from "lucide-react";

const TOOLS = [
  { to: "/v2/ai-staff/prompt-lab", icon: Library, label: "Prompt Lab", desc: "Editor prompt operativi, personas, capabilities, routing, journalist." },
  { to: "/v2/prompt-lab/catalog", icon: BookOpen, label: "Catalogo prompt", desc: "Vista unificata dei prompt operativi con versione e orchestratori." },
  { to: "/v2/prompt-lab/tests", icon: FlaskConical, label: "Test prompt", desc: "Scenari salvati con assertions pass/fail." },
  { to: "/v2/ai-test-hub", icon: Sparkles, label: "AI Test Hub", desc: "Esecuzione massiva di scenari sulle edge AI." },
  { to: "/v2/prompt-lab/atlas", icon: GitBranch, label: "Agent Atlas", desc: "Mappa visuale degli agenti e delle loro capacità." },
  { to: "/v2/pipeline-traces", icon: Activity, label: "Pipeline Traces", desc: "Stage-by-stage di tutte le edge function (live, per trace, per step)." },
  { to: "/v2/ai-interactions-log", icon: MessageCircle, label: "AI Interaction Log", desc: "Storico messaggi AI con feedback thumbs e export." },
  { to: "/v2/email/forge", icon: Wand2, label: "Email Forge", desc: "Lab AI singolo-shot con override prompt." },
];

export function ToolsBanner(): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  return (
    <Card className="border-primary/20 bg-card/60">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="h-auto w-full justify-start gap-2 rounded-md px-3 py-2 text-left">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground/90">Strumenti già attivi sui prompt</div>
              <div className="text-xs text-foreground/60">8 pagine collegate per editing, versioning, test, tracing e log dei prompt.</div>
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="grid gap-2 pt-0 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((t) => (
              <Link key={t.to} to={t.to} className="group rounded-md border border-border/50 bg-background/40 p-3 transition hover:border-primary/40 hover:bg-primary/5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/90 group-hover:text-foreground">
                  <t.icon className="h-4 w-4 text-primary" />
                  {t.label}
                </div>
                <div className="mt-1 text-[11px] leading-snug text-foreground/60">{t.desc}</div>
              </Link>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}