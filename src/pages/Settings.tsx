import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, BookOpen, Link, Download, FileText, Crown } from "lucide-react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { SubscriptionPanel } from "@/components/settings/SubscriptionPanel";
import ContentManager from "@/components/settings/ContentManager";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { ConnectionsSettings } from "@/components/settings/ConnectionsSettings";
import { ImportExportSettings } from "@/components/settings/ImportExportSettings";
import { RASettings } from "@/components/settings/RASettings";

export default function Settings() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground mt-1">Configurazione della piattaforma</p>
      </div>

      <Tabs defaultValue="generale" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="generale" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" /> Generale
          </TabsTrigger>
          <TabsTrigger value="contenuti" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Contenuti
          </TabsTrigger>
          <TabsTrigger value="wca" className="flex items-center gap-2">
            <Link className="w-4 h-4" /> Connessioni
          </TabsTrigger>
          <TabsTrigger value="import-export" className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Import / Export
          </TabsTrigger>
          <TabsTrigger value="reportaziende" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Report Aziende
          </TabsTrigger>
          <TabsTrigger value="abbonamento" className="flex items-center gap-2">
            <Crown className="w-4 h-4" /> Abbonamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generale">
          <GeneralSettings settings={settings} updateSetting={updateSetting} />
        </TabsContent>

        <TabsContent value="wca">
          <ConnectionsSettings settings={settings} updateSetting={updateSetting} />
        </TabsContent>

        <TabsContent value="import-export">
          <ImportExportSettings />
        </TabsContent>

        <TabsContent value="reportaziende">
          <RASettings settings={settings} updateSetting={updateSetting} />
        </TabsContent>

        <TabsContent value="contenuti">
          <ContentManager />
        </TabsContent>

        <TabsContent value="abbonamento">
          <SubscriptionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
