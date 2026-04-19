/**
 * SettingsPage V2 — Direct mount, no inner Suspense.
 */
import * as React from "react";
import V1Component from "@/pages/Settings";
import { useMissionDrawerEvents } from "@/hooks/useMissionDrawerEvents";
import { toast } from "sonner";

export function SettingsPage(): React.ReactElement {
  useMissionDrawerEvents({
    "enrichment-batch-start": () => {
      window.dispatchEvent(new CustomEvent("settings-trigger-enrichment-batch"));
      toast.info("Avvio batch enrichment", { description: "Vai su Settings → Arricchimento per monitorare il job." });
    },
    "enrichment-export": () => {
      window.dispatchEvent(new CustomEvent("settings-trigger-enrichment-export"));
      toast.info("Export enrichment", { description: "File CSV in preparazione." });
    },
  });

  return (
    <div data-testid="page-settings" className="h-full">
      <V1Component />
    </div>
  );
}
