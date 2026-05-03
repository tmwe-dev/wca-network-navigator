/**
 * BriefAccordion — Compact, collapsible structured brief that augments the freeform customGoal.
 * Default closed. When expanded, exposes 4 optional fields (key points, CTA, avoid topics, length).
 * On output, fields are concatenated into a single text block appended to customGoal —
 * so the existing OracleConfig API is unchanged.
 */
import { useState, useCallback, useMemo } from "react";
import { ChevronDown, ListChecks, Target as TargetIcon, AlertTriangle, Ruler, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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

const LENGTH_VALUES: EmailBrief["maxLength"][] = ["", "short", "medium", "long"];
const LENGTH_UI_LABEL: Record<EmailBrief["maxLength"], string> = {
  "": "Auto",
  short: "Breve",
  medium: "Media",
  long: "Lunga",
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
  const [open, setOpen] = useState(true);
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

  const lengthIndex = Math.max(0, LENGTH_VALUES.indexOf(brief.maxLength));

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
    <div className="rounded-lg border border-primary/20 bg-primary/5 shadow-sm shadow-primary/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-foreground hover:bg-primary/10 transition-colors rounded-lg"
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
            <ListChecks className="w-3.5 h-3.5" />
          </span>
          Brief
          {dirtyCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">
              {dirtyCount}
            </span>
          )}
        </span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-primary/15 px-3 py-3 space-y-3">
          {/* Key points */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-primary mb-1.5">
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
                placeholder="Aggiungi punto"
                className="h-8 text-[11px] flex-1 bg-background/60"
              />
              <button
                type="button"
                onClick={addPoint}
                disabled={!pointInput.trim()}
                className="shrink-0 px-2 rounded-md border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-primary mb-1.5">
              <TargetIcon className="w-3 h-3" />
              Call to Action
            </label>
            <Input
              value={brief.cta}
              onChange={(e) => update("cta", e.target.value)}
              placeholder="Es: fissare una call di 15 min"
              className="h-8 text-[11px] bg-background/60"
            />
          </div>

          {/* Avoid */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-destructive mb-1.5">
              <AlertTriangle className="w-3 h-3" />
              Da evitare
            </label>
            <Input
              value={brief.avoidTopics}
              onChange={(e) => update("avoidTopics", e.target.value)}
              placeholder="Es: non menzionare prezzi"
              className="h-8 text-[11px] bg-background/60"
            />
          </div>

          {/* Length */}
          <div className="rounded-md border border-border/30 bg-background/40 px-3 py-2.5">
            <label className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase text-muted-foreground mb-2.5">
              <span className="inline-flex items-center gap-1.5">
              <Ruler className="w-3 h-3" />
              Lunghezza
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                {LENGTH_UI_LABEL[brief.maxLength]}
              </span>
            </label>
            <Slider
              value={[lengthIndex]}
              min={0}
              max={3}
              step={1}
              onValueChange={([next]) => update("maxLength", LENGTH_VALUES[next] ?? "")}
              aria-label="Lunghezza email"
            />
            <div className="mt-2 grid grid-cols-4 text-center text-[9px] text-muted-foreground">
              <span>Auto</span>
              <span>Breve</span>
              <span>Media</span>
              <span>Lunga</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}