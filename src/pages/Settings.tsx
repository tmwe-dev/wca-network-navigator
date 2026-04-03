import { useState } from "react";
import { Loader2, Settings as SettingsIcon, BookOpen, Link, Download, FileText, Crown, Volume2, Users, Mail, Image } from "lucide-react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { SubscriptionPanel } from "@/components/settings/SubscriptionPanel";
import ContentManager from "@/components/settings/ContentManager";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { ConnectionsSettings } from "@/components/settings/ConnectionsSettings";
import { ImportExportSettings } from "@/components/settings/ImportExportSettings";
import { RASettings } from "@/components/settings/RASettings";
import { ElevenLabsSettings } from "@/components/settings/ElevenLabsSettings";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import OperatorsSettings from "@/pages/OperatorsSettings";
import EmailDownloadPage from "@/pages/EmailDownloadPage";
import EnrichmentSettings from "@/components/settings/EnrichmentSettings";

export default function Settings() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [tab, setTab] = useState("generale");

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const tabs: VerticalTab[] = [
    { value: "generale", label: "Generale", icon: SettingsIcon },
    { value: "contenuti", label: "Contenuti", icon: BookOpen },
    { value: "wca", label: "Connessioni", icon: Link },
    { value: "voce-ai", label: "Voce AI", icon: Volume2 },
    { value: "import-export", label: "Import/Export", icon: Download },
    { value: "download-email", label: "Download Email", icon: Mail },
    { value: "reportaziende", label: "Report Aziende", icon: FileText },
    { value: "enrichment", label: "Arricchimento", icon: Image },
    { value: "abbonamento", label: "Abbonamento", icon: Crown },
    { value: "operatori", label: "Operatori", icon: Users },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} />
      <div className="flex-1 min-w-0 overflow-auto p-4">
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
          {tab === "contenuti" && (
            <div className="float-panel p-5">
              <ContentManager />
            </div>
          )}
          {tab === "abbonamento" && (
            <div className="float-panel p-5">
              <SubscriptionPanel />
            </div>
          )}
          {tab === "operatori" && (
            <OperatorsSettings />
          )}
          {tab === "download-email" && (
            <div className="h-full -m-4">
              <EmailDownloadPage />
            </div>
          )}
          {tab === "enrichment" && (
            <div className="float-panel p-5">
              <EnrichmentSettings />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
