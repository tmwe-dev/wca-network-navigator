import "../_shared/llmFetchInterceptor.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";


serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });

    const { html, mode } = await req.json();
    // mode: "sidebar" = extract unread from sidebar HTML
    // mode: "thread"  = extract messages from open chat HTML

    if (!html || typeof html !== "string") {
      return new Response(
        JSON.stringify({ error: "html field required" }),
        {
          status: 400,
          headers: { ...dynCors, "Content-Type": "application/json" },
        }
      );
    }

    // Trim HTML to avoid token limits (keep max ~30k chars)
    const wasTruncated = html.length > 30000;
    const trimmedHtml = wasTruncated ? html.slice(0, 30000) : html;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY)
      throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt: string;
    let userPrompt: string;
    let toolName: string;
    let toolDescription: string;
    let itemSchema: unknown;

    if (mode === "learnDom") {
      systemPrompt = `Sei un esperto di CSS selector per WhatsApp Web. Il tuo compito è analizzare uno snapshot DOM e restituire i selettori CSS più STABILI per ogni elemento della UI.

REGOLE ASSOLUTE:
1. USA SOLO attributi stabili: [data-testid], [role], [aria-label], tag semantici (span[title], div[tabindex])
2. MAI usare classi CSS dinamiche/offuscate (es. x1n2onr6, _ak72, _3OvU8, x1lliihq) — cambiano ad ogni deploy di WhatsApp
3. Se un selettore stabile non esiste, restituisci null — NON inventare classi
4. I selettori devono funzionare dentro shadow DOM (WhatsApp usa shadow roots)

RESTITUISCI un oggetto JSON con ESATTAMENTE queste chiavi (nomi OBBLIGATORI — l'executor Optimus si aspetta questi esatti nomi):

PRIORITÀ ALTA (estrazione sidebar — CRITICI):
- "chatItem": selettore per UNA SINGOLA riga chat nella sidebar (es. '[role="row"]', '[data-testid="cell-frame-container"]', '[tabindex="-1"][role="listitem"]')
- "contactName": nome contatto/gruppo dentro una riga chat (es. 'span[title]', '[data-testid="cell-frame-title"] span[title]')
- "lastMessage": anteprima ultimo messaggio dentro una riga (es. '[data-testid="last-msg-status"] span[title]', 'span[title]:nth-child(2)')
- "timestamp": orario dentro una riga chat
- "unreadBadge": badge conteggio messaggi non letti (es. '[data-testid="icon-unread-count"]', 'span[data-testid*="unread"]')

PRIORITÀ MEDIA (navigazione):
- "chatList": contenitore scrollabile della lista chat (es. '[data-testid="chatlist"]', '[role="grid"]', '#pane-side')
- "searchBox": campo di ricerca in cima alla sidebar
- "mainHeader": header della chat aperta col nome contatto

PRIORITÀ BASSA (thread messaggi):
- "msgContainer": singolo messaggio bubble in un thread aperto (es. '[data-testid="msg-container"]', '[class*="message"][role="row"]')
- "msgText": testo dentro una bubble (es. '[data-testid="msg-text"] span', '.selectable-text span')
- "msgMeta": timestamp/meta dentro una bubble
- "composeBox": campo input messaggio (es. '[data-testid="conversation-compose-box-input"]', '[contenteditable="true"][role="textbox"]')
- "sendButton": pulsante invio messaggio

RILEVAMENTO STATO:
- "qrCode": elemento QR code (rilevamento login necessario)

NOTA: WhatsApp Web in italiano usa label come "Elenco chat", "Cerca", "Scrivi un messaggio".
Se trovi aria-label italiani, usali: [aria-label*="elenco" i], [aria-label*="cerca" i].

OPTIMUS V2 — SNAPSHOT RICCO:
Lo snapshot include per ogni chat item: outerHTML completo, catena antenati (3 livelli con tag/role/testid), prev/next sibling, lista spans con (text, title, dimensioni, bgColor, parentBgColor, parentBorderRadius), elementi con attributi stabili (role/aria-label/data-testid/title/tabindex/dir).
USA QUESTI DATI per dedurre selettori robusti:
- Se uno span ha title e dir="auto", è quasi sempre il nome contatto → usa span[title][dir="auto"]
- Se uno span ha parentBorderRadius >= 8 e text numerico 1-3 cifre, è un badge unread
- Se parentBgColor verde (rgb(37,211,...) o simili) + cifre, è badge unread
- In assenza di data-testid, preferisci role + aria-label + tag semantici + attributi strutturali

FEEDBACK SELETTORI PRECEDENTI:
Se lo snapshot include "failedSelectors", quei selettori sono stati provati e NON hanno funzionato. NON restituirli, proponi alternative diverse.

Restituisci SOLO JSON valido. Nessuna spiegazione, nessun markdown.`;

      userPrompt = `Analizza questo snapshot DOM di WhatsApp Web e restituisci i CSS selector:\n\n${trimmedHtml}`;
      toolName = "map_selectors";
      toolDescription = "CSS selectors for WhatsApp Web UI — keys must match executor expectations";
      itemSchema = {
        type: "object",
        properties: {
          chatItem: { type: "string", description: "Single chat row in sidebar" },
          contactName: { type: "string", description: "Contact/group name within a chat row" },
          lastMessage: { type: "string", description: "Last message preview within a chat row" },
          timestamp: { type: "string", description: "Time within a chat row" },
          unreadBadge: { type: "string", description: "Unread count badge within a chat row" },
          chatList: { type: "string", description: "Scrollable chat list container" },
          searchBox: { type: "string", description: "Search input at top of sidebar" },
          mainHeader: { type: "string", description: "Header of open chat showing contact name" },
          msgContainer: { type: "string", description: "Single message bubble in open thread" },
          msgText: { type: "string", description: "Text content inside a message bubble" },
          msgMeta: { type: "string", description: "Timestamp/meta inside a message bubble" },
          composeBox: { type: "string", description: "Message input box in open chat" },
          sendButton: { type: "string", description: "Send button" },
          qrCode: { type: "string", description: "QR code element for login detection" },
        },
        required: ["chatItem", "contactName"],
      };
    } else if (mode === "thread") {
      systemPrompt = `Sei un parser HTML specializzato per WhatsApp Web. Estrai i singoli messaggi da una conversazione WhatsApp aperta.

PER OGNI MESSAGGIO, ESTRAI:
- "direction": "outbound" se il messaggio è INVIATO DA ME, "inbound" se RICEVUTO
  COME DISTINGUERE:
  - Outbound: ha spunte (✓, ✓✓), icona check, classe "message-out", è allineato a destra, attributo data-testid contiene "out"
  - Inbound: nessuna spunta, classe "message-in", allineato a sinistra, attributo data-testid contiene "in"
- "text": il testo del messaggio. Per messaggi con media (immagine, video, audio, documento), metti "[media: tipo]" se il testo non c'è
- "timestamp": orario esatto come visualizzato (es. "14:30", "15:45"). WhatsApp mostra solo l'ora nei messaggi, non la data
- "contact": il nome del mittente. In chat 1-a-1: "me" per outbound, nome contatto per inbound. In gruppi: nome visibile sopra la bubble

MESSAGGI SPECIALI DA IGNORARE:
- Messaggi di sistema ("X ha cambiato il numero", "Messaggio eliminato", date separator come "OGGI", "IERI")
- Notifiche di sicurezza ("I messaggi sono crittografati end-to-end")

REGOLE:
- Ordina i messaggi dal più vecchio al più recente (ordine cronologico)
- Se un messaggio contiene solo emoji, includilo comunque
- Se un messaggio è stato eliminato ("Questo messaggio è stato eliminato"), includilo con text: "[eliminato]"
- Restituisci SOLO JSON array valido, nessun markdown, nessuna spiegazione
- Se non ci sono messaggi, restituisci []`;

      userPrompt = `Estrai tutti i messaggi da questa conversazione WhatsApp Web:\n\n${trimmedHtml}`;
      toolName = "extract_thread";
      toolDescription = "Extracted messages from WhatsApp conversation";
      itemSchema = {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["inbound", "outbound"], description: "Message direction" },
          text: { type: "string", description: "Message text or [media: type] or [eliminato]" },
          timestamp: { type: "string", description: "Time as displayed (HH:MM)" },
          contact: { type: "string", description: "Sender name (me for outbound)" },
        },
        required: ["direction", "text"],
      };
    } else {
      systemPrompt = `Sei un parser HTML specializzato per WhatsApp Web. Estrai le conversazioni NON LETTE dalla sidebar HTML di WhatsApp.

COME IDENTIFICARE CHAT NON LETTE:
- Badge numerico visibile (es. <span> con numero dentro un cerchio verde)
- Classe o attributo "unread" nel contenitore della chat
- Il badge mostra il numero di messaggi non letti

PER OGNI CHAT NON LETTA, ESTRAI:
- "contact": nome del contatto o gruppo (dal titolo, span[title], o header)
- "lastMessage": anteprima dell'ultimo messaggio (testo visibile sotto il nome)
- "time": timestamp esattamente come visualizzato (es. "14:30", "ieri", "12/03/2025", "lunedì")
- "unreadCount": numero di messaggi non letti (dal badge). Se il badge è visibile ma senza numero, metti 1

REGOLE:
- Includi SOLO chat con badge non-letto visibile. NON includere chat già lette.
- Se il badge contiene solo un punto/pallino senza numero, unreadCount = 1
- I timestamp in WhatsApp italiano usano: "oggi", "ieri", nomi giorni ("lunedì"), date (GG/MM/AAAA), orari (HH:MM)
- Se non trovi chat non lette, restituisci un array vuoto []
- Restituisci SOLO JSON array valido, nessun markdown, nessuna spiegazione.`;

      userPrompt = `Estrai le chat non lette da questa sidebar HTML di WhatsApp Web:\n\n${trimmedHtml}`;
      toolName = "extract_unread";
      toolDescription = "Unread chats from WhatsApp sidebar";
      itemSchema = {
        type: "object",
        properties: {
          contact: { type: "string", description: "Contact or group name" },
          lastMessage: { type: "string", description: "Last message preview text" },
          time: { type: "string", description: "Timestamp as displayed" },
          unreadCount: { type: "number", description: "Number of unread messages" },
        },
        required: ["contact"],
      };
    }

    // For learnDom, use a flat object schema instead of array
    const isLearnDom = mode === "learnDom";
    const toolSchema = isLearnDom
      ? { type: "object", properties: { selectors: itemSchema }, required: ["selectors"] }
      : { type: "object", properties: { items: { type: "array", items: itemSchema } }, required: ["items"] };

    // F1 — AbortController timeout 30s on AI gateway fetch
    // F6 — retry once on 429 with Retry-After backoff
    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 30000);
    let retried = false;

    const gatewayUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const gatewayHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };
    const selectedModel = mode === "learnDom" ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash-lite";
    const gatewayBody = JSON.stringify({
      model: selectedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: toolName,
            description: toolDescription,
            parameters: toolSchema,
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: toolName },
      },
    });

    let aiResponse: Response;
    try {
      aiResponse = await fetch(gatewayUrl, {
        method: "POST",
        headers: gatewayHeaders,
        body: gatewayBody,
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
      // F6 — retry once on 429
      if (aiResponse.status === 429 && !retried) {
        retried = true;
        const retryAfter = parseInt(aiResponse.headers.get("Retry-After") || "3", 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        const retryController = new AbortController();
        const retryTimer = setTimeout(() => retryController.abort(), 30000);
        try {
          const retryResponse = await fetch(gatewayUrl, {
            method: "POST",
            headers: gatewayHeaders,
            body: gatewayBody,
            signal: retryController.signal,
          });
          clearTimeout(retryTimer);
          if (retryResponse.ok) {
            aiResponse = retryResponse;
          } else {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded after retry" }),
              { status: 429, headers: { ...dynCors, "Content-Type": "application/json" } }
            );
          }
        } catch (retryErr) {
          clearTimeout(retryTimer);
          return new Response(
            JSON.stringify({ error: "Rate limit retry failed: " + ((retryErr as Error).message || "unknown") }),
            { status: 429, headers: { ...dynCors, "Content-Type": "application/json" } }
          );
        }
      } else {
        const errText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errText);

        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded, retry later" }),
            { status: 429, headers: { ...dynCors, "Content-Type": "application/json" } }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted" }),
            { status: 402, headers: { ...dynCors, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ error: "AI extraction failed" }),
          { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
        );
      }
    }

    const aiData = await aiResponse.json();
    
    // Extract from tool call response
    let items: Array<Record<string, unknown>> = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        if (isLearnDom) {
          // For learnDom, return the selectors object as a single-item array
          items = [parsed.selectors || parsed];
        } else {
          items = parsed.items || [];
        }
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Fallback: try content directly
    if (!items.length) {
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (isLearnDom) {
            items = [parsed.selectors || parsed];
          } else {
            items = Array.isArray(parsed) ? parsed : parsed.items || [];
          }
        } catch {
          console.error("Failed to parse AI content as JSON");
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        items,
        htmlLength: html.length,
        truncated: wasTruncated,
        original_length: html.length,
      }),
      {
        headers: { ...dynCors, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("whatsapp-ai-extract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...dynCors, "Content-Type": "application/json" },
      }
    );
  }
});
