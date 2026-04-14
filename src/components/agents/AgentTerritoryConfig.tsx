import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, X, Plus } from "lucide-react";
import type { Agent } from "@/hooks/useAgents";
import { useAgents } from "@/hooks/useAgents";
import { toast } from "sonner";

const COMMON_COUNTRIES = [
  { code: "IT", label: "🇮🇹 Italia" },
  { code: "DE", label: "🇩🇪 Germania" },
  { code: "FR", label: "🇫🇷 Francia" },
  { code: "ES", label: "🇪🇸 Spagna" },
  { code: "GB", label: "🇬🇧 Regno Unito" },
  { code: "US", label: "🇺🇸 USA" },
  { code: "NL", label: "🇳🇱 Olanda" },
  { code: "BE", label: "🇧🇪 Belgio" },
  { code: "AT", label: "🇦🇹 Austria" },
  { code: "CH", label: "🇨🇭 Svizzera" },
  { code: "PT", label: "🇵🇹 Portogallo" },
  { code: "PL", label: "🇵🇱 Polonia" },
  { code: "TR", label: "🇹🇷 Turchia" },
  { code: "BR", label: "🇧🇷 Brasile" },
  { code: "IN", label: "🇮🇳 India" },
  { code: "CN", label: "🇨🇳 Cina" },
  { code: "JP", label: "🇯🇵 Giappone" },
  { code: "AE", label: "🇦🇪 EAU" },
  { code: "ZA", label: "🇿🇦 Sudafrica" },
  { code: "MX", label: "🇲🇽 Messico" },
];

interface Props {
  agent: Agent;
}

export function AgentTerritoryConfig({ agent }: Props) {
  const { updateAgent } = useAgents();
  const [customCode, setCustomCode] = useState("");
  const territories = agent.territory_codes ?? [];

  const toggle = (code: string) => {
    const next = territories.includes(code)
      ? territories.filter(c => c !== code)
      : [...territories, code];
    updateAgent.mutate(
      { id: agent.id, territory_codes: next } as Parameters<typeof updateAgent.mutate>[0],
      { onSuccess: () => toast.success("Zone aggiornate") }
    );
  };

  const addCustom = () => {
    const code = customCode.toUpperCase().trim();
    if (code.length < 2 || territories.includes(code)) return;
    updateAgent.mutate(
      { id: agent.id, territory_codes: [...territories, code] } as Parameters<typeof updateAgent.mutate>[0],
      { onSuccess: () => { toast.success(`${code} aggiunto`); setCustomCode(""); } }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Zone di Competenza</h3>
        <span className="text-xs text-muted-foreground">({territories.length} paesi)</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Seleziona i paesi che questo agente gestisce. I contatti da questi paesi verranno assegnati automaticamente.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {COMMON_COUNTRIES.map(c => {
          const active = territories.includes(c.code);
          return (
            <Badge
              key={c.code}
              variant={active ? "default" : "outline"}
              className={`cursor-pointer text-xs transition-colors ${
                active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
              onClick={() => toggle(c.code)}
            >
              {c.label}
              {active && <X className="w-3 h-3 ml-1" />}
            </Badge>
          );
        })}
      </div>

      {/* Custom country code */}
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Altro codice (es. KR)"
          value={customCode}
          onChange={e => setCustomCode(e.target.value)}
          className="h-8 w-32 text-xs"
          maxLength={3}
        />
        <Button size="sm" variant="outline" className="h-8" onClick={addCustom} disabled={customCode.length < 2}>
          <Plus className="w-3 h-3 mr-1" /> Aggiungi
        </Button>
      </div>

      {/* Show custom codes not in common list */}
      {territories.filter(t => !COMMON_COUNTRIES.find(c => c.code === t)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {territories.filter(t => !COMMON_COUNTRIES.find(c => c.code === t)).map(code => (
            <Badge key={code} className="cursor-pointer text-xs bg-primary text-primary-foreground" onClick={() => toggle(code)}>
              {code} <X className="w-3 h-3 ml-1" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
