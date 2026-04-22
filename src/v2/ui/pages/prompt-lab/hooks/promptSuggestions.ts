/**
 * promptSuggestions.ts - Functions for generating improvement suggestions
 * Generates AI suggestions and actionable improvements for prompts
 */

import type { Block } from "../types";

/** Generates improvement suggestions based on prompt analysis. */
export function generateImprovementSuggestions(
  content: string,
  context: string
): string[] {
  const suggestions: string[] = [];

  if (!content.includes("Esempio") && !content.includes("example")) {
    suggestions.push(
      "Aggiungere un esempio concreto per chiarire il risultato atteso"
    );
  }

  if (content.length < 100) {
    suggestions.push("Espandere il prompt con più dettagli e contesto");
  }

  if (!content.includes("struttura") && !content.includes("format")) {
    suggestions.push(
      "Specificare il formato o la struttura del risultato desiderato"
    );
  }

  if (context.length > 0 && !content.toLowerCase().includes("contesto")) {
    suggestions.push("Integrare il contesto fornito nel prompt");
  }

  return suggestions;
}

/** Suggests structural improvements for a prompt. */
export function suggestStructure(content: string): string {
  const lines = content.split("\n");
  if (!content.includes("#")) {
    return content
      .split("\n")
      .map((line, i) => {
        if (i === 0 && line.trim()) return `# ${line}`;
        if (line.trim() && !line.startsWith("#")) return `## ${line}`;
        return line;
      })
      .join("\n");
  }
  return content;
}

/** Suggests tone adjustments for the prompt. */
export function suggestToneAdjustment(
  content: string,
  targetTone: string = "professional"
): string {
  let adjusted = content;

  if (targetTone === "professional") {
    adjusted = adjusted
      .replace(/\b(devo|need to)\b/gi, "è necessario")
      .replace(/\b(voglio|want)\b/gi, "richiedere");
  } else if (targetTone === "friendly") {
    adjusted = adjusted
      .replace(/\b(è necessario)\b/gi, "potresti")
      .replace(/\b(richiedere)\b/gi, "mi piacerebbe");
  }

  return adjusted;
}

/** Adds examples to a prompt if missing. */
export function addExamplesToPrompt(content: string, example: string): string {
  if (content.includes("Esempio") || content.includes("example")) {
    return content;
  }

  return (
    content +
    "\n\n### Esempio\n" +
    example.split("\n").map((line) => `${line}`).join("\n")
  );
}
