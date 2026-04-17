// ══════════════════════════════════════════════════
// LinkedIn Extension — Hybrid Operations Module
// 3-Level Fallback: AX Tree → AI Self-Healing → Structural
// Uses InputNative instead of execCommand
// ══════════════════════════════════════════════════

var HybridOps = globalThis.HybridOps || (function () {

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
        } catch (_) {}
        axResult.profileUrl = (await chrome.tabs.get(tabId)).url;
        return Config.successResponse({ profile: axResult, method: "ax_tree" });
      }
    } catch (e) { console.warn("[LI-Hybrid] AX Tree failed:", e.message); }

    // Level 2: AI Self-Healing
    console.log("[LI-Hybrid] extractProfile — trying AI Learn...");
    try {
      let schema = await AILearn.getCached();
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
          const h1 = document.querySelector("h1");
          if (h1) result.name = h1.textContent.trim();
          if (h1 && h1.nextElementSibling) {
            const next = h1.nextElementSibling;
            if (next.textContent.trim().length > 3 && next.textContent.trim().length < 200) {
              result.headline = next.textContent.trim();
            }
          }
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
    // Level 1: AX Tree
    try {
      const axResult = await AXTree.typeMessage(tabId, message);
      if (axResult && axResult.success) return axResult;
    } catch (e) { console.warn("[LI-Hybrid] AX Tree message failed:", e.message); }

    // Level 2: AI Learn
    try {
      let schema = await AILearn.getCached();
      if (!schema && Config.isReady()) schema = await AILearn.learnFromAI(tabId, "messaging", Config.getUrl(), Config.getKey());
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
          const msgBox = document.querySelector("div[role='textbox'][contenteditable='true']")
            || document.querySelector("[contenteditable='true'][aria-label]");
          if (!msgBox) return { success: false, error: "Fallback: no textbox found" };
          msgBox.focus();
          // Use Selection API + InputEvent for text insertion
          let sel = window.getSelection();
          if (sel) { sel.selectAllChildren(msgBox); sel.deleteFromDocument(); }
          const textNode = document.createTextNode(msg);
          msgBox.appendChild(textNode);
          sel = window.getSelection();
          if (sel) { const r = document.createRange(); r.selectNodeContents(msgBox); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
          msgBox.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: msg, bubbles: true }));
          const sendBtn = Array.from(document.querySelectorAll("button")).find(function (b) {
            return /^(send|invia)$/i.test(b.textContent.trim()) && b.offsetParent !== null;
          });
          if (sendBtn) { sendBtn.click(); return { success: true, method: "structural_fallback" }; }
          return { success: false, error: "Fallback: send button not found" };
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
      let schema = await AILearn.getCached();
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
    try {
      const axResult = await AXTree.clickMessageButton(tabId);
      if (axResult && axResult.success) return axResult;
    } catch (_) {}
    try {
      const fbRes = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: function () {
          const btn = Array.from(document.querySelectorAll("button, a")).find(function (el) {
            return /^messag|^scrivi/i.test(el.textContent.trim()) && el.offsetParent !== null;
          });
          if (btn) { btn.click(); return { success: true, method: "structural_fallback" }; }
          return { success: false, error: "Message button not found" };
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
    } catch (_) {}
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
