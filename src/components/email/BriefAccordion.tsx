/**
 * BriefAccordion — Compact, collapsible structured brief that augments the freeform customGoal.
 * Default closed. When expanded, exposes 4 optional fields (key points, CTA, avoid topics, length).
 * On output, fields are concatenated into a single text block appended to customGoal —
 * so the existing OracleConfig API is unchanged.
 */
import { useState, useCallback, useMemo } from "react";
import { ChevronDown, ListChecks, Target as TargetIcon, AlertTriangle, Ruler, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface EmailBrief {
  keyPoints: string[];
  cta: string;
  avoidTopics: string;
  maxLength: "" | "short" | "medium" | "long";
}

export const EMPTY_BRIEF: EmailBrief = {
  keyPoints: [],
  cta: "",
  avoidTopics: "",
  maxLength: "",
};

const LENGTH_LABEL: Record<EmailBrief["maxLength"], string> = {
  "": "",
  short: "5-7 righe",
  medium: "8-12 righe",
  long: "13-18 righe",
};

/** Convert brief to a structured text block to append to customGoal. Empty if no fields set. */
export function briefToText(brief: EmailBrief): string {
  const parts: string[] = [];
  if (brief.keyPoints.length > 0) {
    parts.push(`PUNTI CHIAVE: ${brief.keyPoints.join("; ")}`);
  }
  if (brief.cta.trim()) {
    parts.push(`CTA: ${brief.cta.trim()}`);
  }
  if (brief.avoidTopics.trim()) {
    parts.push(`DA EVITARE: ${brief.avoidTopics.trim()}`);
  }
  if (brief.maxLength) {
    parts.push(`LUNGHEZZA: ${LENGTH_LABEL[brief.maxLength]}`);
  }
  return parts.join("\n");
}

/** True if brief has at least one filled field — used to show the badge on the closed accordion. */
export function isBriefDirty(brief: EmailBrief): boolean {
  return (
    brief.keyPoints.length > 0 ||
    brief.cta.trim().length > 0 ||
    brief.avoidTopics.trim().length > 0 ||
    brief.maxLength !== ""
  );
}

interface Props {
  brief: EmailBrief;
  onChange: (next: EmailBrief) => void;
}

export default function BriefAccordion({ brief, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pointInput, setPointInput] = useState("");

  const dirtyCount = useMemo(() => {
    let n = 0;
    if (brief.keyPoints.length > 0) n++;
    if (brief.cta.trim()) n++;
    if (brief.avoidTopics.trim()) n++;
    if (brief.maxLength) n++;
    return n;
  }, [brief]);

  const update = useCallback(
    <K extends keyof EmailBrief>(key: K, value: EmailBrief[K]) => {
      onChange({ ...brief, [key]: value });
    },
    [brief, onChange],
  );

  const addPoint = useCallback(() => {
    const v = pointInput.trim();
    if (!v) return;
    if (brief.keyPoints.includes(v)) {
      setPointInput("");
      return;
    }
    update("keyPoints", [...brief.keyPoints, v]);
    setPointInput("");
  }, [pointInput, brief.keyPoints, update]);

  const removePoint = useCallback(
    (i: number) => {
      update(
        "keyPoints",
        brief.keyPoints.filter((_, idx) => idx !== i),
      );
    },
    [brief.keyPoints, update],
  );

  return (
    <div className="rounded-md border border-border/30 bg-muted/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-medium text-foreground/80 hover:bg-muted/30 transition-colors rounded-md"
      >
        <span className="flex items-center gap-1.5">
          <ListChecks className="w-3 h-3" />
          Brief strutturato
          {dirtyCount > 0 && (
            <span className="ml-1 px-1 py-0.5 rounded bg-primary/15 text-primary text-[9px]">
              {dirtyCount}
            </span>
          )}
        </span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border/30 px-2 py-2 space-y-2">
          {/* Key points */}
          <div>
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
              <TargetIcon className="w-3 h-3" />
              Punti chiave
            </label>
            <div className="flex gap-1">
              <Input
                value={pointInput}
                onChange={(e) => setPointInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPoint();
                  }
                }}
                placeholder="Aggiungi e premi Invio"
                className="h-7 text-[11px] flex-1"
              />
              <button
                type="button"
                onClick={addPoint}
                disabled={!pointInput.trim()}
                className="shrink-0 px-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Aggiungi punto"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {brief.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {brief.keyPoints.map((p, i) => (
                  <span
                    key={`${p}-${i}`}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] border border-primary/20"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => removePoint(i)}
                      className="hover:text-destructive"
                      title="Rimuovi"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          <div>
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
              <TargetIcon className="w-3 h-3" />
              Call to Action
            </label>
            <Input
              value={brief.cta}
              onChange={(e) => update("cta", e.target.value)}
              placeholder="Es: fissare una call di 15 min"
              className="h-7 text-[11px]"
            />
          </div>

          {/* Avoid */}
          <div>
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
              <AlertTriangle className="w-3 h-3" />
              Da evitare
            </label>
            <Input
              value={brief.avoidTopics}
              onChange={(e) => update("avoidTopics", e.target.value)}
              placeholder="Es: non menzionare prezzi"
              className="h-7 text-[11px]"
            />
          </div>

          {/* Length */}
          <div>
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
              <Ruler className="w-3 h-3" />
              Lunghezza
            </label>
            <Select
              value={brief.maxLength || "auto"}
              onValueChange={(v) => update("maxLength", v === "auto" ? "" : (v as EmailBrief["maxLength"]))}
            >
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue placeholder="Automatica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="text-[11px]">Automatica</SelectItem>
                <SelectItem value="short" className="text-[11px]">Breve (5-7 righe)</SelectItem>
                <SelectItem value="medium" className="text-[11px]">Media (8-12 righe)</SelectItem>
                <SelectItem value="long" className="text-[11px]">Lunga (13-18 righe)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}