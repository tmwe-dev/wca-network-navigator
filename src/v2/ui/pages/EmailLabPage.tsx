/**
 * EmailLabPage — banco di prova per le email AI.
 * Layout pilota: header chiaro con "Cosa testi qui in 3 passi" + toggle a 2
 * stati (Produzione / Smistamento) + workflow lineare verticale dentro ogni
 * modalità. Niente sub-tab nascoste, niente banner ingombranti.
 *
 * Route: /v2/email-lab  (montato anche dentro /v2/lab → Email Lab)
 */
import * as React from "react";
import { Wand2, Inbox, Wrench, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductionTab } from "./email-lab/ProductionTab";
import { FunnemailTab } from "./email-lab/FunnemailTab";
import { ToolsBanner } from "./email-lab/ToolsBanner";

type Mode = "production" | "funnemail";

export function EmailLabPage(): React.ReactElement {
  const [mode, setMode] = React.useState<Mode>("production");
  const [toolsOpen, setToolsOpen] = React.useState(false);

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      {/* HEADER COMPATTO — una sola riga */}
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-base font-semibold tracking-tight">Banco di prova email</h1>

        {/* Info popup con descrizione + 3 passi */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/60" aria-label="Cos'è questa pagina">
              <Info className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 text-sm">
            <p className="text-foreground/80">
              Genera o smista un'email finta e vedi come la produce/classifica l'AI.
              Nessuna scrittura su CRM, contatti o caselle reali.
            </p>
            <ol className="mt-3 space-y-1.5 text-xs text-foreground/70">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">1</span>
                Scegli uno scenario o parti da bianco
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">2</span>
                Configura destinatario e tipo
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">3</span>
                Lancia e confronta le iterazioni
              </li>
            </ol>
          </PopoverContent>
        </Popover>

        {/* Modalità: dropdown */}
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger className="h-8 w-[230px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="production">
              <span className="inline-flex items-center gap-2">
                <Wand2 className="h-3.5 w-3.5" /> Produzione email
              </span>
            </SelectItem>
            <SelectItem value="funnemail">
              <span className="inline-flex items-center gap-2">
                <Inbox className="h-3.5 w-3.5" /> Smistamento Funnemail
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-foreground/70"
            onClick={() => setToolsOpen((v) => !v)}
            aria-expanded={toolsOpen}
          >
            <Wrench className="h-3.5 w-3.5" />
            Strumenti collegati
          </Button>
        </div>
      </header>

      {toolsOpen ? <ToolsBanner /> : null}

      {/* WORKFLOW della modalità attiva */}
      <div className="min-h-0 flex-1">
        {mode === "production" ? <ProductionTab /> : <FunnemailTab />}
      </div>
    </div>
  );
}

export default EmailLabPage;