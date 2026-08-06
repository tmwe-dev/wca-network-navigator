/**
 * Costanti visive e helper puri per HarmonizeReviewPanel.
 * Nessuna JSX qui — solo mapping di classi/label e predicati puri.
 */
import { FileText, Wrench, Code2, BookOpen } from "lucide-react";
import type { HarmonizeProposal } from "@/data/harmonizeRuns";

export const ACTION_VARIANT: Record<HarmonizeProposal["action"], string> = {
  UPDATE: "bg-primary/10 text-primary border-primary/20",
  INSERT: "bg-success/10 text-success border-success/20",
  MOVE: "bg-warning/10 text-warning border-warning/20",
  DELETE: "bg-destructive/10 text-destructive border-destructive/20",
};

export const LAYER_META: Record<
  HarmonizeProposal["resolution_layer"],
  { label: string; icon: typeof FileText; cls: string }
> = {
  text: { label: "Testo", icon: FileText, cls: "bg-muted text-muted-foreground" },
  contract: {
    label: "Contratto backend",
    icon: Wrench,
    cls: "bg-warning/10 text-warning border-warning/20",
  },
  code_policy: {
    label: "Policy nel codice",
    icon: Code2,
    cls: "bg-destructive/10 text-destructive border-destructive/20",
  },
  kb_governance: {
    label: "Governance KB",
    icon: BookOpen,
    cls: "bg-primary/10 text-primary border-primary/20",
  },
};

export const SEVERITY_CLS: Record<NonNullable<HarmonizeProposal["severity"]>, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/10 text-warning border-warning/20",
  high: "bg-warning/10 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export const TEST_URGENCY_LABEL: Record<NonNullable<HarmonizeProposal["test_urgency"]>, string> = {
  none: "Nessun test",
  manual_smoke: "Smoke manuale",
  regression_full: "Regression completa",
};

/** Una proposta è "nota documentale" se l'AI l'ha marcata come tale. */
export const isDocNote = (p: HarmonizeProposal): boolean => p.is_document_note === true;

/** "Gestita" = già applicata al DB (executed) o fallita. */
export const isManaged = (p: HarmonizeProposal): boolean => p.status === "executed" || p.status === "failed";

/**
 * Una proposta è "sicura" se è solo testo, non DELETE, non INSERT su agents,
 * e impatto non alto.
 */
export const isSafe = (p: HarmonizeProposal): boolean =>
  !isDocNote(p) &&
  p.resolution_layer === "text" &&
  p.action !== "DELETE" &&
  p.impact !== "high" &&
  !(p.action === "INSERT" && p.target.table === "agents");
