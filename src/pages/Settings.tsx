import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Settings as SettingsIcon, Brain, Link, Download, FileText, Crown, Volume2, Users, Mail, Image, Database, Shield, Briefcase } from "lucide-react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { SubscriptionPanel } from "@/components/settings/SubscriptionPanel";
import AICommandCenter from "@/components/settings/AICommandCenter";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { ConnectionsSettings } from "@/components/settings/ConnectionsSettings";
import { ImportExportSettings } from "@/components/settings/ImportExportSettings";
import { RASettings } from "@/components/settings/RASettings";
import { ElevenLabsSettings } from "@/components/settings/ElevenLabsSettings";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import OperatorsSettings from "@/pages/OperatorsSettings";
import EmailDownloadPage from "@/pages/EmailDownloadPage";
import EnrichmentSettings from "@/components/settings/EnrichmentSettings";
import OperativeJobsBoard from "@/components/settings/OperativeJobsBoard";
import MemoryDashboard from "@/components/ai/MemoryDashboard";
import AdminUsers from "@/pages/AdminUsers";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get("tab") || "generale");

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
    { value: "import-export", label: "Importa", icon: Download },
    { value: "download-email", label: "Download Email", icon: Mail },
    { value: "reportaziende", label: "Report Aziende", icon: FileText },
    { value: "enrichment", label: "Arricchimento", icon: Image },
    { value: "memoria-ai", label: "Memoria AI", icon: Database },
    { value: "abbonamento", label: "Abbonamento", icon: Crown },
    { value: "operatori", label: "Operatori", icon: Users },
    { value: "utenti", label: "Utenti Autorizzati", icon: Shield },
  ];

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} />
      <div className={cn("flex-1 min-w-0", tab === "download-email" ? "overflow-hidden" : "overflow-auto p-4")}>
        {tab === "download-email" ? (
          <EmailDownloadPage />
        ) : (
          <div className="max-w-4xl">
            {tab === "generale" && (
              <div className="float-panel p-5">
                <GeneralSettings settings={settings} updateSetting={updateSetting} />
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
            {tab === "abbonamento" && (
              <div className="float-panel p-5">
                <SubscriptionPanel />
              </div>
            )}
            {tab === "operatori" && <OperatorsSettings />}
            {tab === "utenti" && <AdminUsers />}
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
          </div>
        )}
      </div>
    </div>
  );
}
