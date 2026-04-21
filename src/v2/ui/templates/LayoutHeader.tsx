/**
 * LayoutHeader — Desktop header bar with status, operator, actions
 */
import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../atoms/Button";
import { ConnectionStatusBar } from "@/components/layout/ConnectionStatusBar";
import { ActiveProcessIndicator } from "@/components/layout/ActiveProcessIndicator";
import { OperatorSelector } from "@/components/header/OperatorSelector";
import { AIAutomationToggle } from "@/components/header/AIAutomationToggle";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { VOICE_LANGUAGE_MAP, VOICE_LANG_KEYS } from "@/components/voice/VoiceLanguageSelector";
import {
  Menu, ArrowRight, Plus, DatabaseZap, Activity,
  FlaskConical, Sparkles, WifiOff, Globe2,
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
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [voiceLang, setVoiceLang] = useState<string>("it");

  useEffect(() => {
    const savedLang = settings?.elevenlabs_language;
    if (savedLang && VOICE_LANGUAGE_MAP[savedLang]) {
      setVoiceLang(savedLang);
    }
  }, [settings?.elevenlabs_language]);

  const cycleLang = useCallback(() => {
    const idx = VOICE_LANG_KEYS.indexOf(voiceLang);
    const next = VOICE_LANG_KEYS[(idx + 1) % VOICE_LANG_KEYS.length];
    setVoiceLang(next);
    updateSetting.mutate({ key: "elevenlabs_language", value: next });
  }, [voiceLang, updateSetting]);

  const langConfig = VOICE_LANGUAGE_MAP[voiceLang] || VOICE_LANGUAGE_MAP.it;

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
        <AIAutomationToggle />
        <button
          onClick={cycleLang}
          disabled={updateSetting.isPending}
          className="mr-1 flex h-7 items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/20 px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-foreground backdrop-blur-sm transition-all hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
          title={`Lingua vocale: ${langConfig.label}`}
          aria-label={`Cambia lingua vocale, attuale ${langConfig.label}`}
        >
          <Globe2 className="w-3 h-3" />
          <span>{langConfig.flag}</span>
          <span>{voiceLang.toUpperCase()}</span>
        </button>
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
