/**
 * OperativePromptsTab — operative_prompts: campi objective/procedure/criteria/context/examples.
 */
import { useAuth } from "@/providers/AuthProvider";
import { GenericRecordTab } from "./GenericRecordTab";
import { findOperativePromptsFull, updateOperativePrompt } from "@/data/operativePrompts";
import type { Block } from "../types";

const FIELDS = ["objective", "procedure", "criteria", "context", "examples"] as const;
type Field = typeof FIELDS[number];

export function OperativePromptsTab() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const loader = async (): Promise<Block[]> => {
    if (!userId) return [];
    const list = await findOperativePromptsFull(userId);
    return list.flatMap((p) =>
      FIELDS.map<Block>((field) => ({
        id: `${p.id}::${field}`,
        label: `${p.name} — ${field}`,
        content: (p[field] as string | null) ?? "",
        source: { kind: "operative_prompt", id: p.id, field },
        dirty: false,
      })),
    );
  };

  const saver = async (block: Block) => {
    if (block.source.kind !== "operative_prompt") throw new Error("Source mismatch");
    const field = block.source.field as Field;
    await updateOperativePrompt(block.source.id, { [field]: block.content });
    return { table: "operative_prompts", id: block.source.id };
  };

  return (
    <GenericRecordTab
      tabLabel="Operative"
      loader={loader}
      saver={saver}
      loaderDeps={[userId]}
      emptyMessage="Nessun operative prompt configurato."
    />
  );
}