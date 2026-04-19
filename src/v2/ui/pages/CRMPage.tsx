/**
 * CRMPage V2 — Direct mount, no inner Suspense (handled by guardedPage).
 */
import * as React from "react";
import V1Component from "@/pages/CRM";
import { useNavigate } from "react-router-dom";
import { useMissionDrawerEvents } from "@/hooks/useMissionDrawerEvents";
import { toast } from "sonner";

export function CRMPage(): React.ReactElement {
  const navigate = useNavigate();

  useMissionDrawerEvents({
    "crm-deep-search": () => {
      window.dispatchEvent(new CustomEvent("crm-trigger-deep-search"));
      toast.info("Deep Search CRM", { description: "Seleziona contatti per avviare la ricerca approfondita." });
    },
    "crm-linkedin-lookup": () => {
      window.dispatchEvent(new CustomEvent("crm-trigger-linkedin"));
      toast.info("LinkedIn lookup", { description: "Avviato sui contatti selezionati con account LinkedIn collegato." });
    },
    "crm-send-cockpit": () => {
      toast.success("Apertura Cockpit Outreach…");
      navigate("/v2/outreach?tab=cockpit&from=crm");
    },
    "crm-export": () => {
      window.dispatchEvent(new CustomEvent("crm-trigger-export"));
      toast.info("Export CSV", { description: "Generazione file in corso…" });
    },
  });

  return (
    <div data-testid="page-contacts" className="h-full">
      <V1Component />
    </div>
  );
}
