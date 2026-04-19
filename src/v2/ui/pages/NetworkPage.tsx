/**
 * NetworkPage V2 — Direct mount of Operations (skips legacy wrapper).
 * Singolo livello, nessun Suspense interno (gestito da guardedPage).
 */
import * as React from "react";
import Operations from "@/pages/Operations";
import { useTrackPage } from "@/hooks/useTrackPage";
import { useMissionDrawerEvents } from "@/hooks/useMissionDrawerEvents";
import { toast } from "sonner";

export function NetworkPage(): React.ReactElement {
  useTrackPage("network");

  // Listener per azioni dispatchate dal MissionDrawer (ContextActionPanel "Azioni Network")
  useMissionDrawerEvents({
    // sync-wca-trigger è già gestito globalmente da useWcaSync
    "deep-search-country": () => {
      // Demanda al CountryGridV2 / pagina che ascolta separatamente
      window.dispatchEvent(new CustomEvent("network-open-deep-search"));
      toast.info("Deep Search aperto", { description: "Seleziona il paese nella griglia." });
    },
    "generate-aliases": () => {
      window.dispatchEvent(new CustomEvent("network-trigger-alias-batch"));
      toast.success("Batch alias avviato sui partner visibili");
    },
    "export-partners": () => {
      window.dispatchEvent(new CustomEvent("network-trigger-export"));
    },
  });

  return (
    <div data-testid="page-network" className="flex flex-col h-full min-h-0 overflow-hidden">
      <Operations />
    </div>
  );
}
