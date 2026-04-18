import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_URL = "https://ai-gateway.lovable.dev/api/chat/completions";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // J8 — Auth check: require at least apikey or Authorization header
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("apikey");
    if (!authHeader && !apiKey) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const { mode, pageType, snapshot } = await req.json();

    if (mode !== "learnDom") {
      return new Response(JSON.stringify({ error: "Invalid mode. Use 'learnDom'" }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    if (!snapshot) {
      return new Response(JSON.stringify({ error: "snapshot is required" }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a DOM selector expert for LinkedIn web pages.
Given a structural snapshot of a LinkedIn ${pageType || "profile"} page, identify the most reliable CSS selectors for each UI element.

STRICT RULES:
- Prefer selectors using: [role], [aria-label], [data-testid], semantic tags (h1, nav, main, button)
- AVOID class-based selectors that contain random hashes or obfuscated names (e.g. x1n2onr6, _ak72, _3OvU8)
- If a class name looks semantic and stable (e.g., "msg-form", "profile-card"), you may use it
- Return ONLY a JSON object with the selector mappings
- Each value must be a valid CSS selector string, or null if not found

For a PROFILE page, return:
{
  "nameSelector": "CSS selector for the person's name",
  "headlineSelector": "CSS selector for the headline/title",
  "locationSelector": "CSS selector for the location",
  "aboutSelector": "CSS selector for the about section",
  "photoSelector": "CSS selector for the profile photo img",
  "connectButtonSelector": "CSS selector for the Connect button",
  "messageButtonSelector": "CSS selector for the Message button",
  "moreButtonSelector": "CSS selector for the More/Altro dropdown button"
}

For a MESSAGING / INBOX page (list of conversations), return:
{
  "threadItem": "CSS selector for a single conversation row in the inbox list (CRITICAL — must match individual rows)",
  "contactName": "CSS selector for the contact name within a conversation row",
  "lastMessage": "CSS selector for the last message preview within a conversation row",
  "timestamp": "CSS selector for the timestamp within a conversation row",
  "unreadBadge": "CSS selector for the unread indicator/badge within a conversation row",
  "messageInputSelector": "CSS selector for the message input box (when a thread is open)",
  "sendButtonSelector": "CSS selector for the send button"
}

For a THREAD page (open conversation with messages), return:
{
  "messageItem": "CSS selector for a single message bubble/row in the thread (CRITICAL)",
  "senderName": "CSS selector for the sender name within a message",
  "messageText": "CSS selector for the message text content within a message",
  "timestamp": "CSS selector for the message timestamp within a message",
  "messageInputSelector": "CSS selector for the message input box",
  "sendButtonSelector": "CSS selector for the send button"
}

Return ONLY valid JSON. No explanation, no markdown.`;

    const userPrompt = `Page type: ${pageType || "profile"}
URL: ${snapshot.url || "unknown"}
Title: ${snapshot.title || "unknown"}

Data-testid attributes found: ${JSON.stringify(snapshot.dataTestIds?.slice(0, 20) || [])}

ARIA labels found: ${JSON.stringify(snapshot.ariaLabels?.slice(0, 20) || [])}

Roles found: ${JSON.stringify(snapshot.roles?.slice(0, 20) || [])}

Headings: ${JSON.stringify(snapshot.headings || [])}

Visible buttons: ${JSON.stringify(snapshot.buttons?.slice(0, 15) || [])}

Textboxes: ${JSON.stringify(snapshot.textboxes || [])}

HTML samples:
${Object.entries(snapshot.htmlSamples || {}).map(([k, v]) => `--- ${k} ---\n${(v as string).substring(0, 800)}`).join("\n\n")}`;

    const aiResponse = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI call failed", status: aiResponse.status }), {
        status: 502,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response (may be wrapped in markdown code block)
    let schema: Record<string, string> = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        schema = JSON.parse(jsonMatch[0]);
      }
    } catch (_parseErr) {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse AI selectors", raw: content }), {
        status: 500,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, schema, pageType }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("linkedin-ai-extract error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
