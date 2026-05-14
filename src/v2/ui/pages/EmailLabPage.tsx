/**
 * EmailLabPage — banco di prova per le email AI.
 * Layout pilota: header chiaro con "Cosa testi qui in 3 passi" + toggle a 2
 * stati (Produzione / Smistamento) + workflow lineare verticale dentro ogni
 * modalità. Niente sub-tab nascoste, niente banner ingombranti.
 *
 * Route: /v2/email-lab  (montato anche dentro /v2/lab → Email Lab)
 */
import * as React from "react";
import { Wand2, Inbox, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductionTab } from "./email-lab/ProductionTab";
import { FunnemailTab } from "./email-lab/FunnemailTab";
import { ToolsBanner } from "./email-lab/ToolsBanner";

type Mode = "production" | "funnemail";

export function EmailLabPage(): React.ReactElement {
  const [mode, setMode] = React.useState<Mode>("production");
  const [toolsOpen, setToolsOpen] = React.useState(false);

  return (
    <div className="flex h-full flex-col gap-5 p-5">
      {/* HEADER + spiegazione 3 passi */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-xl font-semibold tracking-tight">Banco di prova email</h1>
          <p className="mt-1 text-sm text-foreground/70">
            Genera o smista un'email finta e vedi come la produce/classifica l'AI. Nessuna scrittura
            su CRM, contatti o caselle reali.
          </p>
          <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/65">
            <li className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">1</span>
              Scegli uno scenario o partiamo da bianco
            </li>
            <span className="text-foreground/30">→</span>
            <li className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">2</span>
              Configura destinatario e tipo
            </li>
            <span className="text-foreground/30">→</span>
            <li className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">3</span>
              Lancia e confronta le iterazioni
            </li>
          </ol>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-foreground/70"
          onClick={() => setToolsOpen((v) => !v)}
          aria-expanded={toolsOpen}
        >
          <Wrench className="h-3.5 w-3.5" />
          Strumenti collegati
        </Button>
      </header>

      {toolsOpen ? <ToolsBanner /> : null}

      {/* TOGGLE MODALITÀ — grosso, chiaro, 2 stati */}
      <div
        role="tablist"
        aria-label="Modalità banco di prova"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <ModeCard
          active={mode === "production"}
          onClick={() => setMode("production")}
          icon={<Wand2 className="h-5 w-5" />}
          title="Produzione email"
          desc="L'AI scrive una bozza per un destinatario, poi la migliora versione dopo versione."
        />
        <ModeCard
          active={mode === "funnemail"}
          onClick={() => setMode("funnemail")}
          icon={<Inbox className="h-5 w-5" />}
          title="Smistamento Funnemail"
          desc="Simula un'email in arrivo: classificazione, scout mittente, route, policy — stage per stage."
        />
      </div>

      {/* WORKFLOW della modalità attiva */}
      <div className="min-h-0 flex-1">
        {mode === "production" ? <ProductionTab /> : <FunnemailTab />}
      </div>
    </div>
  );
}

function ModeCard({
  active, onClick, icon, title, desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 rounded-lg border bg-card/40 p-4 text-left transition",
        active
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
          : "border-border/60 hover:border-primary/40 hover:bg-primary/5",
      )}
    >
      <span className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
        active ? "bg-primary/20 text-primary" : "bg-muted text-foreground/70 group-hover:text-primary",
      )}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-foreground/65">{desc}</span>
      </span>
    </button>
  );
}

export default EmailLabPage;