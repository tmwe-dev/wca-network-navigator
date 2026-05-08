// Sprint 2 — Costruzione prompt (system + user) per la classificazione inbound.
// Estratto da stageClassifyAi.ts per restare sotto 200 LOC per file.

import { loadOperativePrompts } from "../../_shared/operativePromptsLoader.ts";
import type { RequestBody } from "./types.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

export async function buildClassificationPrompt(
  supabase: Sb,
  body: RequestBody,
): Promise<{ systemPrompt: string; userPrompt: string }> {
  const { channel, body_text, from_address, subject } = body;

  const channelHint = channel === "whatsapp"
    ? "This is a WhatsApp message (short, informal)."
    : channel === "linkedin"
    ? "This is a LinkedIn message (professional networking)."
    : "This is an email reply (business communication).";

  const fallbackSystemPrompt = `You are a B2B inbound message classifier for a logistics CRM.
${channelHint}

Classify the message and extract structured metadata using the provided tool.
Consider the channel context when evaluating tone and intent.`;

  let promptLabBlock = "";
  let hasSystemFromLab = false;
  if (body.user_id) {
    try {
      const opResult = await loadOperativePrompts(supabase, body.user_id, {
        scope: "classification",
        channel: channel as "email" | "whatsapp" | "linkedin",
        extraTags: ["system", "inbound"],
        includeUniversal: true,
        limit: 6,
      });
      if (opResult.block) {
        promptLabBlock = opResult.block;
        hasSystemFromLab = (opResult.appliedNames ?? []).some((n) => n === "Inbound Message System");
      }
    } catch (e) {
      console.warn("[classify-inbound-message] prompt lab load failed:", (e as Error).message);
    }
  }
  const systemPrompt = hasSystemFromLab
    ? `${channelHint}\n\n${promptLabBlock}`
    : `${fallbackSystemPrompt}${promptLabBlock ? `\n\n${promptLabBlock}` : ""}`;

  const { normalizeContent } = await import("../../_shared/contentNormalizer.ts");
  const { safeWrap } = await import("../../_shared/promptSanitizer.ts");
  const channelSource: "email-inbound" | "whatsapp-message" | "linkedin-message" =
    channel === "whatsapp" ? "whatsapp-message"
    : channel === "linkedin" ? "linkedin-message"
    : "email-inbound";
  const subjNorm = normalizeContent(subject || "", { source: channelSource, maxChars: 300 }).text;
  const bodyNorm = normalizeContent(body_text || "", { source: channelSource, maxChars: 3000 });
  const { block: bodyBlock } = safeWrap(bodyNorm.text, "INBOUND BODY", {
    source: channelSource,
    policy: "redact",
  });

  const userPrompt = `Channel: ${channel}
From: ${from_address}
Subject: ${subjNorm || "(none)"}
Body:
${bodyBlock}`;

  return { systemPrompt, userPrompt };
}