/**
 * AgentDetail — Vista a 5 colonne per un agente: avatar + Prompt + KB + Tools + Contract.
 */
import type { AgentRegistryEntry } from "@/data/agentPrompts";
import { AgentAvatarCard } from "./AgentAvatarCard";
import { PromptColumn } from "./columns/PromptColumn";
import { KBColumn } from "./columns/KBColumn";
import { ToolsColumn } from "./columns/ToolsColumn";
import { ContractColumn } from "./columns/ContractColumn";

export function AgentDetail({ agent }: { agent: AgentRegistryEntry }) {
  return (
    <div className="grid h-full grid-cols-1 gap-4 p-4 md:grid-cols-[260px_1fr] lg:grid-cols-[260px_1fr_1fr]">
      {/* Sinistra: avatar */}
      <div className="md:row-span-2 lg:row-span-1">
        <AgentAvatarCard agent={agent} />
      </div>

      {/* Centro: prompt */}
      <PromptColumn agent={agent} />

      {/* Destra: KB + Tools + Contract impilati */}
      <div className="space-y-4">
        <KBColumn agent={agent} />
        <ToolsColumn agent={agent} />
        <ContractColumn agent={agent} />
      </div>
    </div>
  );
}
