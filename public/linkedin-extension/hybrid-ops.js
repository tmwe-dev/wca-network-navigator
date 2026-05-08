// ══════════════════════════════════════════════════
// LinkedIn Extension — Hybrid Operations Module
// 3-Level Fallback: AX Tree → AI Self-Healing → Structural
// Uses InputNative instead of execCommand
// ══════════════════════════════════════════════════

var HybridOps = globalThis.HybridOps || (function () {

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error(label + " timeout " + ms + "ms")); }, ms);
      }),
    ]);
  }

  // ── InputNative: replaces execCommand for contenteditable ──
  function nativeInsertText(text) {
    // Use InputEvent API where available (modern Chrome)
    const el = document.activeElement;
    if (!el) return false;
    // Try insertText via InputEvent (standard API)
    const inserted = el.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: text, bubbles: true, cancelable: true }));
    if (inserted) {
      // For contenteditable, use Selection API
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      el.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: text, bubbles: true }));
      return true;
    }
    // Final fallback: execCommand (deprecated but still works)
    return document.execCommand("insertText", false, text);
  }

  // ── Profile extraction ──
  async function extractProfile(tabId) {
    console.log("[LI-Hybrid] extractProfile — trying AX Tree...");

    // Level 1: AX Tree
    try {
      const axResult = await AXTree.extractProfile(tabId);
      if (axResult && axResult.name) {
        console.log("[LI-Hybrid] ✅ AX Tree succeeded:", axResult.name);
        try {
          const photoRes = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: function () {
              const img = document.querySelector("img[alt*='photo'], img[alt*='foto'], img[class*='profile-photo'], img[class*='pv-top-card']");
              return img ? img.src : null;
            },
          });
          if (photoRes[0] && photoRes[0].result) axResult.photoUrl = photoRes[0].result;
        } catch (err) { console.debug("[LI Hybrid]", err?.message); }
        axResult.profileUrl = (await chrome.tabs.get(tabId)).url;
        return Config.successResponse({ profile: axResult, method: "ax_tree" });
      }
    } catch (e) { console.warn("[LI-Hybrid] AX Tree failed:", e.message); }

    // Level 2: AI Self-Healing
    console.log("[LI-Hybrid] extractProfile — trying AI Learn...");
    try {
      let schema = await AILearn.getCached("profile");
      if (!schema && Config.isReady()) {
        schema = await AILearn.learnFromAI(tabId, "profile", Config.getUrl(), Config.getKey());
      }
      if (schema) {
        const learnRes = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: AILearn.extractWithSchema,
          args: [schema],
        });
        const learnResult = learnRes[0] && learnRes[0].result;
        if (learnResult && learnResult.name) {
          console.log("[LI-Hybrid] ✅ AI Learn succeeded:", learnResult.name);
          return Config.successResponse({ profile: learnResult, method: "ai_learn" });
        }
        // Stale — re-learn
        if (Config.isReady()) {
          console.log("[LI-Hybrid] AI Learn stale, re-learning...");
          await AILearn.clearCache();
          schema = await AILearn.learnFromAI(tabId, "profile", Config.getUrl(), Config.getKey());
          if (schema) {
            const retryRes = await chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: AILearn.extractWithSchema,
              args: [schema],
            });
            const retryResult = retryRes[0] && retryRes[0].result;
            if (retryResult && retryResult.name) {
              return Config.successResponse({ profile: retryResult, method: "ai_learn_retry" });
            }
          }
        }
      }
    } catch (e) { console.warn("[LI-Hybrid] AI Learn failed:", e.message); }

    // Level 3: Structural fallback
    console.log("[LI-Hybrid] extractProfile — structural fallback...");
    try {
      const fallbackRes = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function () {
          const result = { name: null, headline: null, location: null, about: null, photoUrl: null, profileUrl: window.location.href, connectionStatus: "unknown" };
          function isNavNoise(s) {
            if (!s) return true;
            const t = String(s).trim();
            if (!t || t.length < 2) return true;
            if (/^\d+\s*(notif|messag|conness|invit|new|nuov)/i.test(t)) return true;
            if (/^(notifiche|notifications|messaging|messaggistica|search|cerca|home|rete|network|lavoro|jobs|me|tu|profilo|premium)$/i.test(t)) return true;
            return false;
          }
          const main = document.querySelector("main") || document.body;
          // Nome: scoped al top-card del profilo, mai alla nav.
          const h1Candidates = Array.from(main.querySelectorAll(
            "section.pv-top-card h1, h1.inline.t-24, h1.text-heading-xlarge, h1"
          ));
          for (let i = 0; i < h1Candidates.length; i++) {
            const t = (h1Candidates[i].textContent || "").trim().replace(/\s+/g, " ");
            if (!isNavNoise(t) && t.length >= 2 && t.length <= 120) { result.name = t; break; }
          }
          // Headline (sotto il nome).
          const headlineEl = main.querySelector(
            "section.pv-top-card .text-body-medium.break-words, .pv-text-details__left-panel .text-body-medium, .text-body-medium.break-words"
          );
          if (headlineEl) {
            const t = (headlineEl.textContent || "").trim().replace(/\s+/g, " ");
            if (!isNavNoise(t) && t.length >= 3 && t.length <= 200) result.headline = t;
          }
          // Location.
          const locEl = main.querySelector(
            "section.pv-top-card .text-body-small.inline.t-black--light.break-words, .pv-text-details__left-panel .text-body-small, .text-body-small.inline.t-black--light.break-words"
          );
          if (locEl) {
            const t = (locEl.textContent || "").trim().replace(/\s+/g, " ");
            if (!isNavNoise(t) && t.length >= 2 && t.length <= 200) result.location = t;
          }
          // Photo.
          const photo = main.querySelector(
            "img.pv-top-card-profile-picture__image, img[class*='profile-picture'], img[alt*='photo'], img[alt*='foto']"
          );
          if (photo && photo.src) result.photoUrl = photo.src;
          const allBtns = Array.from(document.querySelectorAll("button")).filter(function (b) { return b.offsetParent !== null; });
          for (let i = 0; i < allBtns.length; i++) {
            const t = allBtns[i].textContent.trim().toLowerCase();
            if (/^(connect|collegati|connetti)$/.test(t)) { result.connectionStatus = "not_connected"; break; }
            if (/^(messag|scrivi)/.test(t)) { result.connectionStatus = "connected"; break; }
            if (/^(pending|in attesa)/.test(t)) { result.connectionStatus = "pending"; break; }
          }
          return result;
        },
      });
      const fallbackResult = fallbackRes[0] && fallbackRes[0].result;
      if (fallbackResult && fallbackResult.name) {
        return Config.successResponse({ profile: fallbackResult, method: "structural_fallback" });
      }
    } catch (e) { console.warn("[LI-Hybrid] Structural fallback failed:", e.message); }

    return Config.errorResponse(Config.ERROR.EXTRACTION_FAILED, "All 3 extraction strategies failed");
  }

  // ── Send message ──
  async function sendMessage(tabId, message) {
    // Guardia URL: la tab deve essere ancora su una pagina profilo /in/<slug>.
    // Se è derivata (es. /messaging/, /feed/) abortiamo: il caller può ri-navigare e ritentare.
    try {
      const tabInfo = await chrome.tabs.get(tabId);
      const currentUrl = (tabInfo && (tabInfo.url || tabInfo.pendingUrl)) || "";
      if (!/linkedin\.com\/(in|pub|messaging)\//i.test(currentUrl)) {
        return Config.errorResponse(Config.ERROR.MESSAGE_FAILED, "navigation_drifted: tab fuori da profilo/messaging (" + currentUrl + ")");
      }
    } catch (e) { /* se tabs.get fallisce, lasciamo procedere */ }
    // Level 1: AX Tree
    try {
      const axResult = await withTimeout(AXTree.typeMessage(tabId, message), 6500, "AX typeMessage");
      if (axResult && axResult.success) return axResult;
    } catch (e) { console.warn("[LI-Hybrid] AX Tree message failed:", e.message); }

    // Level 2: AI Learn
    try {
      let schema = await AILearn.getCached("messaging");
      if (!schema && Config.isReady()) schema = await withTimeout(AILearn.learnFromAI(tabId, "messaging", Config.getUrl(), Config.getKey()), 8000, "AI Learn messaging");
      if (schema) {
        const learnRes = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: AILearn.typeMessageWithSchema,
          args: [schema, message],
        });
        const learnResult = learnRes[0] && learnRes[0].result;
        if (learnResult && learnResult.success) return learnResult;
      }
    } catch (e) { console.warn("[LI-Hybrid] AI Learn message failed:", e.message); }

    // Level 3: Structural fallback with native input
    try {
      const fbRes = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function (msg) {
          // Poll up to 8s for the message textbox to appear after the dialog opens.
          // If still missing, try clicking the profile-scoped "Messaggia"/"Message"
          // button (including the "Altro/More" menu), then poll again.
          // Walk the DOM including open shadow roots.
          function deepQueryAll(selector, root) {
            const out = [];
            const r = root || document;
            try { out.push.apply(out, r.querySelectorAll(selector)); } catch (e) {}
            const all = r.querySelectorAll ? r.querySelectorAll("*") : [];
            for (const el of all) {
              if (el.shadowRoot) {
                try { out.push.apply(out, deepQueryAll(selector, el.shadowRoot)); } catch (e) {}
              }
            }
            return out;
          }
          function findBox() {
            const boxes = deepQueryAll("[contenteditable='true'], div[role='textbox'], [role='textbox']");
            return boxes.find(function (el) {
              const visible = el.offsetParent !== null || el.getClientRects().length > 0;
              if (!visible) return false;
              const text = [
                el.getAttribute("aria-label") || "",
                el.getAttribute("aria-placeholder") || "",
                el.getAttribute("data-placeholder") || "",
                el.getAttribute("placeholder") || "",
                el.className || "",
                el.closest("[class*='msg-form'], .msg-form, [role='dialog']") ? " msg-form" : "",
              ].join(" ");
              return el.getAttribute("role") === "textbox"
                || /message|messag|messaggio|scrivi|invia|write|msg-form/i.test(text);
            }) || null;
          }
          function findMessageBtn() {
            const root = document.querySelector("main") || document.body;
            return Array.from(root.querySelectorAll("button, a, [role='button'], [role='menuitem']")).find(function (b) {
              if (!(b.offsetParent !== null || b.getClientRects().length > 0)) return false;
              const t = (b.textContent || "").trim();
              const al = (b.getAttribute("aria-label") || "").trim();
              return /^(message|messaggia)$/i.test(t)
                || /^(messaggio|scrivi|invia messaggio|send message)$/i.test(t)
                || /messaggia|messaggio|message|send message/i.test(al);
            });
          }
          function findMoreBtn() {
            const root = document.querySelector("main") || document.body;
            return Array.from(root.querySelectorAll("button, [role='button']")).find(function (b) {
              if (!(b.offsetParent !== null || b.getClientRects().length > 0)) return false;
              const t = (b.textContent || "").trim();
              const al = (b.getAttribute("aria-label") || "").trim();
              return /^(more|altro|più)$/i.test(t) || /^(more actions|altro|più azioni)/i.test(al);
            });
          }
          function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
          return (async function () {
            // Wait for full page load + thread container before polling textbox.
            for (let i = 0; i < 20 && document.readyState !== "complete"; i++) await sleep(250);
            for (let i = 0; i < 40; i++) {
              if (document.querySelector(".msg-form, [class*='msg-form'], .msg-thread, [class*='msg-thread'], [class*='msg-convo']")) break;
              await sleep(500);
            }
            let msgBox = findBox();
            if (!msgBox) {
              // Up to 20s polling (was 8s).
              for (let i = 0; i < 40 && !msgBox; i++) { await sleep(500); msgBox = findBox(); }
            }
            if (!msgBox) {
              const mb = findMessageBtn();
              if (mb && mb.offsetParent !== null) {
                mb.click();
                for (let i = 0; i < 16 && !msgBox; i++) { await sleep(500); msgBox = findBox(); }
              }
            }
            if (!msgBox) {
              const more = findMoreBtn();
              if (more) {
                more.click();
                await sleep(800);
                const mb = findMessageBtn();
                if (mb) {
                  mb.click();
                  for (let i = 0; i < 16 && !msgBox; i++) { await sleep(500); msgBox = findBox(); }
                }
              }
            }
            if (!msgBox) {
              // ── Diagnostic probe (read-only DOM snapshot) ──
              const probe = {
                href: location.href,
                contenteditable: document.querySelectorAll("[contenteditable='true']").length,
                contenteditableDeep: deepQueryAll("[contenteditable='true']").length,
                roleTextbox: document.querySelectorAll("[role='textbox']").length,
                roleTextboxDeep: deepQueryAll("[role='textbox']").length,
                shadowHosts: Array.from(document.querySelectorAll("*")).filter(function (e) { return !!e.shadowRoot; }).length,
                iframes: document.querySelectorAll("iframe").length,
                msgFormContainers: document.querySelectorAll(".msg-form, [class*='msg-form'], [class*='msg-thread'], [class*='msg-convo']").length,
                readyState: document.readyState,
                msgOverlay: document.querySelectorAll(".msg-overlay-conversation-bubble, [class*='msg-overlay']").length,
                dialogs: document.querySelectorAll("[role='dialog']").length,
                dialogText: (document.querySelector("[role='dialog']")?.innerText || "").slice(0, 200),
                dialogButtons: Array.from(document.querySelectorAll("[role='dialog'] button"))
                  .slice(0, 5)
                  .map(function (b) { return (b.textContent || "").trim().slice(0, 40); }),
                hasMain: !!document.querySelector("main"),
              };
              return { success: false, error: "Fallback: no textbox found __probe__=" + JSON.stringify(probe) };
            }
          msgBox.focus();
          // Use Selection API + InputEvent for text insertion
          let sel = window.getSelection();
          if (sel) { sel.selectAllChildren(msgBox); sel.deleteFromDocument(); }
          const textNode = document.createTextNode(msg);
          msgBox.appendChild(textNode);
          sel = window.getSelection();
          if (sel) { const r = document.createRange(); r.selectNodeContents(msgBox); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
          msgBox.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: msg, bubbles: true }));
            // Wait for the send button to become enabled (LinkedIn validates async).
            let sendBtn = null;
            for (let i = 0; i < 30; i++) {
              sendBtn = Array.from(document.querySelectorAll("button")).find(function (b) {
                return /^(send|invia)$/i.test((b.textContent || "").trim())
                  && b.offsetParent !== null && !b.disabled;
              });
              if (sendBtn) break;
              await sleep(100);
            }
            if (sendBtn) { sendBtn.click(); return { success: true, method: "structural_fallback" }; }
            return { success: false, error: "Fallback: send button not found" };
          })();
        },
        args: [message],
      });
      const fbResult = fbRes[0] && fbRes[0].result;
      if (fbResult && fbResult.success) return fbResult;
      return fbResult || Config.errorResponse(Config.ERROR.MESSAGE_FAILED, "All message strategies failed");
    } catch (e) { return Config.errorResponse(Config.ERROR.MESSAGE_FAILED, e.message); }
  }

  // ── Click Connect ──
  async function clickConnect(tabId) {
    // Level 1: AX Tree
    try {
      const axResult = await AXTree.clickConnect(tabId);
      if (axResult && axResult.success) return axResult;
    } catch (e) { console.warn("[LI-Hybrid] AX Tree connect failed:", e.message); }

    // Level 2: AI Learn
    try {
      let schema = await AILearn.getCached("profile");
      if (!schema && Config.isReady()) schema = await AILearn.learnFromAI(tabId, "profile", Config.getUrl(), Config.getKey());
      if (schema) {
        const learnRes = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: AILearn.clickConnectWithSchema,
          args: [schema],
        });
        const learnResult = learnRes[0] && learnRes[0].result;
        if (learnResult && learnResult.success) return learnResult;
      }
    } catch (e) {}

    // Level 3: Structural fallback
    try {
      const fbRes = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function () {
          const btn = Array.from(document.querySelectorAll("button")).find(function (el) {
            return /^(connect|collegati|connetti)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
          });
          if (btn) { btn.click(); return { success: true, method: "structural_fallback" }; }
          const moreBtn = Array.from(document.querySelectorAll("button")).find(function (el) {
            return /^(more|altro)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
          });
          if (moreBtn) {
            moreBtn.click();
            return new Promise(function (resolve) {
              setTimeout(function () {
                const dropItem = Array.from(document.querySelectorAll("[role='option'], [role='menuitem'], li, span")).find(function (el) {
                  return /connect|collegati|connetti/i.test(el.textContent.trim()) && el.offsetParent !== null;
                });
                if (dropItem) { dropItem.click(); resolve({ success: true, method: "structural_more_dropdown" }); }
                else resolve({ success: false, error: "Connect not found in dropdown" });
              }, 1200);
            });
          }
          return { success: false, error: "Fallback: Connect button not found" };
        },
      });
      return (fbRes[0] && fbRes[0].result) || Config.errorResponse(Config.ERROR.CONNECT_FAILED, "All connect strategies failed");
    } catch (e) { return Config.errorResponse(Config.ERROR.CONNECT_FAILED, e.message); }
  }

  // ── Click Message button ──
  async function clickMessage(tabId) {
    // P2 — AX Tree DISABILITATO per clickMessage: cerca globalmente e finisce
    // per cliccare "Messaging/Messaggi" della top-nav, navigando l'utente in
    // /messaging/ invece di aprire il composer del profilo. Usiamo solo il
    // fallback strutturale che filtra dentro <main> ed esclude la global-nav.
    try {
      const fbRes = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function () {
          // Scope al <main>: esclude la top-nav globale ("Messaggi"/"Messaging"
          // inbox link) che altrimenti vince per ordine DOM e fa navigare la tab
          // su /messaging/, finendo per scrivere nella conversazione sbagliata.
          var root = document.querySelector("main") || document.body;
          function isInGlobalNav(el) {
            return !!(el.closest("nav") ||
                      el.closest("header[role='banner']") ||
                      el.closest("[data-test-global-nav]") ||
                      el.closest(".global-nav"));
          }
          function isVisible(el) {
            return el.offsetParent !== null || el.getClientRects().length > 0;
          }
          function findProfileMessageBtn(scope) {
            var nodes = Array.from(scope.querySelectorAll("button, a, [role='button'], [role='menuitem']"));
            return nodes.find(function (el) {
              if (!isVisible(el) || isInGlobalNav(el)) return false;
              var t = (el.textContent || "").replace(/\s+/g, " ").trim();
              var al = (el.getAttribute("aria-label") || "").trim();
              return /^(messaggia|message)$/i.test(t)
                  || /^(messaggia|message)$/i.test(al)
                  || /^(invia messaggio|send message)$/i.test(t)
                  || /^(invia messaggio|send message)$/i.test(al);
            });
          }
          function findMoreBtn(scope) {
            return Array.from(scope.querySelectorAll("button, [role='button']")).find(function (b) {
              if (!isVisible(b) || isInGlobalNav(b)) return false;
              var t = (b.textContent || "").trim();
              var al = (b.getAttribute("aria-label") || "").trim();
              return /^(more|altro|più|piu)$/i.test(t) || /^(more actions|altro|più azioni|piu azioni)/i.test(al);
            });
          }
          function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
          return (async function () {
            var btn = findProfileMessageBtn(root);
            if (btn) { btn.click(); return { success: true, method: "structural_fallback_main" }; }
            // Tenta "Altro/More" → voce "Messaggia"
            var more = findMoreBtn(root);
            if (more) {
              more.click();
              await sleep(800);
              // Le voci di menu possono finire fuori da main
              btn = findProfileMessageBtn(document) ||
                    Array.from(document.querySelectorAll("[role='menuitem'], li, [role='option']")).find(function (el) {
                      if (!isVisible(el) || isInGlobalNav(el)) return false;
                      var t = (el.textContent || "").replace(/\s+/g, " ").trim();
                      return /^(messaggia|message|invia messaggio|send message)$/i.test(t);
                    });
              if (btn) { btn.click(); return { success: true, method: "structural_more_dropdown" }; }
            }
            return { success: false, error: "Profile-scoped message button not found" };
          })();
        },
      });
      return (fbRes[0] && fbRes[0].result) || { success: false, error: "Message button not found" };
    } catch (e) { return { success: false, error: e.message }; }
  }

  // ── Add connection note ──
  async function addNote(tabId, noteText) {
    try {
      const axResult = await AXTree.addNote(tabId, noteText);
      if (axResult && axResult.success) return axResult;
    } catch (err) { console.debug("[LI Hybrid]", err?.message); }
    try {
      const fbRes = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function (note) {
          const addBtn = Array.from(document.querySelectorAll("button")).find(function (el) {
            return /add a note|aggiungi nota/i.test(el.textContent.trim());
          });
          if (!addBtn) return { success: false, error: "Add Note button not found" };
          addBtn.click();
          return new Promise(function (resolve) {
            setTimeout(function () {
              const textarea = document.querySelector("textarea");
              if (!textarea) { resolve({ success: false, error: "Note textarea not found" }); return; }
              const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
              textarea.focus();
              nativeSet.call(textarea, note);
              textarea.dispatchEvent(new Event("input", { bubbles: true }));
              setTimeout(function () {
                const sendBtn = Array.from(document.querySelectorAll("button")).find(function (el) {
                  return /^(send|invia)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
                });
                if (sendBtn) { sendBtn.click(); resolve({ success: true, method: "structural_fallback" }); }
                else resolve({ success: false, error: "Send button not found" });
              }, 500);
            }, 1000);
          });
        },
        args: [noteText],
      });
      return (fbRes[0] && fbRes[0].result) || { success: false, error: "Note adding failed" };
    } catch (e) { return { success: false, error: e.message }; }
  }

  return {
    extractProfile: extractProfile,
    sendMessage: sendMessage,
    clickConnect: clickConnect,
    clickMessage: clickMessage,
    addNote: addNote,
  };
})();
globalThis.HybridOps = HybridOps;
