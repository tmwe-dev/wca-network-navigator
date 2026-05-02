/**
 * Action grouping per Agenda — condiviso tra lista (AgendaDayDetail) e
 * pannello azione (AgendaActionPanel) per derivare il verbo primario.
 */
import { Reply, Send, PhoneCall, HelpCircle, Mail } from "lucide-react";
import type { AllActivity } from "@/hooks/useActivities";

export type ActionGroupKey = "reply" | "send" | "call" | "decide";

export interface ActionGroupDef {
  readonly key: ActionGroupKey;
  readonly label: string;
  readonly icon: typeof Mail;
  readonly verb: string;
}

export const ACTION_GROUPS: readonly ActionGroupDef[] = [
  { key: "reply",  label: "Da rispondere", icon: Reply,      verb: "Rispondi" },
  { key: "send",   label: "Da inviare",    icon: Send,       verb: "Invia"    },
  { key: "call",   label: "Da chiamare",   icon: PhoneCall,  verb: "Chiama"   },
  { key: "decide", label: "Da decidere",   icon: HelpCircle, verb: "Apri"     },
] as const;

export function classifyAction(a: AllActivity, partnerHasResponded: boolean): ActionGroupKey {
  if (a.activity_type === "phone_call") return "call";
  if (a.activity_type === "note" || a.activity_type === "meeting" || a.activity_type === "other") return "decide";
  if (partnerHasResponded || /^reply received/i.test(a.title || "")) return "reply";
  return "send";
}

export function verbForActivity(a: AllActivity, partnerHasResponded: boolean): string {
  const key = classifyAction(a, partnerHasResponded);
  return ACTION_GROUPS.find((g) => g.key === key)?.verb ?? "Apri";
}