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
import { Menu } from "lucide-react";
import { MainMenu } from "./MainMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { OperationalContextSelector } from "@/components/header/OperationalContextSelector";
import { StatusPill } from "./header/StatusPill";
import { AutomationsPanel } from "./header/AutomationsPanel";
import { HeaderToolsMenu } from "./header/HeaderToolsMenu";
import { WhatsAppSyncButton } from "./header/WhatsAppSyncButton";
import { DownloadExtensionsButton } from "./header/DownloadExtensionsButton";
import { ExploreContextHeader } from "./explore/ExploreContextHeader";
import { useInitTheme } from "@/v2/ui/theme/ThemePicker";

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
  onAiClick?: () => void;
  onAddContact: () => void;
  onAgentDash: () => void;
  onTestExt: () => void;
  outreachQueue: OutreachQueue;
  globalSync: GlobalSyncState;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export function LayoutHeader({
  onOpenCommandPalette,
  onAiClick,
  onAddContact,
  onAgentDash,
  onTestExt,
  outreachQueue,
  globalSync,
  isDark = false,
  onToggleTheme = () => {
    document.documentElement.classList.toggle("dark");
  },
}: Props): React.ReactElement {
  // onOpenCommandPalette è raggiungibile via ⌘K (registrato in AuthenticatedLayout);
  // non occupa più spazio fisso nella barra.
  void onOpenCommandPalette;
  // onAiClick non è più esposto in header (IntelliFlow rimosso). Mantenuto in props
  // per retrocompatibilità con i call site; consumato altrove o ignorato.
  void onAiClick;
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
        {/* ☰ Menu globale — ora dentro la top bar (niente più overlap con il floating button) */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Apri menu"
              className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md text-primary hover:bg-primary/10 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" side="bottom" className="flex h-[min(72vh,640px)] w-72 flex-col overflow-hidden p-0">
            <MainMenu />
          </PopoverContent>
        </Popover>

        {/* Header contestuale per la sezione Esplora (auto-nascosto altrove) */}
        <ExploreContextHeader />

        {/* Slot per PageTitleHeader (riempito via Portal dalle pagine che lo montano esplicitamente) */}
        <div id="page-title-slot" className="flex min-w-0 items-center gap-2" />

        {/* Slot dinamico per controlli pagina (campagne, ecc.) — riservato ma compresso */}
        <div id="campaign-header-controls" className="flex min-w-0 items-center gap-2" />
      </div>

      {/* CENTER — slot ricerca della maschera corrente (riempito via Portal) */}
      <div id="page-search-slot" className="flex min-w-0 flex-[1.2] items-center justify-center px-3" />

      {/* RIGHT cluster — stato, automazioni e strumenti (tutte le icone qui) */}
      <div className="flex items-center gap-0.5 shrink-0">
        <StatusPill onAiClick={onAiClick ?? (() => {})} outreachQueue={outreachQueue} globalSync={globalSync} />
        <AutomationsPanel />
        <NotificationCenter />
        <DownloadExtensionsButton />
        <WhatsAppSyncButton />
        <OperationalContextSelector />
        <HeaderToolsMenu
          onAddContact={onAddContact}
          onAgentDash={onAgentDash}
          onTestExt={onTestExt}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
        />
      </div>
    </header>
  );
}
