/**
 * OraclePanelV2 — AI assistant sidebar for email composition
 */
import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, BookOpen, Search as SearchIcon, Handshake, ClipboardList, Briefcase, Globe, Plane, GraduationCap, Smile, Target } from "lucide-react";
import type { LucideProps } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Handshake, RefreshCw, ClipboardList, Briefcase, Globe, Plane, GraduationCap, Smile, Target,
};
import { DEFAULT_EMAIL_TYPES, TONE_OPTIONS } from "@/data/defaultEmailTypes";
import { cn } from "@/lib/utils";

interface OraclePanelV2Props {
  readonly emailType: string;
  readonly onEmailTypeChange: (v: string) => void;
  readonly tone: string;
  readonly onToneChange: (v: string) => void;
  readonly useKB: boolean;
  readonly onUseKBChange: (v: boolean) => void;
  readonly onGenerate: (goal?: string) => void;
  readonly onImprove: () => void;
  readonly isGenerating: boolean;
  readonly templates: ReadonlyArray<{ id: string; title: string; instructions: string }>;
  readonly onSelectTemplate: (instructions: string) => void;
}

export function OraclePanelV2({
  emailType, onEmailTypeChange,
  tone, onToneChange,
  useKB, onUseKBChange,
  onGenerate, onImprove, isGenerating,
  templates, onSelectTemplate,
}: OraclePanelV2Props): React.ReactElement {
  const [goal, setGoal] = useState("");
  const [activeTab, setActiveTab] = useState<"oracle" | "templates">("oracle");

  return (
    <aside className="w-[260px] flex-shrink-0 border-l bg-card flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("oracle")}
          className={cn(
            "flex-1 text-xs font-medium py-2 transition-colors",
            activeTab === "oracle" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          🔮 Oracolo
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={cn(
            "flex-1 text-xs font-medium py-2 transition-colors",
            activeTab === "templates" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          📋 Template
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeTab === "oracle" ? (
          <>
            {/* Email Type */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Tipo email</label>
              <div className="grid grid-cols-2 gap-1">
                {DEFAULT_EMAIL_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onEmailTypeChange(t.id)}
                    className={cn(
                      "text-[10px] px-2 py-1.5 rounded border text-left transition-colors",
                      emailType === t.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {ICON_MAP[t.icon] ? (() => { const Icon = ICON_MAP[t.icon]; return <Icon className="w-3 h-3 mr-1 inline-block text-current" />; })() : <span className="mr-1">{t.icon}</span>}{t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Tono</label>
              <div className="flex flex-wrap gap-1">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => onToneChange(t.value)}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded-full border transition-colors",
                      tone === t.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {ICON_MAP[t.icon] ? (() => { const Icon = ICON_MAP[t.icon]; return <><Icon className="w-3 h-3 inline-block mr-0.5 text-current" />{t.label}</>; })() : <>{t.icon} {t.label}</>}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => onUseKBChange(!useKB)}
                className={cn(
                  "flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors",
                  useKB ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                )}
              >
                <BookOpen className="h-3 w-3" /> KB
              </button>
            </div>

            {/* Goal */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Obiettivo</label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Es: Aprire dialogo per rotte aeree Asia..."
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground resize-none h-16"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5">
              <Button
                size="sm"
                className="gap-1.5 w-full"
                onClick={() => onGenerate(goal || undefined)}
                disabled={isGenerating}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isGenerating ? "Generando..." : "Genera email"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 w-full"
                onClick={onImprove}
                disabled={isGenerating}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Migliora
              </Button>
            </div>
          </>
        ) : (
          /* Templates tab */
          <div className="space-y-1.5">
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nessun template disponibile.</p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTemplate(t.instructions)}
                  className="w-full text-left p-2 rounded-md border hover:bg-accent/50 transition-colors"
                >
                  <p className="text-xs font-medium text-foreground truncate">{t.title}</p>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
