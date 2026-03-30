import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, BookOpen, Link, Download, FileText, Crown, Volume2 } from "lucide-react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { SubscriptionPanel } from "@/components/settings/SubscriptionPanel";
import ContentManager from "@/components/settings/ContentManager";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { ConnectionsSettings } from "@/components/settings/ConnectionsSettings";
import { ImportExportSettings } from "@/components/settings/ImportExportSettings";
import { RASettings } from "@/components/settings/RASettings";
import { ElevenLabsSettings } from "@/components/settings/ElevenLabsSettings";

export default function Settings() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Glass top bar */}
      <div className="shrink-0 px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-4.5 h-4.5 text-primary" />
          <div>
            <h1 className="text-sm font-semibold text-foreground">Impostazioni</h1>
            <p className="text-[11px] text-muted-foreground">Configurazione della piattaforma</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="generale" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2 border-b border-border/50 shrink-0">
          <TabsList className="h-9 flex-wrap">
            <TabsTrigger value="generale" className="gap-1.5 text-xs">
              <SettingsIcon className="w-3.5 h-3.5" /> Generale
            </TabsTrigger>
            <TabsTrigger value="contenuti" className="gap-1.5 text-xs">
              <BookOpen className="w-3.5 h-3.5" /> Contenuti
            </TabsTrigger>
            <TabsTrigger value="wca" className="gap-1.5 text-xs">
              <Link className="w-3.5 h-3.5" /> Connessioni
            </TabsTrigger>
            <TabsTrigger value="voce-ai" className="gap-1.5 text-xs">
              <Volume2 className="w-3.5 h-3.5" /> Voce AI
            </TabsTrigger>
            <TabsTrigger value="import-export" className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Import / Export
            </TabsTrigger>
            <TabsTrigger value="reportaziende" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> Report Aziende
            </TabsTrigger>
            <TabsTrigger value="abbonamento" className="gap-1.5 text-xs">
              <Crown className="w-3.5 h-3.5" /> Abbonamento
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-4xl">
            <TabsContent value="generale" className="m-0">
              <div className="float-panel p-5">
                <GeneralSettings settings={settings} updateSetting={updateSetting} />
              </div>
            </TabsContent>

            <TabsContent value="wca" className="m-0">
              <div className="float-panel p-5">
                <ConnectionsSettings settings={settings} updateSetting={updateSetting} />
              </div>
            </TabsContent>

            <TabsContent value="voce-ai" className="m-0">
              <div className="float-panel p-5">
                <ElevenLabsSettings settings={settings} updateSetting={updateSetting} />
              </div>
            </TabsContent>

            <TabsContent value="import-export" className="m-0">
              <div className="float-panel p-5">
                <ImportExportSettings />
              </div>
            </TabsContent>

            <TabsContent value="reportaziende" className="m-0">
              <div className="float-panel p-5">
                <RASettings settings={settings} updateSetting={updateSetting} />
              </div>
            </TabsContent>

            <TabsContent value="contenuti" className="m-0">
              <div className="float-panel p-5">
                <ContentManager />
              </div>
            </TabsContent>

            <TabsContent value="abbonamento" className="m-0">
              <div className="float-panel p-5">
                <SubscriptionPanel />
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
