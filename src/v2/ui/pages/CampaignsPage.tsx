/**
 * CampaignsPage — STEP 8
 * Campaign dashboard placeholder (batch-based).
 */

import * as React from "react";
import { StatCard } from "../molecules/StatCard";
import { EmptyState } from "../atoms/EmptyState";
import { Send, Clock, CheckCircle } from "lucide-react";

export function CampaignsPage(): React.ReactElement {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Campagne</h1>
        <p className="text-sm text-muted-foreground">
          Gestione campagne email e outreach multi-canale.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Inviate"
          value="—"
          icon={<Send className="h-4 w-4" />}
        />
        <StatCard
          title="In coda"
          value="—"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          title="Completate"
          value="—"
          icon={<CheckCircle className="h-4 w-4" />}
        />
      </div>

      <EmptyState
        title="Nessuna campagna attiva"
        description="Crea una nuova campagna dal modulo Outreach per iniziare l'invio programmato."
      />
    </div>
  );
}
