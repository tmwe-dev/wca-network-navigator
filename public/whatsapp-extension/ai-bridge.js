// ==================================================
// WhatsApp Extension v5.4 — AI Bridge Module
// Routes all Supabase edge function calls through
// the webapp bridge to avoid CORS issues.
// Extension (chrome-extension://) cannot call Supabase
// directly — only the webapp (https://*.lovable.app)
// can.
// ==================================================

var AiBridge = globalThis.AiBridge || (function () {

  let _pendingRequests = {};
  let _requestCounter = 0;

  // Generate unique request ID
  function generateId() {
    _requestCounter++;
    return "aib_" + Date.now() + "_" + _requestCounter;
  }

  // Send a request to the webapp via the content script bridge
  // The webapp will call the Supabase edge function and return the result
  async function callViaWebapp(functionName, payload, timeoutMs) {
    const timeout = timeoutMs || 30000;
    const requestId = generateId();

    // Find a tab running our webapp to relay through (prefer active tab)
    let appTab = null;
    try {
      const tabs = await chrome.tabs.query({});
      const candidates = [];
      for (let i = 0; i < tabs.length; i++) {
        const url = tabs[i].url || "";
        if (
          url.match(/lovable\.app/i) ||
          url.match(/lovableproject\.com/i) ||
          url.match(/localhost/i) ||
          url.match(/127\.0\.0\.1/i)
        ) {
          candidates.push(tabs[i]);
        }
      }
      if (candidates.length > 0) {
        appTab = candidates.find((t) => t.active) || candidates[0];
      }
    } catch (e) {
      console.error("[AiBridge] Tab query failed:", e);
    }

    if (!appTab) {
      console.warn("[AiBridge] No webapp tab found for bridge relay");
      return null;
    }

    return new Promise(function (resolve) {
      var timer = setTimeout(function () {
        delete _pendingRequests[requestId];
        console.warn("[AiBridge] Request timed out:", functionName);
        resolve(null);
      }, timeout);

      _pendingRequests[requestId] = function (response) {
        clearTimeout(timer);
        delete _pendingRequests[requestId];
        resolve(response);
      };

      // Send to content script in the webapp tab
      chrome.tabs.sendMessage(appTab.id, {
        source: "wa-background-bridge",
        type: "ai-bridge-request",
        requestId: requestId,
        functionName: functionName,
        payload: payload,
      }).catch(function (e) {
        clearTimeout(timer);
        delete _pendingRequests[requestId];
        console.warn("[AiBridge] sendMessage failed:", e);
        resolve(null);
      });
    });
  }

  // Handle response from webapp (called by background.js message listener)
  function handleResponse(message) {
    if (!message || message.type !== "ai-bridge-response") return false;
    var requestId = message.requestId;
    if (requestId && _pendingRequests[requestId]) {
      _pendingRequests[requestId](message.data || null);
      return true;
    }
    return false;
  }

  // Convenience: call whatsapp-ai-extract edge function via webapp
  async function callAiExtract(html, mode) {
    return await callViaWebapp("whatsapp-ai-extract", { html: html, mode: mode }, 30000);
  }

  return {
    callViaWebapp: callViaWebapp,
    handleResponse: handleResponse,
    callAiExtract: callAiExtract,
  };
})();
globalThis.AiBridge = AiBridge;
