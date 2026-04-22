/**
 * SettingsPage V2 — Standalone V1 content migration (NO wrapper)
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Settings as SettingsIcon, Brain, Link, Download, FileText, Volume2, Users, Mail, Image, Database, Shield, Briefcase, Clock, Cpu, Package, Bell, Square as LogSquare, KeyRound, UsersRound, Coins } from "lucide-react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import AICommandCenter from "@/components/settings/AICommandCenter";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { ConnectionsSettings } from "@/components/settings/ConnectionsSettings";
import { ImportExportSettings } from "@/components/settings/ImportExportSettings";
import { RASettings } from "@/components/settings/RASettings";
import { ElevenLabsSettings } from "@/components/settings/ElevenLabsSettings";
import { AIProviderSettings } from "@/components/settings/AIProviderSettings";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import OperatorsSettings from "@/components/settings/OperatorsSettingsPanel";
import EmailDownloadPage from "@/components/settings/EmailDownloadPanel";
import EnrichmentSettings from "@/components/settings/EnrichmentSettings";
import OperativeJobsBoard from "@/components/settings/OperativeJobsBoard";
import MemoryDashboard from "@/components/ai/MemoryDashboard";
import TimingSettings from "@/components/settings/TimingSettings";
import AdminUsers from "@/components/settings/AdminUsersPanel";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { BackupExportTab } from "@/components/settings/BackupExportTab";
import { useMissionDrawerEvents } from "@/hooks/useMissionDrawerEvents";
import { toast } from "sonner";
import { NotificationPreferences } from "@/components/settings/NotificationPreferences";
import { AuditTrailPanel } from "@/components/audit/AuditTrailPanel";
import { TokenSettingsPanel } from "@/components/ai-control/TokenSettingsPanel";
import RoleManagementPanel from "@/components/settings/RoleManagementPanel";
import UserRolesPanel from "@/components/settings/UserRolesPanel";
import TeamManagementPanel from "@/components/settings/TeamManagementPanel";
import { PermissionGate } from "@/components/auth/PermissionGate";

export function SettingsPage() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get("tab") || "generale");

  useMissionDrawerEvents({
    "enrichment-batch-start": () => {
      window.dispatchEvent(new CustomEvent("settings-trigger-enrichment-batch"));
      toast.info("Avvio batch enrichment", { description: "Vai su Settings → Arricchimento per monitorare il job." });
    },
    "enrichment-export": () => {
      window.dispatchEvent(new CustomEvent("settings-trigger-enrichment-export"));
      toast.info("Export enrichment", { description: "File CSV in preparazione." });
    },
  });

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setTab(t);
  }, [searchParams]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const tabs: VerticalTab[] = [
    { value: "generale", label: "Generale", icon: SettingsIcon },
    { value: "ai-prompt", label: "AI & Prompt", icon: Brain },
    { value: "guida-operativa", label: "Jobs Operativi", icon: Briefcase },
    { value: "wca", label: "Connessioni", icon: Link },
    { value: "voce-ai", label: "Voce AI", icon: Volume2 },
    { value: "provider-ai", label: "Provider AI", icon: Cpu },
    { value: "import-export", label: "Importa", icon: Download },
    { value: "download-email", label: "Download Email", icon: Mail },
    { value: "reportaziende", label: "Report Aziende", icon: FileText },
    { value: "enrichment", label: "Arricchimento", icon: Image },
    { value: "memoria-ai", label: "Memoria AI", icon: Database },
    { value: "operatori", label: "Operatori", icon: Users },
    { value: "utenti", label: "Utenti Autorizzati", icon: Shield },
    { value: "timing", label: "Timing & Schedule", icon: Clock },
    { value: "token-ai", label: "Token AI", icon: Coins },
    { value: "notifiche", label: "Notifiche", icon: Bell },
    { value: "ruoli", label: "Ruoli & Permessi", icon: KeyRound },
    { value: "ruoli-utenti", label: "Ruoli Utenti", icon: UsersRound },
    { value: "team", label: "Team", icon: Users },
    { value: "audit", label: "Audit Trail", icon: LogSquare },
    { value: "backup-export", label: "Backup & Export", icon: Package },
  ];

  return (
    <div data-testid="page-settings" className="flex h-full min-h-0 overflow-hidden">
      <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} />
      <div className={cn("flex-1 min-w-0", tab === "download-email" ? "overflow-hidden" : "overflow-auto p-4")}>
        {tab === "download-email" ? (
          <EmailDownloadPage />
        ) : (
          <div className="max-w-4xl">
            {tab === "generale" && (
              <div className="space-y-4">
                <div className="float-panel p-5">
                  <GeneralSettings settings={settings} updateSetting={updateSetting} />
                </div>
                <div className="float-panel p-5">
                  <LanguageSwitcher />
                </div>
              </div>
            )}
            {tab === "wca" && (
              <div className="float-panel p-5">
                <ConnectionsSettings settings={settings} updateSetting={updateSetting} />
              </div>
            )}
            {tab === "voce-ai" && (
              <div className="float-panel p-5">
                <ElevenLabsSettings settings={settings} updateSetting={updateSetting} />
              </div>
            )}
            {tab === "provider-ai" && (
              <div className="float-panel p-5">
                <AIProviderSettings settings={settings} updateSetting={updateSetting} />
              </div>
            )}
            {tab === "import-export" && (
              <div className="float-panel p-5">
                <ImportExportSettings />
              </div>
            )}
            {tab === "reportaziende" && (
              <div className="float-panel p-5">
                <RASettings settings={settings} updateSetting={updateSetting} />
              </div>
            )}
            {tab === "ai-prompt" && (
              <div className="float-panel p-5">
                <AICommandCenter />
              </div>
            )}
            {tab === "operatori" && <OperatorsSettings />}
            <PermissionGate permission="settings.manage_users" fallback={<div className="float-panel p-5"><p className="text-sm text-muted-foreground">Non hai il permesso per accedere a questa sezione.</p></div>}>
              {tab === "utenti" && <AdminUsers />}
            </PermissionGate>
            {tab === "enrichment" && <EnrichmentSettings />}
            {tab === "memoria-ai" && (
              <div className="float-panel p-5">
                <MemoryDashboard />
              </div>
            )}
            {tab === "guida-operativa" && (
              <div className="float-panel p-5">
                <OperativeJobsBoard />
              </div>
            )}
            {tab === "timing" && (
              <div className="float-panel p-5">
                <TimingSettings />
              </div>
            )}
            {tab === "token-ai" && (
              <div className="float-panel p-5">
                <TokenSettingsPanel />
              </div>
            )}
            {tab === "notifiche" && (
              <div className="float-panel p-5">
                <NotificationPreferences />
              </div>
            )}
            <PermissionGate permission="settings.manage_roles" fallback={<div className="float-panel p-5"><p className="text-sm text-muted-foreground">Non hai il permesso per accedere a questa sezione.</p></div>}>
              {tab === "ruoli" && (
                <div className="float-panel p-5">
                  <RoleManagementPanel />
                </div>
              )}
            </PermissionGate>
            <PermissionGate permission="settings.manage_roles" fallback={<div className="float-panel p-5"><p className="text-sm text-muted-foreground">Non hai il permesso per accedere a questa sezione.</p></div>}>
              {tab === "ruoli-utenti" && (
                <div className="float-panel p-5">
                  <UserRolesPanel />
                </div>
              )}
            </PermissionGate>
            <PermissionGate permission="settings.manage_teams" fallback={<div className="float-panel p-5"><p className="text-sm text-muted-foreground">Non hai il permesso per accedere a questa sezione.</p></div>}>
              {tab === "team" && (
                <div className="float-panel p-5">
                  <TeamManagementPanel />
                </div>
              )}
            </PermissionGate>
            {tab === "audit" && (
              <div className="float-panel p-5">
                <AuditTrailPanel />
              </div>
            )}
            {tab === "backup-export" && (
              <div className="float-panel p-5">
                <BackupExportTab />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
