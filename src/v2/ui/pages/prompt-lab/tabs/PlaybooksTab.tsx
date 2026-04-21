/**
 * PlaybooksTab — commercial_playbooks split editor.
 */
import { useAuth } from "@/providers/AuthProvider";
import { GenericRecordTab } from "./GenericRecordTab";
import { findCommercialPlaybooks, updateCommercialPlaybook } from "@/data/commercialPlaybooks";
import type { Block } from "../types";
import { toast } from "sonner";

export function PlaybooksTab() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const loader = async (): Promise<Block[]> => {
    if (!userId) return [];
    const list = await findCommercialPlaybooks(userId);
    return list.flatMap<Block>((p) => [
      {
        id: `${p.id}::prompt_template`,
        label: `${p.name} — Prompt`,
        content: p.prompt_template ?? "",
        source: { kind: "playbook", id: p.id, field: "prompt_template" },
        dirty: false,
      },
      {
        id: `${p.id}::description`,
        label: `${p.name} — Descrizione`,
        content: p.description ?? "",
        source: { kind: "playbook", id: p.id, field: "description" },
        dirty: false,
      },
      {
        id: `${p.id}::trigger_conditions`,
        label: `${p.name} — Trigger (JSON)`,
        content: JSON.stringify(p.trigger_conditions ?? {}, null, 2),
        source: { kind: "playbook", id: p.id, field: "trigger_conditions" },
        dirty: false,
      },
    ]);
  };

  const saver = async (block: Block) => {
    if (block.source.kind !== "playbook") throw new Error("Source mismatch");
    if (block.source.field === "trigger_conditions") {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(block.content);
      } catch {
        toast.error("JSON non valido nei trigger_conditions");
        throw new Error("Invalid JSON");
      }
      await updateCommercialPlaybook(block.source.id, { trigger_conditions: parsed });
    } else {
      await updateCommercialPlaybook(block.source.id, {
        [block.source.field]: block.content,
      });
    }
    return { table: "commercial_playbooks", id: block.source.id };
  };

  return (
    <GenericRecordTab
      tabLabel="Playbooks"
      loader={loader}
      saver={saver}
      loaderDeps={[userId]}
      emptyMessage="Nessun playbook commerciale configurato."
    />
  );
}