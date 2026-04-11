/**
 * SettingsPage — STEP 9
 * Settings hub with tabbed sections.
 */

import * as React from "react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings, Shield, Database, Bot } from "lucide-react";
import { EmptyState } from "../atoms/EmptyState";

type SettingsTab = "general" | "security" | "data" | "ai";

export function SettingsPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">
          Configurazione piattaforma e integrazioni.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTab)}>
        <TabsList>
          <TabsTrigger value="general" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Generale
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Sicurezza
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Dati
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <EmptyState
            title="Impostazioni generali"
            description="Configurazione profilo, lingua, notifiche. In costruzione."
          />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <EmptyState
            title="Sicurezza"
            description="Gestione utenti autorizzati, ruoli, whitelist. In costruzione."
          />
        </TabsContent>
        <TabsContent value="data" className="mt-4">
          <EmptyState
            title="Dati"
            description="Import/Export, backup, pulizia dati. In costruzione."
          />
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
          <EmptyState
            title="AI"
            description="Prompt, Knowledge Base, Template, Deep Search. In costruzione."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
