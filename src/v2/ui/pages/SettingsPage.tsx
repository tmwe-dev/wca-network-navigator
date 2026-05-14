/**
 * SettingsPage V2 — Standalone V1 content migration (NO wrapper)
 */
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Settings as SettingsIcon, Brain, Link, Download, FileText, Volume2, Users, Mail, Image, Database, Shield, Briefcase, Clock, Cpu, Package, Bell, Square as LogSquare, KeyRound, UsersRound, Coins, Power, Activity, Puzzle, Layers, FlaskConical, ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import AICommandCenter from "@/components/settings/AICommandCenter";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { ConnectionsSettings } from "@/components/settings/ConnectionsSettings";
import { ImportExportSettings } from "@/components/settings/ImportExportSettings";
import { RASettings } from "@/components/settings/RASettings";
import { ElevenLabsSettings } from "@/components/settings/ElevenLabsSettings";
import { AIProviderSettings } from "@/components/settings/AIProviderSettings";
import OperatorsSettings from "@/components/settings/OperatorsSettingsPanel";
import SharedMailboxesPanel from "@/components/settings/SharedMailboxesPanel";
import EmailDownloadPage from "@/components/settings/EmailDownloadPanel";
import EnrichmentSettings from "@/components/settings/EnrichmentSettings";
import OperativeJobsBoard from "@/components/settings/OperativeJobsBoard";
import MemoryDashboard from "@/components/ai/MemoryDashboard";
import TimingSettings from "@/components/settings/TimingSettings";
import AdminUsers from "@/components/settings/AdminUsersPanel";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { TextIntensityToggle } from "@/v2/ui/molecules/TextIntensityToggle";
import { PersistentResizablePanelGroup } from "@/v2/ui/atoms/PersistentResizablePanelGroup";
import { ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
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
import { SECONDARY_NAV } from "@/v2/navigation/registry";
import LabPage from "@/v2/ui/pages/LabPage";

const DEV_PAGE_GROUPS = SECONDARY_NAV;

interface SettingsTabDef {
  value: string;
  label: string;
  icon: LucideIcon;
}
interface SettingsGroupDef {
  id: string;
  title: string;
  items: SettingsTabDef[];
}

const SETTINGS_GROUPS: SettingsGroupDef[] = [
  {
    id: "generali",
    title: "Generali",
    items: [
      { value: "generale", label: "Generale", icon: SettingsIcon },
      { value: "wca", label: "Connessioni", icon: Link },
      { value: "estensioni", label: "Estensioni", icon: Puzzle },
      { value: "reportaziende", label: "Report Aziende", icon: FileText },
      { value: "notifiche", label: "Notifiche", icon: Bell },
      { value: "timing", label: "Timing & Schedule", icon: Clock },
    ],
  },
  {
    id: "agenti",
    title: "Agenti",
    items: [
      { value: "voce-ai", label: "Voce AI", icon: Volume2 },
      { value: "ai-prompt", label: "AI & Prompt", icon: Brain },
      { value: "provider-ai", label: "Provider AI", icon: Cpu },
    ],
  },
  {
    id: "update",
    title: "Update",
    items: [
      { value: "enrichment", label: "Arricchimento", icon: Image },
    ],
  },
  {
    id: "import-export-grp",
    title: "Import & Export",
    items: [
      { value: "backup-export", label: "Backup & Export", icon: Package },
      { value: "import-export", label: "Importa", icon: Download },
    ],
  },
  {
    id: "contatori",
    title: "Contatori",
    items: [
      { value: "ai-monitor", label: "AI Monitor", icon: Activity },
      { value: "processi-automatici", label: "Processi Automatici", icon: Power },
      { value: "token-ai", label: "Token AI", icon: Coins },
      { value: "memoria-ai", label: "Memoria AI", icon: Database },
    ],
  },
  {
    id: "report",
    title: "Report",
    items: [
      { value: "audit", label: "Audit Trail", icon: LogSquare },
      { value: "guida-operativa", label: "Jobs Operativi", icon: Briefcase },
    ],
  },
  {
    id: "posta",
    title: "Posta",
    items: [
      { value: "download-email", label: "Download Email", icon: Mail },
      { value: "caselle-aziendali", label: "Caselle Aziendali", icon: Mail },
    ],
  },
  {
    id: "master",
    title: "Master",
    items: [
      { value: "development", label: "Development", icon: Layers },
    ],
  },
  {
    id: "test",
    title: "TEST",
    items: [
      { value: "lab", label: "Lab & Verifiche", icon: FlaskConical },
    ],
  },
  {
    id: "team",
    title: "Team",
    items: [
      { value: "operatori", label: "Operatori", icon: Users },
      { value: "ruoli", label: "Ruoli & Permessi", icon: KeyRound },
      { value: "ruoli-utenti", label: "Ruoli Utenti", icon: UsersRound },
      { value: "utenti", label: "Utenti Autorizzati", icon: Shield },
      { value: "team", label: "Team", icon: Users },
    ],
  },
];

function GroupedSettingsNav({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const initialOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const g of SETTINGS_GROUPS) {
      map[g.id] = g.items.some((it) => it.value === value);
    }
    if (!Object.values(map).some(Boolean)) map[SETTINGS_GROUPS[0].id] = true;
    return map;
  }, [value]);
  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen);

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const g of SETTINGS_GROUPS) {
        if (g.items.some((it) => it.value === value)) next[g.id] = true;
      }
      return next;
    });
  }, [value]);

  return (
    <nav className="flex flex-col w-full h-full min-h-0 overflow-y-auto border-r border-border/50 bg-muted/20 py-1">
      {SETTINGS_GROUPS.map((group) => {
        const isOpen = open[group.id] ?? false;
        return (
          <div key={group.id} className="border-b border-border/30 last:border-b-0">
            <button
              type="button"
              onClick={() => setOpen((p) => ({ ...p, [group.id]: !isOpen }))}
              className="flex w-full items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground hover:bg-accent/40 transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span className="truncate">{group.title}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/60">
                {group.items.length}
              </span>
            </button>
            {isOpen && (
              <div className="pb-1">
                {group.items.map((item) => {
                  const active = value === item.value;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => onChange(item.value)}
                      className={cn(
                        "relative flex items-center gap-2 pl-6 pr-3 py-1.5 text-xs font-medium transition-colors text-left w-full",
                        "hover:bg-primary/5 hover:text-foreground",
                        active ? "text-primary bg-primary/10" : "text-muted-foreground",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

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
              {(group.items ?? []).map((item) => (
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
              {(group.subGroups ?? []).map((sg) => (
                <div key={sg.title} className="mt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1 px-1">
                    {sg.title}
                  </div>
                  <div className="space-y-1 border-l border-border/50 pl-2">
                    {sg.items.map((item) => (
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

  return (
    <div data-testid="page-settings" className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageTitleHeader icon={SettingsIcon} title="Config" subtitle="impostazioni di sistema" />
      <PersistentResizablePanelGroup
        storageId="settings:nav-vs-content"
        direction="horizontal"
        className="flex-1 min-h-0"
      >
      <ResizablePanel defaultSize={16} minSize={8} maxSize={40} className="min-h-0">
        <GroupedSettingsNav value={tab} onChange={setTab} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={84} minSize={40} className="min-h-0">
      <div className={cn("h-full min-w-0", tab === "download-email" ? "overflow-hidden" : "overflow-auto p-4")}>
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
                <div className="float-panel p-5 space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Intensità testo</h3>
                    <p className="text-xs text-muted-foreground">
                      Regola la gradazione del nero (tema chiaro) o del bianco (tema scuro) applicata
                      al testo in tutta la piattaforma.
                    </p>
                  </div>
                  <TextIntensityToggle />
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
            {tab === "caselle-aziendali" && <SharedMailboxesPanel />}
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
            {tab === "lab" && <LabPage />}
          </div>
        )}
      </div>
      </ResizablePanel>
      </PersistentResizablePanelGroup>
    </div>
  );
}
