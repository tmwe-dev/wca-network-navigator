/**
 * AgentPersonasTab — agent_personas split editor.
 */
import { useAuth } from "@/providers/AuthProvider";
import { GenericRecordTab } from "./GenericRecordTab";
import { findAgentPersonas, updateAgentPersona } from "@/data/agentPersonas";
import type { Block } from "../types";

const TEXT_FIELDS = ["custom_tone_prompt", "signature_template"] as const;
const ARRAY_FIELDS = ["style_rules", "vocabulary_do", "vocabulary_dont"] as const;

export function AgentPersonasTab() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const loader = async (): Promise<Block[]> => {
    if (!userId) return [];
    const list = await findAgentPersonas(userId);
    return list.flatMap<Block>((p) => {
      const blocks: Block[] = [];
      const label = `Persona ${p.agent_id.slice(0, 8)}`;
      for (const f of TEXT_FIELDS) {
        blocks.push({
          id: `${p.id}::${f}`,
          label: `${label} — ${f}`,
          content: (p[f] as string | null) ?? "",
          source: { kind: "agent_persona", id: p.id, field: f },
          dirty: false,
        });
      }
      for (const f of ARRAY_FIELDS) {
        const val = (p[f] as string[] | null) ?? [];
        blocks.push({
          id: `${p.id}::${f}`,
          label: `${label} — ${f} (1 per riga)`,
          content: val.join("\n"),
          source: { kind: "agent_persona", id: p.id, field: f },
          dirty: false,
        });
      }
      return blocks;
    });
  };

  const saver = async (block: Block) => {
    if (block.source.kind !== "agent_persona") throw new Error("Source mismatch");
    const field = block.source.field;
    if (field === "style_rules" || field === "vocabulary_do" || field === "vocabulary_dont") {
      const arr = block.content.split("\n").map((s) => s.trim()).filter(Boolean);
      await updateAgentPersona(block.source.id, { [field]: arr });
    } else {
      await updateAgentPersona(block.source.id, { [field]: block.content });
    }
    return { table: "agent_personas", id: block.source.id };
  };

  return (
    <GenericRecordTab
      tabLabel="Agent Personas"
      loader={loader}
      saver={saver}
      loaderDeps={[userId]}
      emptyMessage="Nessuna persona configurata."
    />
  );
}