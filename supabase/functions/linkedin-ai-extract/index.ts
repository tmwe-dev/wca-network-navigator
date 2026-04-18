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

    const systemPrompt = `Sei un esperto di CSS selector per pagine LinkedIn. Analizza lo snapshot strutturale e identifica i selettori CSS più affidabili.

REGOLE:
- Preferisci: [role], [aria-label], [data-testid], tag semantici (h1, h2, h3, nav, main, button)
- Puoi usare classi SEMANTICHE e STABILI (es. "msg-form", "profile-card", "msg-conversation-card")
- EVITA classi randomizzate/offuscate (es. x1n2onr6, _ak72, _3OvU8)
- Restituisci SOLO un oggetto JSON. Ogni valore: stringa CSS selector oppure null
- LinkedIn in italiano usa label come "Messaggistica", "Connetti", "Altro", "Invia"

Per pagina ${pageType || "profile"}, restituisci:
${(pageType === "messaging" || pageType === "inbox") ? `{
  "threadItem": "selettore per UNA SINGOLA riga conversazione nella lista inbox (CRITICO — deve matchare righe individuali, es. li[class*='msg-conversation-card'], [data-control-name*='conversation'])",
  "contactName": "nome contatto dentro una riga conversazione (es. h3, span[class*='participant'])",
  "lastMessage": "anteprima ultimo messaggio (es. p[class*='body'], span[class*='snippet'])",
  "timestamp": "timestamp dentro una riga (es. time, [class*='time'])",
  "unreadBadge": "indicatore non-letto (es. [class*='unread'], span[class*='badge'])",
  "threadUrl": "link alla conversazione (es. a[href*='/messaging/thread/'])",
  "messageInputSelector": "campo input messaggio (quando un thread è aperto)",
  "sendButtonSelector": "pulsante invio"
}` : (pageType === "thread") ? `{
  "messageItem": "selettore per UN SINGOLO messaggio/bubble nel thread (CRITICO, es. li[class*='msg-s-event'], [class*='msg-s-message'])",
  "senderName": "nome mittente dentro un messaggio (es. h3[class*='name'], span[class*='sender'])",
  "messageText": "testo del messaggio (es. p[class*='body'], [class*='msg-s-event-body'] p)",
  "timestamp": "timestamp del messaggio (es. time, [class*='time'])",
  "direction": "indicatore se il messaggio è mio o dell'altro (es. classe 'msg-s-event--outbound' vs non presente)",
  "messageInputSelector": "campo input messaggio",
  "sendButtonSelector": "pulsante invio"
}` : `{
  "nameSelector": "nome della persona (es. h1)",
  "headlineSelector": "headline/titolo professionale",
  "locationSelector": "località",
  "aboutSelector": "sezione about/informazioni",
  "photoSelector": "foto profilo img",
  "connectButtonSelector": "pulsante Connetti/Connect",
  "messageButtonSelector": "pulsante Messaggio/Message",
  "moreButtonSelector": "pulsante Altro/More dropdown"
}`}

Restituisci SOLO JSON valido. Nessuna spiegazione, nessun markdown.`;

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

    // J7 — Timeout 30s + AbortController on AI gateway fetch
    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 30000);

    let aiResponse: Response;
    try {
      aiResponse = await fetch(AI_URL, {
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
        signal: aiController.signal,
      });
      clearTimeout(aiTimeout);
    } catch (fetchErr) {
      clearTimeout(aiTimeout);
      if ((fetchErr as Error).name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "AI gateway timeout (30s)" }),
          { status: 504, headers: { ...dynCors, "Content-Type": "application/json" } }
        );
      }
      throw fetchErr;
    }

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
