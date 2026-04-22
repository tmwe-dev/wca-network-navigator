import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Play } from "lucide-react";
import { MapPin, Globe, Star, Search } from "lucide-react";
import {
  ALL_PIPELINES,
  type PipelineKey,
} from "@/v2/io/extensions/deep-search-pipelines";

const PIPELINE_ICONS: Record<
  PipelineKey,
  React.ComponentType<{ className?: string }>
> = {
  googleMaps: MapPin,
  websiteMultiPage: Globe,
  reputation: Star,
  googleGeneral: Search,
};

interface PipelinesVars {
  companyName: string;
  city: string;
  websiteUrl: string;
  query: string;
}

interface DeepSearchPipelinesProps {
  vars: PipelinesVars;
  running: string | null;
  manualUrl: string;
  onManualUrlChange: (url: string) => void;
  onPipelineRun: (key: PipelineKey) => void;
  onManualRun: () => void;
}

export function DeepSearchPipelines({
  vars,
  running,
  manualUrl,
  onManualUrlChange,
  onPipelineRun,
  onManualRun,
}: DeepSearchPipelinesProps) {
  return (
    <div className="p-3 space-y-2 border-b border-border/60 shrink-0">
      <div className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
        Pipeline rapide
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {(Object.keys(ALL_PIPELINES) as PipelineKey[]).map((k) => {
          const p = ALL_PIPELINES[k];
          const Icon = PIPELINE_ICONS[k];
          const isRunning = running === k;
          const disabled = !!running || p.requiredVars.some((v) => !vars[v as keyof typeof vars]);

          return (
            <Button
              key={k}
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onPipelineRun(k)}
              className="h-auto py-1.5 px-2 justify-start text-left gap-2"
            >
              {isRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              ) : (
                <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium truncate">{p.label}</div>
                <div className="text-[11px] text-foreground/70 truncate">
                  {p.description}
                </div>
              </div>
            </Button>
          );
        })}
      </div>

      <div className="pt-2 border-t border-border/60 space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
          URL manuale
        </div>
        <div className="flex gap-1">
          <Input
            value={manualUrl}
            onChange={(e) => onManualUrlChange(e.target.value)}
            placeholder="https://…"
            className="h-7 text-[11px] font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") onManualRun();
            }}
          />
          <Button
            size="sm"
            disabled={!!running || !manualUrl.trim()}
            onClick={onManualRun}
            className="h-7 px-2"
          >
            {running === "manual" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
