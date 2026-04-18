/**
 * KBSupervisorHeader — Header con toggle modalità + status
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Brain, Shield, Zap, ArrowLeft, Volume2 } from "lucide-react";
import type { SupervisorMode } from "@/v2/ui/pages/kb-supervisor/hooks/useKBSupervisorState";
import { useNavigate } from "react-router-dom";

interface Props {
  readonly mode: SupervisorMode;
  readonly onModeChange: (mode: SupervisorMode) => void;
  readonly isVoiceConnected: boolean;
  readonly auditStatus: "idle" | "running" | "done";
}

export function KBSupervisorHeader({ mode, onModeChange, isVoiceConnected, auditStatus }: Props) {
  const navigate = useNavigate();

  return (
    <header className="border-b border-border px-4 py-2 flex items-center justify-between bg-card">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Brain className="w-5 h-5 text-primary" />
        <h1 className="font-semibold text-base">KB Supervisor</h1>

        {isVoiceConnected && (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Volume2 className="w-3 h-3" /> Audio ON
          </Badge>
        )}

        {auditStatus === "running" && (
          <Badge variant="secondary" className="text-[10px] animate-pulse">Audit in corso...</Badge>
        )}
        {auditStatus === "done" && (
          <Badge variant="default" className="text-[10px]">Audit completato</Badge>
        )}
      </div>

      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && onModeChange(v as SupervisorMode)}
        className="gap-1"
      >
        <ToggleGroupItem value="guided" size="sm" className="gap-1.5 text-xs">
          <Shield className="w-3.5 h-3.5" /> Guidato
        </ToggleGroupItem>
        <ToggleGroupItem value="autonomous" size="sm" className="gap-1.5 text-xs">
          <Zap className="w-3.5 h-3.5" /> Autonomo
        </ToggleGroupItem>
      </ToggleGroup>
    </header>
  );
}
