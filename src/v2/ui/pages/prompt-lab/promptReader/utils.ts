import { toast } from "sonner";
import type { AgentRegistryEntry } from "@/data/agentPrompts";
import type { KbEntry } from "@/data/kbEntries";

export function copy(text: string, label = "Prompt") {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiato`),
    () => toast.error("Copia fallita"),
  );
}

export function downloadText(filename: string, text: string, mime = "text/markdown") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function kbForAgent(all: KbEntry[], agent: AgentRegistryEntry): KbEntry[] {
  const cats = new Set(agent.kbCategories);
  return all
    .filter((e) => e.is_active && cats.has(e.category))
    .sort((a, b) =>
      a.category.localeCompare(b.category) ||
      (a.chapter ?? "").localeCompare(b.chapter ?? "") ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
}