/**
 * aliasGenerator.ts — Inline alias generation for companies and contacts.
 *
 * Uses LLM to normalize company names and extract contact surnames.
 */
import { aiChat } from "../_shared/aiGateway.ts";

export async function generateAliasesInline(
  companyName: string,
  contactName: string | null,
  contactTitle: string | null,
): Promise<{ company_alias: string; contact_alias: string }> {
  const prompt = `Genera alias per:
- Azienda: "${companyName}" → rimuovi suffissi legali (SRL, LLC, Ltd, GmbH, etc.) e città dal nome
- Contatto: "${contactName || ""}" (ruolo: ${contactTitle || "N/A"}) → usa SOLO il cognome, rimuovi titoli (Mr., Mrs., Dr., etc.). Se sembra un ruolo e non un nome di persona, restituisci ""

Rispondi SOLO con JSON: {"company_alias":"...","contact_alias":"..."}`;
  try {
    const result = await aiChat({
      models: ["google/gemini-2.5-flash-lite"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 100,
      timeoutMs: 8000,
      context: "generate-email:alias",
    });
    const text = result.content || "";
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Inline alias generation failed:", e);
  }
  return { company_alias: "", contact_alias: "" };
}
