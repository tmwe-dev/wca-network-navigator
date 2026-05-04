/**
 * SettingsPage V2 — Standalone V1 content migration (NO wrapper)
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Settings as SettingsIcon, Brain, Link, Download, FileText, Volume2, Users, Mail, Image, Database, Shield, Briefcase, Clock, Cpu, Package, Bell, Square as LogSquare, KeyRound, UsersRound, Coins, Power, Activity, Puzzle, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import AutomatedProcessesPanel from "@/components/settings/AutomatedProcessesPanel";
import AiMonitorPanel from "@/components/settings/AiMonitorPanel";
import ExtensionsPanel from "@/components/settings/ExtensionsPanel";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";

const DEV_PAGE_GROUPS: ReadonlyArray<{ title: string; items: ReadonlyArray<{ label: string; path: string }> }> = [
  {
    title: "Acquisizione & Ricerca",
    items: [
      { label: "Prospects", path: "/v2/crm/prospects" },
      { label: "Acquisizione Partner", path: "/v2/crm/acquisition" },
      { label: "Research", path: "/v2/research" },
      { label: "RA Explorer", path: "/v2/ra-explorer" },
      { label: "RA Scraping Engine", path: "/v2/ra-scraping" },
      { label: "Sorting", path: "/v2/sorting" },
    ],
  },
  {
    title: "Agenti & Missioni",
    items: [
      { label: "Editor Persona", path: "/v2/agents/persona" },
      { label: "Mission Builder", path: "/v2/agents/missions" },
      { label: "Missioni Autopilot", path: "/v2/agents/autopilot" },
      { label: "Agent Capabilities", path: "/v2/agents/capabilities" },
      { label: "Agent Tasks", path: "/v2/agents/tasks" },
    ],
  },
  {
    title: "Prompt Lab Avanzato",
    items: [
      { label: "Agent Atlas", path: "/v2/prompt-lab/atlas" },
      { label: "Suggestions Review", path: "/v2/prompt-lab/suggestions" },
      { label: "Prompt Catalog", path: "/v2/prompt-lab/catalog" },
      { label: "Registro Interazioni AI", path: "/v2/ai-interactions-log" },
    ],
  },
  {
    title: "AI Staff",
    items: [
      { label: "AI Staff Hub", path: "/v2/ai-staff" },
      { label: "KB Supervisor", path: "/v2/ai-staff/kb-supervisor" },
      { label: "AI Lab Test", path: "/v2/ai-staff/lab" },
      { label: "Email Forge", path: "/v2/ai-staff/email-forge" },
      { label: "AI Arena 3D", path: "/v2/ai-arena" },
    ],
  },
  {
    title: "Calendario & Campagne",
    items: [
      { label: "Calendar", path: "/v2/calendar" },
      { label: "Outreach Agenda", path: "/v2/outreach/agenda" },
      { label: "Campaign Jobs", path: "/v2/campaigns/jobs" },
    ],
  },
  {
    title: "Cockpit & Analytics",
    items: [
      { label: "Analytics", path: "/v2/analytics" },
      { label: "KPI Dashboard", path: "/v2/kpi" },
      { label: "Token Cockpit", path: "/v2/token-cockpit" },
      { label: "Notifications", path: "/v2/notifications" },
      { label: "AI Control Center", path: "/v2/ai-control" },
    ],
  },
  {
    title: "Sistema & Admin",
    items: [
      { label: "Admin Users", path: "/v2/settings/admin-users" },
      { label: "Email Download", path: "/v2/settings/email-download" },
      { label: "Diagnostics", path: "/v2/settings/diagnostics" },
      { label: "Telemetry", path: "/v2/settings/telemetry" },
      { label: "Observability", path: "/v2/settings/observability" },
      { label: "System Health", path: "/v2/settings/health" },
      { label: "E2E Status", path: "/v2/settings/e2e-status" },
      { label: "Design System", path: "/v2/design-system-preview" },
      { label: "Guida", path: "/v2/guida" },
    ],
  },
];

function DevelopmentPagesPanel() {
  const navigate = useNavigate();
  return (
    <div className="float-panel p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Tutte le pagine</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Accesso rapido a tutte le maschere del sistema, incluse quelle non presenti nel menu principale.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEV_PAGE_GROUPS.map((group) => (
          <div key={group.title} className="rounded-md border border-border/60 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-accent/60 transition-colors"
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{item.path}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const tabs: VerticalTab[] = ([
    { value: "ai-monitor", label: "AI Monitor", icon: Activity },
    { value: "ai-prompt", label: "AI & Prompt", icon: Brain },
    { value: "enrichment", label: "Arricchimento", icon: Image },
    { value: "audit", label: "Audit Trail", icon: LogSquare },
    { value: "backup-export", label: "Backup & Export", icon: Package },
    { value: "wca", label: "Connessioni", icon: Link },
    { value: "development", label: "Development", icon: Layers },
    { value: "download-email", label: "Download Email", icon: Mail },
    { value: "estensioni", label: "Estensioni", icon: Puzzle },
    { value: "generale", label: "Generale", icon: SettingsIcon },
    { value: "import-export", label: "Importa", icon: Download },
    { value: "guida-operativa", label: "Jobs Operativi", icon: Briefcase },
    { value: "memoria-ai", label: "Memoria AI", icon: Database },
    { value: "notifiche", label: "Notifiche", icon: Bell },
    { value: "operatori", label: "Operatori", icon: Users },
    { value: "processi-automatici", label: "Processi Automatici", icon: Power },
    { value: "provider-ai", label: "Provider AI", icon: Cpu },
    { value: "reportaziende", label: "Report Aziende", icon: FileText },
    { value: "ruoli", label: "Ruoli & Permessi", icon: KeyRound },
    { value: "ruoli-utenti", label: "Ruoli Utenti", icon: UsersRound },
    { value: "team", label: "Team", icon: Users },
    { value: "timing", label: "Timing & Schedule", icon: Clock },
    { value: "token-ai", label: "Token AI", icon: Coins },
    { value: "utenti", label: "Utenti Autorizzati", icon: Shield },
    { value: "voce-ai", label: "Voce AI", icon: Volume2 },
  ] satisfies VerticalTab[]).slice().sort((a, b) => a.label.localeCompare(b.label, "it"));

  return (
    <div data-testid="page-settings" className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageTitleHeader icon={SettingsIcon} title="Config" subtitle="impostazioni di sistema" />
      <div className="flex flex-1 min-h-0 overflow-hidden">
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
            {tab === "processi-automatici" && (
              <div className="float-panel p-5">
                <AutomatedProcessesPanel />
              </div>
            )}
            {tab === "ai-monitor" && (
              <div className="float-panel p-5">
                <AiMonitorPanel />
              </div>
            )}
            {tab === "estensioni" && (
              <div className="float-panel p-5">
                <ExtensionsPanel />
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
            {tab === "development" && <DevelopmentPagesPanel />}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
