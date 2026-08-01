import { describe, expect, it } from "vitest";
import { parseDesiredInventoryDetailed } from "@/v2/ui/pages/prompt-lab/hooks/harmonizeCollector";

describe("harmonizeCollector placeholder detection", () => {
  it("blocks the explicit repo placeholder stub", () => {
    const source = `# Libreria TMWE\n\n## 📄 Placeholder\n**Categoria suggerita:** doctrine\n\nSostituire questo file con la libreria reale.`;

    const result = parseDesiredInventoryDetailed(source, []);

    expect(result.diagnostics.placeholder_detected).toBe(true);
  });

  it("does not block a real large document that mentions placeholder in intro text", () => {
    const sections = Array.from({ length: 12 }, (_, index) => `## 📄 Voce ${index + 1}\n**Categoria suggerita:** doctrine\n**Capitolo:** c${index + 1}\n**Priorità:** 50\n\nQuesto blocco contiene contenuto reale molto esteso per la libreria TMWE. `.repeat(6)).join("\n\n");

    const source = `# Libreria TMWE completa\n\nNota editoriale: la parola placeholder compare qui solo come esempio storico e non indica uno stub.\n\n${sections}`;

    const result = parseDesiredInventoryDetailed(source, []);

    expect(result.diagnostics.placeholder_detected).toBe(false);
    expect(result.diagnostics.desired_parsed_count).toBeGreaterThan(0);
    expect(result.diagnostics.parse_mode).toBe("structured");
  });
});