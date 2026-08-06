/**
 * Pure formatting helpers per i token (nessun accesso DB).
 * Estratti da @/data/tokenUsage per rispettare la regola layer
 * (i componenti non importano da @/data).
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(1) + "M";
  }
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + "K";
  }
  return tokens.toString();
}

/**
 * Get friendly function name for display
 */
export function getFunctionDisplayName(functionName: string): string {
  const nameMap: Record<string, string> = {
    generate_email: "Genera Email",
    generate_outreach: "Genera Outreach",
    improve_email: "Migliora Email",
    classify_email: "Classifica Email",
    ai_assistant: "Assistente AI",
  };
  return nameMap[functionName] || functionName;
}
