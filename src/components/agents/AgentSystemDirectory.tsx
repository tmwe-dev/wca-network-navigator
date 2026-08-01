import { useSystemDirectory } from "@/hooks/useSystemDirectory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, Cog, Loader2 } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  outreach: "Outreach",
  sales: "Sales",
  download: "Download",
  research: "Ricerca",
  account: "Director",
  strategy: "Strategia",
};

export function AgentSystemDirectory() {
  const { data: directory, isLoading } = useSystemDirectory();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!directory) return null;

  return (
    <div className="space-y-4">
      {/* Team Roster */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Agenti ({directory.agents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {directory.agents.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span>{agent.avatar_emoji}</span>
                <span className="font-medium">{agent.name}</span>
                <Badge variant={agent.is_active ? "default" : "secondary"} className="text-xs px-1.5 py-0">
                  {ROLE_LABELS[agent.role] || agent.role}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{agent.clientCount} clienti</span>
                <span>{agent.activeTaskCount} task</span>
                <span>{agent.stats.tasks_completed} ✓</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Prompt Operativi */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Prompt Operativi ({directory.prompts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {directory.prompts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun prompt operativo configurato</p>
          ) : (
            directory.prompts.map((prompt) => (
              <div key={prompt.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{prompt.name}</span>
                  {!prompt.is_active && <Badge variant="outline" className="text-xs">OFF</Badge>}
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {prompt.objective || "—"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Processi Sistema */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Cog className="h-4 w-4" />
            Processi Sistema ({directory.processes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {directory.processes.map((proc, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{proc.name}</span>
                <Badge variant="outline" className="text-xs">{proc.section}</Badge>
              </div>
              <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                {proc.description}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
