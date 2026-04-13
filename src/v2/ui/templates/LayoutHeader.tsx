/**
 * LayoutHeader — Desktop header bar with status, operator, actions
 */
import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../atoms/Button";
import { ConnectionStatusBar } from "@/components/layout/ConnectionStatusBar";
import { ActiveProcessIndicator } from "@/components/layout/ActiveProcessIndicator";
import { OperatorSelector } from "@/components/header/OperatorSelector";
import {
  Menu, ArrowRight, Plus, DatabaseZap, Activity,
  FlaskConical, Sparkles,
} from "lucide-react";

interface OutreachQueue {
  pendingCount: number;
  processing: boolean;
  paused: boolean;
  setPaused: (v: boolean) => void;
}

interface GlobalSyncState {
  nightPause: boolean;
  isNightTime: boolean;
  manualOverride: boolean;
  toggleNightPause: () => void;
  resumeMinutes: number;
}

interface Props {
  onToggleSidebar: () => void;
  onAiClick: () => void;
  onAddContact: () => void;
  onAgentDash: () => void;
  onTestExt: () => void;
  outreachQueue: OutreachQueue;
  globalSync: GlobalSyncState;
}

export function LayoutHeader({
  onToggleSidebar, onAiClick, onAddContact, onAgentDash, onTestExt,
  outreachQueue, globalSync,
}: Props): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="hidden md:flex h-11 items-center justify-between border-b border-border/40 bg-card/60 backdrop-blur-sm px-4 shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <Menu className="h-4 w-4" />
        </Button>
        <ActiveProcessIndicator />
        {location.pathname.startsWith("/v2/network") && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate("/v2/crm")}>
            <ArrowRight className="h-3 w-3" /> CRM
          </Button>
        )}
        {location.pathname.startsWith("/v2/crm") && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate("/v2/network")}>
            <ArrowRight className="h-3 w-3" /> Network
          </Button>
        )}
        <ConnectionStatusBar
          onAiClick={onAiClick}
          outreachQueue={outreachQueue}
          nightPause={globalSync.nightPause}
          isNightTime={globalSync.isNightTime}
          manualOverride={globalSync.manualOverride}
          onToggleNightPause={globalSync.toggleNightPause}
          resumeMinutes={globalSync.resumeMinutes}
        />
        <div id="campaign-header-controls" className="flex min-w-0 flex-1 items-center gap-2" />
      </div>
      <div className="flex items-center gap-0.5">
        <OperatorSelector />
        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={onAddContact} aria-label="Aggiungi contatto">
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={() => navigate("/v2/settings?tab=enrichment")} aria-label="Arricchimento">
          <DatabaseZap className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={onAgentDash} aria-label="Agent Operations">
          <Activity className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={onTestExt} aria-label="Test Estensioni">
          <FlaskConical className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={onAiClick} aria-label="IntelliFlow AI">
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
