/**
 * DashboardPage — STEP 4
 * Dashboard con card navigabili per ogni modulo.
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { StatCard } from "../molecules/StatCard";
import {
  Globe, Users, Mail, Bot, Megaphone,
  Settings, Activity,
} from "lucide-react";

interface ModuleCard {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly icon: React.ReactNode;
}

const modules: readonly ModuleCard[] = [
  { title: "Network", description: "Partner WCA e directory", path: "/v2/network", icon: <Globe className="h-5 w-5" /> },
  { title: "CRM", description: "Contatti e gruppi", path: "/v2/crm", icon: <Users className="h-5 w-5" /> },
  { title: "Outreach", description: "Email e comunicazioni", path: "/v2/outreach", icon: <Mail className="h-5 w-5" /> },
  { title: "Agenti AI", description: "Cockpit e missioni", path: "/v2/agents", icon: <Bot className="h-5 w-5" /> },
  { title: "Campagne", description: "Campaign builder", path: "/v2/campaigns", icon: <Megaphone className="h-5 w-5" /> },
  { title: "Diagnostica", description: "Health check e test", path: "/v2/diagnostics", icon: <Activity className="h-5 w-5" /> },
  { title: "Impostazioni", description: "Configurazione sistema", path: "/v2/settings", icon: <Settings className="h-5 w-5" /> },
];

export function DashboardPage(): React.ReactElement {
  const { profile } = useAuthV2();
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {profile?.displayName ? `Ciao, ${profile.displayName}` : "Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">WCA Network Navigator v2.0</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((moduleCard) => (
          <button
            key={moduleCard.path}
            onClick={() => navigate(moduleCard.path)}
            className="text-left"
          >
            <StatCard
              title={moduleCard.title}
              value={moduleCard.description}
              icon={moduleCard.icon}
              className="hover:border-primary/50 transition-colors cursor-pointer"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
