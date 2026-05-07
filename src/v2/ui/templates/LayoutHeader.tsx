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
import { useLocation } from "react-router-dom";
import { Button } from "../atoms/Button";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { OperatorSelector } from "@/components/header/OperatorSelector";
import { MailboxSelector } from "@/components/header/MailboxSelector";
import { StatusPill } from "./header/StatusPill";
import { HeaderToolsMenu } from "./header/HeaderToolsMenu";
import { WhatsAppSyncButton } from "./header/WhatsAppSyncButton";
import { ExploreContextHeader } from "./explore/ExploreContextHeader";
import { NavMenuPopover } from "./NavMenuPopover";
import { AutoPageTitle } from "./header/AutoPageTitle";
import { Menu, Sparkles } from "lucide-react";
import { ThemePicker, useInitTheme } from "@/v2/ui/theme/ThemePicker";

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
  /** @deprecated Sidebar laterale rimossa: il bottone ☰ ora apre il NavMenuPopover globale. Mantenuto per compatibilità con i call site. */
  onToggleSidebar?: () => void;
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
  onOpenCommandPalette, onAiClick, onAddContact, onAgentDash, onTestExt,
  outreachQueue, globalSync,
  isDark = false,
  onToggleTheme = () => {
    document.documentElement.classList.toggle("dark");
  },
}: Props): React.ReactElement {
  // onOpenCommandPalette è raggiungibile via ⌘K (registrato in AuthenticatedLayout);
  // non occupa più spazio fisso nella barra.
  void onOpenCommandPalette;
  const { pathname } = useLocation();
  useInitTheme();

  return (
    <header
      role="banner"
      data-testid="app-header"
      className="hidden md:flex h-11 items-center justify-between border-b border-border/40 bg-card/60 backdrop-blur-sm px-4 shrink-0"
    >
      {/* LEFT cluster */}
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <NavMenuPopover currentPath={pathname} align="start">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label="Apri menu di navigazione"
            title="Menu · ⌘K cerca rapida"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </NavMenuPopover>

        <StatusPill
          onAiClick={onAiClick}
          outreachQueue={outreachQueue}
          globalSync={globalSync}
        />

        {/* Header contestuale per la sezione Esplora (auto-nascosto altrove) */}
        <ExploreContextHeader />

        {/* Slot per PageTitleHeader (Cockpit, Inbox, Email, ecc.) — riempito via Portal */}
        <div id="page-title-slot" className="flex min-w-0 items-center gap-2">
          <AutoPageTitle />
        </div>

        {/* Slot dinamico per controlli pagina (campagne, ecc.) — riservato ma compresso */}
        <div id="campaign-header-controls" className="flex min-w-0 items-center gap-2" />
      </div>

      {/* RIGHT cluster — solo essenziale */}
      <div className="flex items-center gap-0.5 shrink-0">
        <NotificationCenter />
        <ThemePicker variant="icon" />
        <WhatsAppSyncButton />
        <OperatorSelector />
        <MailboxSelector />
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
