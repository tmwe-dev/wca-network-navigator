/**
 * SettingsPage — Full settings with real forms
 */
import * as React from "react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings, Shield, Database, Bot, Mail, Globe, Users } from "lucide-react";
import { GeneralSettingsTab } from "../organisms/settings/GeneralSettingsTab";
import { SecuritySettingsTab } from "../organisms/settings/SecuritySettingsTab";
import { DataSettingsTab } from "../organisms/settings/DataSettingsTab";
import { AISettingsTab } from "../organisms/settings/AISettingsTab";
import { EmailSettingsTab } from "../organisms/settings/EmailSettingsTab";
import { ConnectionsSettingsTab } from "../organisms/settings/ConnectionsSettingsTab";

type SettingsTab = "general" | "security" | "data" | "ai" | "email" | "connections";

export function SettingsPage(): React.ReactElement {
  const [tab, setTab] = useState<SettingsTab>("general");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">Configurazione piattaforma e integrazioni.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="general" className="gap-1.5"><Settings className="h-3.5 w-3.5" />Generale</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Sicurezza</TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5"><Mail className="h-3.5 w-3.5" />Email</TabsTrigger>
          <TabsTrigger value="connections" className="gap-1.5"><Globe className="h-3.5 w-3.5" />Connessioni</TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5"><Database className="h-3.5 w-3.5" />Dati</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5"><Bot className="h-3.5 w-3.5" />AI</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4"><GeneralSettingsTab /></TabsContent>
        <TabsContent value="security" className="mt-4"><SecuritySettingsTab /></TabsContent>
        <TabsContent value="email" className="mt-4"><EmailSettingsTab /></TabsContent>
        <TabsContent value="connections" className="mt-4"><ConnectionsSettingsTab /></TabsContent>
        <TabsContent value="data" className="mt-4"><DataSettingsTab /></TabsContent>
        <TabsContent value="ai" className="mt-4"><AISettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
