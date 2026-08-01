/**
 * pendingActionsPanel.constants — Meta mappings + sub-components puri.
 * Estratto da PendingActionsPanel per alleggerire il componente principale.
 */
import {
  Mail, Reply, Archive, ListTodo, Forward, Clock, Zap, Bot, User, Workflow, Sparkles, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasSiblingRisk } from "@/components/ai-control/SiblingRiskBadge";

export const ACTION_META: Record<string, { icon: typeof Mail; color: string; label: string }> = {
  send_email: { icon: Mail, color: "text-blue-400 bg-blue-400/10", label: "Invia Email" },
  send_whatsapp: { icon: Mail, color: "text-green-400 bg-green-400/10", label: "WhatsApp" },
  reply: { icon: Reply, color: "text-emerald-400 bg-emerald-400/10", label: "Rispondi" },
  forward: { icon: Forward, color: "text-orange-400 bg-orange-400/10", label: "Inoltra" },
  archive: { icon: Archive, color: "text-yellow-400 bg-yellow-400/10", label: "Archivia" },
  create_task: { icon: ListTodo, color: "text-purple-400 bg-purple-400/10", label: "Crea Task" },
  create_reminder: { icon: Clock, color: "text-cyan-400 bg-cyan-400/10", label: "Reminder" },
  advance_gate: { icon: Workflow, color: "text-pink-400 bg-pink-400/10", label: "Avanza Gate" },
  change_channel: { icon: Zap, color: "text-amber-400 bg-amber-400/10", label: "Cambia Canale" },
  schedule_followup: { icon: Clock, color: "text-sky-400 bg-sky-400/10", label: "Follow-up" },
  prompt_refinement: { icon: Sparkles, color: "text-violet-400 bg-violet-400/10", label: "Refinement Prompt" },
};

export const SOURCE_META: Record<string, { icon: typeof Bot; label: string }> = {
  ai_classifier: { icon: Bot, label: "Classificatore" },
  cadence_engine: { icon: Clock, label: "Cadenza" },
  workflow_gate: { icon: Workflow, label: "Workflow" },
  ai_assistant: { icon: Zap, label: "Assistente" },
  manual: { icon: User, label: "Manuale" },
};

export const confidenceColor = (c: number) =>
  c >= 0.85
    ? "bg-emerald-500/20 text-emerald-400"
    : c >= 0.7
      ? "bg-yellow-500/20 text-yellow-400"
      : "bg-red-500/20 text-red-400";

/**
 * Bottone Approva con Same-Company Sibling Guard.
 * Disabilita l'approvazione se esiste rischio sibling e non è stata
 * data conferma esplicita tramite il SiblingRiskBadge.
 */
export function ApproveGuardedButton({
  partnerId, contactId, confirmed, label, className, onApprove, isSendAction,
}: {
  readonly partnerId: string | null;
  readonly contactId: string | null;
  readonly confirmed: boolean;
  readonly label: string;
  readonly className: string;
  readonly onApprove: () => void;
  readonly isSendAction: boolean;
}) {
  const hasRisk = useHasSiblingRisk(partnerId, contactId) && isSendAction;
  const blocked = hasRisk && !confirmed;
  return (
    <Button
      size="sm"
      variant="ghost"
      className={className}
      disabled={blocked}
      title={blocked ? "Spunta la conferma rischio sibling per approvare" : undefined}
      onClick={onApprove}
    >
      <CheckCircle className="h-3.5 w-3.5" />{label}
    </Button>
  );
}