/**
 * AgentDetailDrawer — Agent detail side panel
 */
import * as React from "react";
import type { Agent } from "@/v2/core/domain/entities";
import { agentReadinessScore } from "@/v2/core/domain/rules/agent-rules";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import { X, Globe, Zap, Shield } from "lucide-react";

interface AgentDetailDrawerProps {
  readonly agent: Agent | null;
  readonly onClose: () => void;
}

export function AgentDetailDrawer({
  agent,
  onClose,
}: AgentDetailDrawerProps): React.ReactElement | null {
  if (!agent) return null;

  const score = agentReadinessScore(agent);
  const scoreColor = score >= 70 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md border-l bg-card shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{agent.avatarEmoji}</span>
          <h2 className="text-lg font-semibold text-foreground">{agent.name}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold ${scoreColor}`}>{score}%</div>
          <div>
            <p className="text-sm font-medium">Prontezza</p>
            <StatusBadge
              status={agent.isActive ? "success" : "neutral"}
              label={agent.isActive ? "Attivo" : "Inattivo"}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Ruolo</p>
              <p className="text-sm text-foreground">{agent.role}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Territori</p>
              <p className="text-sm text-foreground">
                {agent.territoryCodes.length > 0 ? agent.territoryCodes.join(", ") : "Globale"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Zap className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Tools assegnati</p>
              <p className="text-sm text-foreground">{agent.assignedTools.length} tool</p>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">System Prompt</p>
          <div className="text-sm text-foreground whitespace-pre-wrap border rounded p-3 bg-background max-h-48 overflow-y-auto">
            {agent.systemPrompt || "Nessun prompt configurato"}
          </div>
        </div>

        {agent.signatureHtml ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Firma email</p>
            <div
              className="text-sm border rounded p-3 bg-background"
              dangerouslySetInnerHTML={{ __html: agent.signatureHtml }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
