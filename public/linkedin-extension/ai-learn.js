// ══════════════════════════════════════════════════
// AI DOM Learning Module for LinkedIn v3.0
// - Composite cache key (pageType + hostname + lang)
// - TTL + failure-based invalidation
// - No execCommand — uses Selection API + InputEvent
// ══════════════════════════════════════════════════

var AILearn = (function () {
  var CACHE_PREFIX = "li_dom_schema_";
  var CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours
  var MAX_FAILURES = 3;
  var _learning = false;
  var _failureCount = 0;

  // ── Composite cache key ──
  function cacheKey(pageType) {
    return CACHE_PREFIX + (pageType || "profile");
  }

  async function getCached(pageType) {
    try {
      var key = cacheKey(pageType);
      var data = await chrome.storage.local.get(key);
      if (data && data[key]) {
        var schema = data[key];
        if (schema.learnedAt && Date.now() - schema.learnedAt < CACHE_TTL) {
          return schema;
        }
      }
    } catch (_) {}
    return null;
  }

  async function saveSchema(schema, pageType) {
    schema.learnedAt = Date.now();
    schema.pageType = pageType || "profile";
    var obj = {};
    obj[cacheKey(pageType)] = schema;
    await chrome.storage.local.set(obj);
    _failureCount = 0; // reset on successful learn
    return schema;
  }

  async function clearCache(pageType) {
    if (pageType) {
      await chrome.storage.local.remove(cacheKey(pageType));
    } else {
      // Clear all schema keys
      var keys = ["profile", "messaging", "search", "inbox"].map(function (t) { return cacheKey(t); });
      await chrome.storage.local.remove(keys);
    }
  }

  // ── Record selector failure (triggers re-learn after threshold) ──
  function recordFailure() {
    _failureCount++;
    if (_failureCount >= MAX_FAILURES) {
      console.warn("[AI-Learn] " + _failureCount + " consecutive failures — invalidating cache");
      clearCache();
      _failureCount = 0;
      return true; // should re-learn
    }
    return false;
  }

  // ── DOM snapshot capture (injected into page) ──
  function captureDomSnapshot() {
    try {
      var snapshot = {
        url: window.location.href,
        title: document.title,
        lang: document.documentElement.lang || navigator.language || "unknown",
        hostname: window.location.hostname,
        dataTestIds: [],
        ariaLabels: [],
        roles: [],
        headings: [],
        buttons: [],
        textboxes: [],
        links: [],
        htmlSamples: {},
      };

      var testIds = document.querySelectorAll("[data-testid]");
      for (var i = 0; i < Math.min(testIds.length, 50); i++) {
        snapshot.dataTestIds.push({
          id: testIds[i].getAttribute("data-testid"),
          tag: testIds[i].tagName.toLowerCase(),
          text: (testIds[i].textContent || "").trim().substring(0, 80),
        });
      }

      var ariaEls = document.querySelectorAll("[aria-label]");
      for (var j = 0; j < Math.min(ariaEls.length, 50); j++) {
        snapshot.ariaLabels.push({
          label: ariaEls[j].getAttribute("aria-label"),
          tag: ariaEls[j].tagName.toLowerCase(),
          role: ariaEls[j].getAttribute("role") || "",
        });
      }

      var roleEls = document.querySelectorAll("[role]");
      for (var k = 0; k < Math.min(roleEls.length, 50); k++) {
        snapshot.roles.push({
          role: roleEls[k].getAttribute("role"),
          tag: roleEls[k].tagName.toLowerCase(),
          text: (roleEls[k].textContent || "").trim().substring(0, 60),
          ariaLabel: roleEls[k].getAttribute("aria-label") || "",
        });
      }

      var headings = document.querySelectorAll("h1, h2, h3");
      for (var h = 0; h < Math.min(headings.length, 20); h++) {
        snapshot.headings.push({
          level: headings[h].tagName,
          text: (headings[h].textContent || "").trim().substring(0, 100),
          classes: (headings[h].className || "").substring(0, 100),
        });
      }

      var buttons = document.querySelectorAll("button");
      for (var b = 0; b < Math.min(buttons.length, 30); b++) {
        if (buttons[b].offsetParent === null) continue;
        snapshot.buttons.push({
          text: (buttons[b].textContent || "").trim().substring(0, 60),
          ariaLabel: buttons[b].getAttribute("aria-label") || "",
          classes: (buttons[b].className || "").substring(0, 100),
        });
      }

      var textboxes = document.querySelectorAll("[contenteditable='true'], textarea, input[type='text']");
      for (var t = 0; t < Math.min(textboxes.length, 10); t++) {
        snapshot.textboxes.push({
          tag: textboxes[t].tagName.toLowerCase(),
          role: textboxes[t].getAttribute("role") || "",
          classes: (textboxes[t].className || "").substring(0, 100),
          placeholder: textboxes[t].getAttribute("placeholder") || textboxes[t].getAttribute("aria-placeholder") || "",
        });
      }

      var areas = {
        navBar: "nav, header, [role='banner']",
        mainContent: "main, [role='main']",
        sidebar: "aside, [role='complementary']",
        messageOverlay: "[class*='msg-overlay'], [class*='messaging']",
      };
      for (var area in areas) {
        var el = document.querySelector(areas[area]);
        if (el) snapshot.htmlSamples[area] = el.outerHTML.substring(0, 1500);
      }

      return snapshot;
    } catch (e) {
      return { error: e.message };
    }
  }

  // ── AI learning call ──
  async function learnFromAI(tabId, pageType, supabaseUrl, supabaseKey) {
    if (_learning) return await getCached(pageType);
    _learning = true;

    try {
      var snapResults = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: captureDomSnapshot,
      });
      var snapshot = snapResults[0] && snapResults[0].result;
      if (!snapshot || snapshot.error) {
        _learning = false;
        return null;
      }

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
        var schema = await saveSchema(data.schema, pageType);
        console.log("[AI-Learn] ✅ Selectors learned for '" + pageType + "':", Object.keys(schema).length, "keys");
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

  // ── Schema-based extraction (injected into page) ──
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

  // ── Type message using Selection API (no execCommand) ──
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

      // Clear and insert using Selection API
      var sel = window.getSelection();
      if (sel) {
        sel.selectAllChildren(msgBox);
        sel.deleteFromDocument();
      }
      var textNode = document.createTextNode(messageText);
      msgBox.appendChild(textNode);
      // Place cursor at end
      sel = window.getSelection();
      if (sel) {
        var range = document.createRange();
        range.selectNodeContents(msgBox);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      msgBox.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: messageText, bubbles: true }));

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
    recordFailure: recordFailure,
    captureDomSnapshot: captureDomSnapshot,
    learnFromAI: learnFromAI,
    extractWithSchema: extractWithSchema,
    typeMessageWithSchema: typeMessageWithSchema,
    clickConnectWithSchema: clickConnectWithSchema,
  };
})();
