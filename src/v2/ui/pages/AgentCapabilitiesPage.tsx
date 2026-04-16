/**
 * AgentCapabilitiesPage — visual report of agent tool coverage, usage, and gaps
 */
import { useState } from "react";
import { useAgentCapabilities, type AgentCapability } from "@/v2/hooks/useAgentCapabilities";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AGENT_ROLES } from "@/data/agentTemplates/roles";
import { Bot, AlertTriangle, CheckCircle2, BarChart3, Loader2 } from "lucide-react";

function coverageColor(pct: number) {
  if (pct >= 60) return "text-emerald-400";
  if (pct >= 30) return "text-yellow-400";
  return "text-red-400";
}

function progressColor(pct: number) {
  if (pct >= 60) return "[&>div]:bg-emerald-500";
  if (pct >= 30) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-red-500";
}

function getRoleInfo(role: string) {
  return AGENT_ROLES.find((r) => r.value === role);
}

function AgentDetail({ agent }: { agent: AgentCapability }) {
  const roleInfo = getRoleInfo(agent.role);
  const missingCategories = Object.entries(agent.missingByCategory);
  const taskEntries = Object.entries(agent.taskUsage).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{agent.avatarEmoji}</span>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{agent.name}</h2>
          <div className="flex items-center gap-2">
            {roleInfo && (
              <Badge variant="outline" className={roleInfo.color}>
                {roleInfo.emoji} {roleInfo.label}
              </Badge>
            )}
            <Badge variant={agent.isActive ? "default" : "secondary"}>
              {agent.isActive ? "Attivo" : "Inattivo"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Coverage */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Tool Assegnati
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {agent.assignedCount} / {agent.totalTools} tool
            </span>
            <span className={`font-bold ${coverageColor(agent.coveragePercent)}`}>
              {agent.coveragePercent}%
            </span>
          </div>
          <Progress value={agent.coveragePercent} className={`h-3 ${progressColor(agent.coveragePercent)}`} />
          {agent.assignedTools.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {agent.assignedTools.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs font-mono">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Utilizzo (da agent_tasks)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {taskEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun task registrato</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-2">
                Totale: <span className="font-semibold text-foreground">{agent.totalTasks}</span> task
              </p>
              <div className="flex flex-wrap gap-2">
                {taskEntries.map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type}: <span className="font-bold ml-1">{count}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gaps */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            Gap Operativi ({agent.missingTools.length} tool mancanti)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {missingCategories.length === 0 ? (
            <p className="text-sm text-emerald-400">✅ Nessun gap — copertura completa!</p>
          ) : (
            <div className="space-y-3">
              {missingCategories.map(([cat, tools]) => (
                <div key={cat}>
                  <p className="text-sm font-medium text-foreground mb-1">{cat}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tools.map((t) => (
                      <Badge key={t} variant="destructive" className="text-xs font-mono opacity-80">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AgentCapabilitiesPage() {
  const { data: agents, isLoading } = useAgentCapabilities();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeAgents = agents?.filter((a) => a.isActive) ?? [];
  const selected = agents?.find((a) => a.id === selectedId) ?? activeAgents[0] ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Capacità Agenti AI</h1>
            <p className="text-sm text-muted-foreground">
              Copertura tool, utilizzo e gap operativi per ogni agente
            </p>
          </div>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Tool totali: <strong className="text-foreground">{agents?.[0]?.totalTools ?? 0}</strong></span>
          <span>Agenti attivi: <strong className="text-foreground">{activeAgents.length}</strong></span>
        </div>
      </div>

      {/* Agent Tabs + Detail */}
      {agents && agents.length > 0 ? (
        <Tabs
          value={selected?.id ?? ""}
          onValueChange={setSelectedId}
          className="space-y-4"
        >
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1.5">
            {agents.map((a) => (
              <TabsTrigger
                key={a.id}
                value={a.id}
                className="flex items-center gap-1.5 text-xs"
              >
                <span>{a.avatarEmoji}</span>
                <span>{a.name}</span>
                <span className={`font-bold ${coverageColor(a.coveragePercent)}`}>
                  {a.coveragePercent}%
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {agents.map((a) => (
            <TabsContent key={a.id} value={a.id}>
              <AgentDetail agent={a} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p className="text-muted-foreground">Nessun agente trovato.</p>
      )}
    </div>
  );
}
