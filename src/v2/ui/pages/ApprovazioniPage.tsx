/**
 * ApprovazioniPage — coda `ai_pending_actions` con approvazione e dispatch.
 * Espone il PendingActionsPanel (già esistente) su una rotta raggiungibile,
 * necessaria per completare l'invio email accodato dai dialog SSOT.
 */
import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { PendingActionsPanel } from "@/components/ai-control/PendingActionsPanel";

export function ApprovazioniPage(): React.ReactElement {
  return (
    <div className="p-4">
      <PageTitleHeader icon={ShieldCheck} title="Approvazioni" subtitle="Azioni AI in attesa di invio" />
      <PendingActionsPanel />
    </div>
  );
}

export default ApprovazioniPage;
