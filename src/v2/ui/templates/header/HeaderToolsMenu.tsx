/**
 * HeaderToolsMenu — Dropdown "Strumenti" che raccoglie azioni secondarie
 * (Agent Ops, Enrichment, Test Extensions, Trace Console, Tema).
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal, Activity, DatabaseZap, FlaskConical, Stethoscope,
  Sun, Moon, Plus,
} from "lucide-react";

interface Props {
  onAddContact: () => void;
  onAgentDash: () => void;
  onTestExt: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function HeaderToolsMenu({
  onAddContact, onAgentDash, onTestExt, isDark, onToggleTheme,
}: Props): React.ReactElement {
  const navigate = useNavigate();

  const openTraceConsole = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("trace-console-open"));
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-foreground/70 hover:text-primary"
          aria-label="Strumenti"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Azioni
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={onAddContact}>
          <Plus className="h-4 w-4 mr-2" /> Nuovo contatto
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAgentDash}>
          <Activity className="h-4 w-4 mr-2" /> Agent Operations
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/v2/settings?tab=enrichment")}>
          <DatabaseZap className="h-4 w-4 mr-2" /> Enrichment Center
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Debug
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={openTraceConsole}>
          <Stethoscope className="h-4 w-4 mr-2" /> Trace Console
          <span className="ml-auto text-[10px] text-muted-foreground">⌘⇧T</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onTestExt}>
          <FlaskConical className="h-4 w-4 mr-2" /> Test Estensioni
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggleTheme}>
          {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
          Tema {isDark ? "chiaro" : "scuro"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}