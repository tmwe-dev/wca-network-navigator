// ══════════════════════════════════════════════════
// AI DOM Learning Module for LinkedIn
// Self-healing: captures DOM snapshot → AI generates selectors → caches
// ══════════════════════════════════════════════════

var AILearn = (function () {
  var CACHE_KEY = "li_dom_schema";
  var CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours
  var _learning = false;

  // Get cached schema from chrome.storage.local
  async function getCached() {
    try {
      var data = await chrome.storage.local.get(CACHE_KEY);
      if (data && data[CACHE_KEY]) {
        var schema = data[CACHE_KEY];
        if (schema.learnedAt && Date.now() - schema.learnedAt < CACHE_TTL) {
          return schema;
        }
      }
    } catch (_) {}
    return null;
  }

  // Save schema to cache
  async function saveSchema(schema) {
    schema.learnedAt = Date.now();
    var obj = {};
    obj[CACHE_KEY] = schema;
    await chrome.storage.local.set(obj);
    return schema;
  }

  // Clear cached schema (force re-learn)
  async function clearCache() {
    await chrome.storage.local.remove(CACHE_KEY);
  }

  // Capture DOM snapshot for AI analysis (injected into page)
  function captureDomSnapshot() {
    try {
      var snapshot = {
        url: window.location.href,
        title: document.title,
        dataTestIds: [],
        ariaLabels: [],
        roles: [],
        headings: [],
        buttons: [],
        textboxes: [],
        links: [],
        htmlSamples: {},
      };

      // Collect data-testid attributes
      var testIds = document.querySelectorAll("[data-testid]");
      for (var i = 0; i < Math.min(testIds.length, 50); i++) {
        snapshot.dataTestIds.push({
          id: testIds[i].getAttribute("data-testid"),
          tag: testIds[i].tagName.toLowerCase(),
          text: (testIds[i].textContent || "").trim().substring(0, 80),
        });
      }

      // Collect aria-label attributes
      var ariaEls = document.querySelectorAll("[aria-label]");
      for (var j = 0; j < Math.min(ariaEls.length, 50); j++) {
        snapshot.ariaLabels.push({
          label: ariaEls[j].getAttribute("aria-label"),
          tag: ariaEls[j].tagName.toLowerCase(),
          role: ariaEls[j].getAttribute("role") || "",
        });
      }

      // Collect role attributes
      var roleEls = document.querySelectorAll("[role]");
      for (var k = 0; k < Math.min(roleEls.length, 50); k++) {
        snapshot.roles.push({
          role: roleEls[k].getAttribute("role"),
          tag: roleEls[k].tagName.toLowerCase(),
          text: (roleEls[k].textContent || "").trim().substring(0, 60),
          ariaLabel: roleEls[k].getAttribute("aria-label") || "",
        });
      }

      // Collect headings
      var headings = document.querySelectorAll("h1, h2, h3");
      for (var h = 0; h < Math.min(headings.length, 20); h++) {
        snapshot.headings.push({
          level: headings[h].tagName,
          text: (headings[h].textContent || "").trim().substring(0, 100),
          classes: (headings[h].className || "").substring(0, 100),
        });
      }

      // Collect visible buttons
      var buttons = document.querySelectorAll("button");
      for (var b = 0; b < Math.min(buttons.length, 30); b++) {
        if (buttons[b].offsetParent === null) continue;
        snapshot.buttons.push({
          text: (buttons[b].textContent || "").trim().substring(0, 60),
          ariaLabel: buttons[b].getAttribute("aria-label") || "",
          classes: (buttons[b].className || "").substring(0, 100),
        });
      }

      // Collect textboxes / contenteditables
      var textboxes = document.querySelectorAll("[contenteditable='true'], textarea, input[type='text']");
      for (var t = 0; t < Math.min(textboxes.length, 10); t++) {
        snapshot.textboxes.push({
          tag: textboxes[t].tagName.toLowerCase(),
          role: textboxes[t].getAttribute("role") || "",
          classes: (textboxes[t].className || "").substring(0, 100),
          placeholder: textboxes[t].getAttribute("placeholder") || textboxes[t].getAttribute("aria-placeholder") || "",
        });
      }

      // HTML samples of key areas
      var areas = {
        navBar: "nav, header, [role='banner']",
        mainContent: "main, [role='main']",
        sidebar: "aside, [role='complementary']",
        messageOverlay: "[class*='msg-overlay'], [class*='messaging']",
      };
      for (var area in areas) {
        var el = document.querySelector(areas[area]);
        if (el) {
          snapshot.htmlSamples[area] = el.outerHTML.substring(0, 1500);
        }
      }

      return snapshot;
    } catch (e) {
      return { error: e.message };
    }
  }

  // Send snapshot to AI edge function for selector generation
  async function learnFromAI(tabId, pageType, supabaseUrl, supabaseKey) {
    if (_learning) return await getCached();
    _learning = true;

    try {
      // Capture DOM snapshot
      var snapResults = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: captureDomSnapshot,
      });
      var snapshot = snapResults[0] && snapResults[0].result;
      if (!snapshot || snapshot.error) {
        _learning = false;
        return null;
      }

      // Call AI edge function
      var response = await fetch(supabaseUrl + "/functions/v1/linkedin-ai-extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": "Bearer " + supabaseKey,
        },
        body: JSON.stringify({
          mode: "learnDom",
          pageType: pageType || "profile",
          snapshot: snapshot,
        }),
      });

      if (!response.ok) {
        console.warn("[AI-Learn] Edge function returned", response.status);
        _learning = false;
        return null;
      }

      var data = await response.json();
      if (data.schema) {
        var schema = await saveSchema(data.schema);
        console.log("[AI-Learn] ✅ Selectors learned:", Object.keys(schema).length, "keys");
        _learning = false;
        return schema;
      }

      _learning = false;
      return null;
    } catch (e) {
      console.error("[AI-Learn] Error:", e);
      _learning = false;
      return null;
    }
  }

  // Use learned selectors to extract profile
  function extractWithSchema(schema) {
    try {
      var result = { name: null, headline: null, location: null, about: null, connectionStatus: "unknown" };

      if (schema.nameSelector) {
        var nameEl = document.querySelector(schema.nameSelector);
        if (nameEl) result.name = nameEl.textContent.trim();
      }
      if (schema.headlineSelector) {
        var hlEl = document.querySelector(schema.headlineSelector);
        if (hlEl) result.headline = hlEl.textContent.trim();
      }
      if (schema.locationSelector) {
        var locEl = document.querySelector(schema.locationSelector);
        if (locEl) result.location = locEl.textContent.trim();
      }
      if (schema.aboutSelector) {
        var aboutEl = document.querySelector(schema.aboutSelector);
        if (aboutEl) result.about = aboutEl.textContent.trim();
      }
      if (schema.photoSelector) {
        var photoEl = document.querySelector(schema.photoSelector);
        if (photoEl && photoEl.src) result.photoUrl = photoEl.src;
      }

      // Connection status
      if (schema.connectButtonSelector) {
        var cb = document.querySelector(schema.connectButtonSelector);
        if (cb) result.connectionStatus = "not_connected";
      }
      if (schema.messageButtonSelector) {
        var mb = document.querySelector(schema.messageButtonSelector);
        if (mb && !document.querySelector(schema.connectButtonSelector || "____")) result.connectionStatus = "connected";
      }

      result.profileUrl = window.location.href;
      return result;
    } catch (e) {
      return { error: e.message };
    }
  }

  // Use learned selectors to type and send a message
  function typeMessageWithSchema(schema, messageText) {
    try {
      var msgBox = null;
      if (schema.messageInputSelector) {
        msgBox = document.querySelector(schema.messageInputSelector);
      }
      if (!msgBox) {
        msgBox = document.querySelector("div[role='textbox'][contenteditable='true']");
      }
      if (!msgBox) return { success: false, error: "AI-Learn: Message input not found" };

      msgBox.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, messageText);
      msgBox.dispatchEvent(new Event("input", { bubbles: true }));

      var sendBtn = null;
      if (schema.sendButtonSelector) {
        sendBtn = document.querySelector(schema.sendButtonSelector);
      }
      if (!sendBtn) {
        sendBtn = Array.from(document.querySelectorAll("button")).find(function (b) {
          return /^(send|invia)$/i.test(b.textContent.trim()) && b.offsetParent !== null;
        });
      }

      if (sendBtn) {
        sendBtn.click();
        return { success: true, method: "ai_learn" };
      }
      return { success: false, error: "AI-Learn: Send button not found" };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Use learned selectors to click Connect
  function clickConnectWithSchema(schema) {
    try {
      var btn = null;
      if (schema.connectButtonSelector) {
        btn = document.querySelector(schema.connectButtonSelector);
      }
      if (!btn) {
        btn = Array.from(document.querySelectorAll("button")).find(function (el) {
          return /^(connect|collegati|connetti)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
        });
      }
      if (btn) {
        btn.click();
        return { success: true, method: "ai_learn" };
      }
      return { success: false, error: "AI-Learn: Connect button not found" };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  return {
    getCached: getCached,
    saveSchema: saveSchema,
    clearCache: clearCache,
    captureDomSnapshot: captureDomSnapshot,
    learnFromAI: learnFromAI,
    extractWithSchema: extractWithSchema,
    typeMessageWithSchema: typeMessageWithSchema,
    clickConnectWithSchema: clickConnectWithSchema,
  };
})();
