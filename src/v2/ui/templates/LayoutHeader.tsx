/**
 * LayoutHeader — Desktop header bar with status, operator, actions
 */
import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../atoms/Button";
import { ConnectionStatusBar } from "@/components/layout/ConnectionStatusBar";
import { ActiveProcessIndicator } from "@/components/layout/ActiveProcessIndicator";
import { OperatorSelector } from "@/components/header/OperatorSelector";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  Menu, ArrowRight, Plus, DatabaseZap, Activity,
  FlaskConical, Sparkles, WifiOff,
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
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();

  return (
    <header role="banner" data-testid="app-header" className="hidden md:flex h-11 items-center justify-between border-b border-border/40 bg-card/60 backdrop-blur-sm px-4 shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <Menu className="h-4 w-4" />
        </Button>
        <ActiveProcessIndicator />
        {!isOnline && (
          <div className="flex items-center gap-1 text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
            <WifiOff className="h-3 w-3" />
            Offline
          </div>
        )}
        {location.pathname.startsWith("/v2/network") && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate("/v2/crm")}>
            <ArrowRight className="h-3 w-3" /> {t("nav.crm")}
          </Button>
        )}
        {location.pathname.startsWith("/v2/crm") && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate("/v2/network")}>
            <ArrowRight className="h-3 w-3" /> {t("nav.network")}
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
        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={onAddContact} aria-label={t("common.add_contact")}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={() => navigate("/v2/settings?tab=enrichment")} aria-label={t("common.enrichment")}>
          <DatabaseZap className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={onAgentDash} aria-label={t("common.agent_operations")}>
          <Activity className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={onTestExt} aria-label={t("common.test_extensions")}>
          <FlaskConical className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors" onClick={onAiClick} aria-label="IntelliFlow AI">
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
