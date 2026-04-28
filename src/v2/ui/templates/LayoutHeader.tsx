/**
 * LayoutHeader — Top bar compatta (post-decongestione).
 * Sinistra: ☰ menu, breadcrumb (delegato a GoldenHeaderBar di pagina), StatusPill.
 * Destra: NotificationCenter, OperatorSelector, ⋯ Strumenti, ✨ AI.
 *
 * Spostati altrove:
 *  - "Cerca rapida" → solo shortcut ⌘K (registrato globalmente).
 *  - VoiceLanguageSelector / AIAutomationToggle / TokenUsageCounter → /v2/settings.
 *  - DatabaseZap / Activity / FlaskConical / Add Contact → menu ⋯ Strumenti.
 *  - Pulsanti contestuali → CRM / → Network → rimossi (coperti da sidebar).
 */
import * as React from "react";
import { Button } from "../atoms/Button";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { OperatorSelector } from "@/components/header/OperatorSelector";
import { StatusPill } from "./header/StatusPill";
import { HeaderToolsMenu } from "./header/HeaderToolsMenu";
import { Menu, Sparkles } from "lucide-react";

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
  onOpenCommandPalette: () => void;
  onAiClick: () => void;
  onAddContact: () => void;
  onAgentDash: () => void;
  onTestExt: () => void;
  outreachQueue: OutreachQueue;
  globalSync: GlobalSyncState;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export function LayoutHeader({
  onToggleSidebar, onOpenCommandPalette, onAiClick, onAddContact, onAgentDash, onTestExt,
  outreachQueue, globalSync,
  isDark = false,
  onToggleTheme = () => {
    document.documentElement.classList.toggle("dark");
  },
}: Props): React.ReactElement {
  // onOpenCommandPalette è raggiungibile via ⌘K (registrato in AuthenticatedLayout)
  // e via ☰ tooltip; non occupa più spazio fisso nella barra.
  void onOpenCommandPalette;

  return (
    <header
      role="banner"
      data-testid="app-header"
      className="hidden md:flex h-11 items-center justify-between border-b border-border/40 bg-card/60 backdrop-blur-sm px-4 shrink-0"
    >
      {/* LEFT cluster */}
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar (⌘K per Cerca rapida)"
          title="Menu · ⌘K cerca rapida"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <StatusPill
          onAiClick={onAiClick}
          outreachQueue={outreachQueue}
          globalSync={globalSync}
        />

        {/* Slot dinamico per controlli pagina (campagne, ecc.) — riservato ma compresso */}
        <div id="campaign-header-controls" className="flex min-w-0 items-center gap-2" />
      </div>

      {/* RIGHT cluster — solo essenziale */}
      <div className="flex items-center gap-0.5 shrink-0">
        <NotificationCenter />
        <OperatorSelector />
        <HeaderToolsMenu
          onAddContact={onAddContact}
          onAgentDash={onAgentDash}
          onTestExt={onTestExt}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors"
          onClick={onAiClick}
          aria-label="IntelliFlow AI"
          title="IntelliFlow AI · ⌘J"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
