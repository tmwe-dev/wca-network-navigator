/**
 * SettingsPage — Full settings with VerticalTabNav (14 tabs)
 */
import * as React from "react";
import { useState } from "react";
import { Settings, Shield, Database, Bot, Mail, Globe, Volume2, Download, FileText, Image, Crown, Users, Clock, Briefcase } from "lucide-react";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import { GeneralSettingsTab } from "../organisms/settings/GeneralSettingsTab";
import { SecuritySettingsTab } from "../organisms/settings/SecuritySettingsTab";
import { DataSettingsTab } from "../organisms/settings/DataSettingsTab";
import { AISettingsTab } from "../organisms/settings/AISettingsTab";
import { EmailSettingsTab } from "../organisms/settings/EmailSettingsTab";
import { ConnectionsSettingsTab } from "../organisms/settings/ConnectionsSettingsTab";
import { VoiceAISettingsTab } from "../organisms/settings/VoiceAISettingsTab";
import { ImportSettingsTab } from "../organisms/settings/ImportSettingsTab";
import { RASettingsTab } from "../organisms/settings/RASettingsTab";
import { EnrichmentSettingsTab } from "../organisms/settings/EnrichmentSettingsTab";
import { MemoryAISettingsTab } from "../organisms/settings/MemoryAISettingsTab";
import { SubscriptionSettingsTab } from "../organisms/settings/SubscriptionSettingsTab";
import { OperatorsSettingsTab } from "../organisms/settings/OperatorsSettingsTab";
import { TimingSettingsTab } from "../organisms/settings/TimingSettingsTab";

type SettingsTabValue =
  | "general" | "security" | "email" | "connections"
  | "data" | "ai" | "voice" | "import" | "ra"
  | "enrichment" | "memory" | "subscription" | "operators" | "timing";

const TABS: VerticalTab[] = [
  { value: "general", label: "Generale", icon: Settings },
  { value: "security", label: "Sicurezza", icon: Shield },
  { value: "email", label: "Email", icon: Mail },
  { value: "connections", label: "Connessioni", icon: Globe },
  { value: "data", label: "Dati", icon: Database },
  { value: "ai", label: "AI", icon: Bot },
  { value: "voice", label: "Voce AI", icon: Volume2 },
  { value: "import", label: "Importa", icon: Download },
  { value: "ra", label: "Report Aziende", icon: FileText },
  { value: "enrichment", label: "Arricchimento", icon: Image },
  { value: "memory", label: "Memoria AI", icon: Database },
  { value: "subscription", label: "Abbonamento", icon: Crown },
  { value: "operators", label: "Operatori", icon: Users },
  { value: "timing", label: "Timing", icon: Clock },
];

const TAB_COMPONENTS: Record<SettingsTabValue, React.FC> = {
  general: GeneralSettingsTab,
  security: SecuritySettingsTab,
  email: EmailSettingsTab,
  connections: ConnectionsSettingsTab,
  data: DataSettingsTab,
  ai: AISettingsTab,
  voice: VoiceAISettingsTab,
  import: ImportSettingsTab,
  ra: RASettingsTab,
  enrichment: EnrichmentSettingsTab,
  memory: MemoryAISettingsTab,
  subscription: SubscriptionSettingsTab,
  operators: OperatorsSettingsTab,
  timing: TimingSettingsTab,
};

export function SettingsPage(): React.ReactElement {
  const [tab, setTab] = useState<SettingsTabValue>("general");
  const ActiveTab = TAB_COMPONENTS[tab];

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <VerticalTabNav tabs={TABS} value={tab} onChange={(v) => setTab(v as SettingsTabValue)} />
      <div className="flex-1 min-w-0 overflow-auto p-4">
        <div className="max-w-4xl">
          <ActiveTab />
        </div>
      </div>
    </div>
  );
}
