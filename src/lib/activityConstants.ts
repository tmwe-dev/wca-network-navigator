import {
  Mail, Phone, Users, RotateCcw, MoreHorizontal,
  Check, Circle, Clock, CheckCircle2,
} from "lucide-react";

/* ── Activity type config ── */

export const ACTIVITY_TYPE_ICONS: Record<string, typeof Mail> = {
  send_email: Mail,
  phone_call: Phone,
  add_to_campaign: Users,
  meeting: Users,
  follow_up: RotateCcw,
  other: MoreHorizontal,
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  send_email: "Email",
  phone_call: "Telefono",
  add_to_campaign: "Campagna",
  meeting: "Meeting",
  follow_up: "Follow-up",
  other: "Altro",
};

/* ── Status config ── */

export const STATUS_LABELS: Record<string, string> = {
  pending: "Da fare",
  in_progress: "In corso",
  completed: "Completata",
  cancelled: "Annullata",
};

export const STATUS_ICONS = {
  pending: Circle,
  in_progress: Clock,
  completed: Check,
  cancelled: Circle,
} as const;

export const STATUS_CYCLE = ["pending", "in_progress", "completed"] as const;
type ActivityStatusKey = (typeof STATUS_CYCLE)[number];

/** Advance status to the next in the cycle */
export function nextStatus(current: string): ActivityStatusKey {
  const idx = STATUS_CYCLE.indexOf(current as ActivityStatusKey);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

/* ── Campaign job status (reuses a subset) ── */

export const JOB_STATUS_ICONS = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  skipped: Circle,
} as const;
