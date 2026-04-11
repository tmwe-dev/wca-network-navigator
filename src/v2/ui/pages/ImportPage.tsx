/**
 * ImportPage — STEP 9
 * Contact import management.
 */

import * as React from "react";
import { EmptyState } from "../atoms/EmptyState";
import { StatCard } from "../molecules/StatCard";
import { Upload, FileCheck, AlertTriangle } from "lucide-react";

export function ImportPage(): React.ReactElement {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import</h1>
        <p className="text-sm text-muted-foreground">
          Importazione contatti da CSV, Excel e altre fonti.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Importazioni"
          value="—"
          icon={<Upload className="h-4 w-4" />}
        />
        <StatCard
          title="Contatti importati"
          value="—"
          icon={<FileCheck className="h-4 w-4" />}
        />
        <StatCard
          title="Errori"
          value="—"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <EmptyState
        title="Nessuna importazione recente"
        description="Trascina un file CSV o Excel per iniziare l'importazione."
      />
    </div>
  );
}
