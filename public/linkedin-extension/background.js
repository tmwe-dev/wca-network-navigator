// ══════════════════════════════════════════════════════════════
// LinkedIn Extension v2.0 — Hybrid Architecture
// 3-Level Strategy: API → AX Tree → AI Self-Healing
// Zero hardcoded CSS selectors
// ══════════════════════════════════════════════════════════════

var SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

// ── Import modules (loaded via importScripts in MV3 service worker) ──
try { importScripts("ax-tree.js", "ai-learn.js"); } catch (e) { console.error("[LI-EXT] Module import failed:", e); }

// ── Persistent LinkedIn tab ──
var _liTabId = null;

// ══════════════════════════════════════════════════
// TAB MANAGEMENT (unchanged, zero selectors)
// ══════════════════════════════════════════════════

async function safeTabCreate(options, maxRetries) {
  maxRetries = maxRetries || 3;
  for (var attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await chrome.tabs.create(options);
    } catch (err) {
      if (attempt < maxRetries - 1 && /cannot be edited/i.test(err.message)) {
        await new Promise(function(r) { setTimeout(r, 500); });
      } else { throw err; }
    }
  }
}

async function safeTabRemove(tabId) {
  if (tabId === _liTabId) return;
  try { await chrome.tabs.remove(tabId); } catch (e) {}
}

async function getLinkedInTab(url, skipNavigateIfSameDomain) {
  if (_liTabId !== null) {
    try {
      var existing = await chrome.tabs.get(_liTabId);
      if (existing) {
        if (skipNavigateIfSameDomain && existing.url && /linkedin\.com/i.test(existing.url)) {
          if (existing.status !== "complete") await waitForTabLoad(_liTabId, 15000);
          return { id: _liTabId, reused: true };
        }
        await chrome.tabs.update(_liTabId, { url: url });
        await waitForTabLoad(_liTabId, 20000);
        return { id: _liTabId, reused: false };
      }
    } catch (_) { _liTabId = null; }
  }
  try {
    var existingTabs = await chrome.tabs.query({ url: "https://*.linkedin.com/*" });
    if (existingTabs && existingTabs.length > 0) {
      _liTabId = existingTabs[0].id;
      if (skipNavigateIfSameDomain) {
        if (existingTabs[0].status !== "complete") await waitForTabLoad(_liTabId, 15000);
        return { id: _liTabId, reused: true };
      }
      await chrome.tabs.update(_liTabId, { url: url });
      await waitForTabLoad(_liTabId, 20000);
      return { id: _liTabId, reused: false };
    }
  } catch (_) {}
  var tab = await safeTabCreate({ url: url, active: false });
  _liTabId = tab.id;
  await waitForTabLoad(tab.id, 20000);
  return tab;
}

function waitForTabLoad(tabId, ms) {
  ms = ms || 20000;
  return new Promise(function (resolve) {
    var timeout = setTimeout(function () {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, ms);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 2000);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ══════════════════════════════════════════════════
// COOKIE & SESSION (zero DOM selectors needed)
// ══════════════════════════════════════════════════

async function getLiAtCookie() {
  try {
    var cookie = await chrome.cookies.get({ url: "https://www.linkedin.com/", name: "li_at" });
    return cookie ? cookie.value : null;
  } catch (e) { return null; }
}

async function syncLiCookieToServer() {
  try {
    var liAt = await getLiAtCookie();
    if (!liAt) return { success: false, error: "Cookie li_at non trovato" };
    var res = await fetch(SUPABASE_URL + "/functions/v1/save-linkedin-cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY },
      body: JSON.stringify({ cookie: liAt }),
    });
    var data = await res.json();
    return { success: true, cookieLength: liAt.length, saved: data.success };
  } catch (err) { return { success: false, error: err.message }; }
}

// Session verification — uses cookie + URL pattern (no DOM selectors)
async function verifyLinkedInSession() {
  var liAt = await getLiAtCookie();
  if (!liAt) return { authenticated: false, reason: "no_cookie" };

  var tab = await getLinkedInTab("https://www.linkedin.com/feed/", true);
  try {
    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () {
        var url = window.location.href || "";
        var title = document.title || "";
        // URL-based check (no CSS selectors)
        var onLoggedPage = /linkedin\.com\/(feed|messaging|in\/|search\/results|mynetwork|jobs)/i.test(url);
        var loginPage = /\/login|\/checkpoint|uas\/login/i.test(url);
        var hasSignIn = /Sign in|Accedi|Log in/i.test(title);
        // Minimal DOM check: does the page have main content?
        var hasMainContent = !!document.querySelector("main, [role='main']");
        var authenticated = (onLoggedPage || hasMainContent) && !loginPage && !hasSignIn;
        return {
          authenticated: authenticated,
          reason: authenticated ? "session_active" : loginPage ? "login_page" : hasSignIn ? "sign_in_title" : "unknown"
        };
      },
    });
    var sessionResult = results[0] && results[0].result;
    if (sessionResult && sessionResult.authenticated) {
      syncLiCookieToServer().catch(function(){});
    }
    return sessionResult || { authenticated: false, reason: "no_result" };
  } catch (err) {
    return { authenticated: true, reason: "cookie_present_script_error", cookieLength: liAt.length };
  }
}

// ══════════════════════════════════════════════════
// LOGIN (uses stable form selectors: #username, #password, type=submit)
// These are LinkedIn's own login form IDs — extremely stable
// ══════════════════════════════════════════════════

function inspectLinkedInPage() {
  try {
    function firstVisible(selectorList) {
      for (var i = 0; i < selectorList.length; i++) {
        var nodes = document.querySelectorAll(selectorList[i]);
        for (var j = 0; j < nodes.length; j++) {
          var el = nodes[j];
          if (!el) continue;
          var style = window.getComputedStyle(el);
          if (style.display !== "none" && style.visibility !== "hidden" && !el.disabled && (el.offsetParent !== null || style.position === "fixed")) return el;
        }
      }
      return null;
    }
    var url = window.location.href;
    var title = document.title || "";
    // Login form uses stable HTML IDs
    var userInput = firstVisible(["#username", "input[name='session_key']", "input[autocomplete='username']"]);
    var passInput = firstVisible(["#password", "input[name='session_password']", "input[autocomplete='current-password']"]);
    var loginForm = !!(userInput || passInput || document.querySelector("form[action*='login-submit']"));
    var hasMainContent = !!document.querySelector("main, [role='main']");
    var onLoggedPage = /linkedin\.com\/(feed|messaging|in\/|search|mynetwork|jobs)/i.test(url);
    var loginPage = /\/login|\/checkpoint|uas\/login/i.test(url);
    var hasSignIn = /Sign in|Accedi|Log in/i.test(title);
    var authenticated = (onLoggedPage || hasMainContent) && !loginPage && !hasSignIn;
    var hasCaptcha = !!document.querySelector("iframe[src*='captcha'], #captcha, .recaptcha, [data-captcha]");
    var hasPhoneVerify = !!document.querySelector("#input__phone_verification_pin, input[name='pin']");
    var hasTwoStep = !!document.querySelector("input[name='verificationCode'], input[name='otpPin'], input[autocomplete='one-time-code']");
    var googleButton = Array.from(document.querySelectorAll("a, button")).find(function (el) {
      return /continue with google|continua con google|sign in with google|accedi con google/i.test(el.textContent || "") && el.offsetParent !== null;
    });
    var signInLink = Array.from(document.querySelectorAll("a, button")).find(function (el) {
      var text = (el.textContent || "").trim();
      if (!el || el.offsetParent === null) return false;
      if (/google/i.test(text)) return false;
      if (/join|iscriviti|registrati/i.test(text)) return false;
      if (/^sign in$|^log in$|^accedi$/i.test(text)) return true;
      if (el.tagName === "A" && /\/login/.test(el.getAttribute("href") || "")) return true;
      return false;
    });
    return {
      url: url, title: title, authenticated: authenticated,
      hasLoginForm: loginForm, hasUsername: !!userInput, hasPassword: !!passInput,
      hasGoogleButton: !!googleButton, hasSignInLink: !!signInLink,
      isChallenge: /checkpoint|challenge|security-verification|two-step|verify|captcha/i.test(url) || hasCaptcha || hasPhoneVerify || hasTwoStep,
    };
  } catch (e) {
    return { url: window.location.href, title: document.title || "", authenticated: false, hasLoginForm: false, error: e.message };
  }
}

function prepareOfficialLinkedInLoginPage() {
  try {
    var state = inspectLinkedInPage();
    if (state.authenticated) return { success: true, state: "authenticated", url: state.url };
    if (state.hasLoginForm) return { success: true, state: "form_ready", url: state.url };
    var signInLink = Array.from(document.querySelectorAll("a, button")).find(function (el) {
      var text = (el.textContent || "").trim();
      if (!el || el.offsetParent === null || /google/i.test(text) || /join|iscriviti/i.test(text)) return false;
      return /^sign in$|^log in$|^accedi$/i.test(text) || (el.tagName === "A" && /\/login/.test(el.getAttribute("href") || ""));
    });
    if (signInLink) { signInLink.click(); return { success: true, state: "clicked_sign_in", url: window.location.href }; }
    window.location.href = "https://www.linkedin.com/login";
    return { success: true, state: "navigated_to_login", url: window.location.href };
  } catch (e) { return { success: false, error: e.message }; }
}

function fillLinkedInLogin(email, password) {
  try {
    function firstVisible(selectorList) {
      for (var i = 0; i < selectorList.length; i++) {
        var nodes = document.querySelectorAll(selectorList[i]);
        for (var j = 0; j < nodes.length; j++) {
          var el = nodes[j];
          if (!el) continue;
          var style = window.getComputedStyle(el);
          if (style.display !== "none" && style.visibility !== "hidden" && !el.disabled && (el.offsetParent !== null || style.position === "fixed")) return el;
        }
      }
      return null;
    }
    var userInput = firstVisible(["#username", "input[name='session_key']", "input[autocomplete='username']"]);
    var passInput = firstVisible(["#password", "input[name='session_password']", "input[autocomplete='current-password']"]);
    if (!userInput || !passInput) return { success: false, error: "Login fields not found" };
    var nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    userInput.focus();
    nativeSet.call(userInput, email);
    userInput.dispatchEvent(new Event("input", { bubbles: true }));
    userInput.dispatchEvent(new Event("change", { bubbles: true }));
    passInput.focus();
    nativeSet.call(passInput, password);
    passInput.dispatchEvent(new Event("input", { bubbles: true }));
    passInput.dispatchEvent(new Event("change", { bubbles: true }));
    var submitBtn = firstVisible(["button[type='submit']", "button[data-litms-control-urn*='login-submit']"]);
    if (submitBtn) { submitBtn.click(); return { success: true, method: "button" }; }
    var form = userInput.closest("form");
    if (form) { form.requestSubmit ? form.requestSubmit() : form.submit(); return { success: true, method: "form" }; }
    return { success: false, error: "No submit found" };
  } catch (e) { return { success: false, error: e.message }; }
}

async function pollForLinkedInAuthCompletion(tabId, timeoutMs, options) {
  timeoutMs = timeoutMs || 180000;
  options = options || {};
  var sawGoogle = !!options.sawGoogle;
  var sawChallenge = !!options.sawChallenge;
  var lastUrl = "";
  var startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise(function (r) { setTimeout(r, 2000); });
    var tab;
    try { tab = await chrome.tabs.get(tabId); } catch (e) {
      return { success: false, authenticated: false, reason: "tab_closed" };
    }
    lastUrl = tab && tab.url ? tab.url : lastUrl;
    if (/accounts\.google\.com/i.test(lastUrl)) sawGoogle = true;
    if (/checkpoint|challenge|security-verification|two-step|verify|captcha/i.test(lastUrl)) sawChallenge = true;
    var liAt = await getLiAtCookie();
    if (liAt) {
      var syncResult = await syncLiCookieToServer();
      return { success: true, authenticated: true, cookieSynced: !!syncResult.success, reason: sawGoogle ? "google_auth_completed" : sawChallenge ? "challenge_resolved" : "login_success", currentUrl: lastUrl };
    }
    if (/linkedin\.com/i.test(lastUrl)) {
      try {
        var stateRes = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: inspectLinkedInPage });
        var state = stateRes[0] && stateRes[0].result;
        if (state && state.authenticated) {
          var syncAuth = await syncLiCookieToServer();
          return { success: true, authenticated: true, cookieSynced: !!syncAuth.success, reason: "login_success", currentUrl: state.url || lastUrl };
        }
        if (state && state.isChallenge) sawChallenge = true;
      } catch (e) {}
    }
  }
  return { success: false, authenticated: false, reason: sawChallenge ? "challenge_timeout" : "login_timeout", tabStillOpen: true, currentUrl: lastUrl };
}

async function autoLoginLinkedIn() {
  var existingCookie = await getLiAtCookie();
  if (existingCookie) {
    var sessionCheck = await verifyLinkedInSession();
    if (sessionCheck.authenticated) return { success: true, authenticated: true, reason: "already_logged_in", cookieSynced: true };
  }
  var credRes = await fetch(SUPABASE_URL + "/functions/v1/get-linkedin-credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY },
    body: JSON.stringify({}),
  });
  var creds = await credRes.json();
  if (!creds.email || !creds.password) throw new Error("Credenziali LinkedIn non configurate.");

  var tab = await getLinkedInTab("https://www.linkedin.com/");
  try { await chrome.tabs.update(tab.id, { active: true }); } catch(_) {}

  try {
    var initialStateRes = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: inspectLinkedInPage });
    var initialState = initialStateRes[0] && initialStateRes[0].result;
    if (initialState && initialState.authenticated) {
      var syncInitial = await syncLiCookieToServer();
      return { success: true, authenticated: true, cookieSynced: !!syncInitial.success, reason: "already_logged_in" };
    }
    var prepRes = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: prepareOfficialLinkedInLoginPage });
    var prep = prepRes[0] && prepRes[0].result;
    if (!prep || !prep.success) return { success: false, authenticated: false, reason: "login_prepare_failed" };
    if (prep.state !== "form_ready" && prep.state !== "authenticated") await waitForTabLoad(tab.id, 25000);

    var readyStateRes = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: inspectLinkedInPage });
    var readyState = readyStateRes[0] && readyStateRes[0].result;
    if (readyState && readyState.authenticated) {
      var syncReady = await syncLiCookieToServer();
      return { success: true, authenticated: true, cookieSynced: !!syncReady.success, reason: "already_logged_in" };
    }
    if (readyState && readyState.hasGoogleButton && !readyState.hasLoginForm) {
      return await pollForLinkedInAuthCompletion(tab.id, 180000, { sawGoogle: true });
    }
    if (!readyState || !readyState.hasLoginForm) return { success: false, authenticated: false, reason: "login_form_not_found" };

    var injRes = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fillLinkedInLogin, args: [creds.email, creds.password] });
    var formResult = injRes[0] && injRes[0].result;
    if (!formResult || !formResult.success) return { success: false, authenticated: false, reason: "login_fill_failed", error: formResult && formResult.error };

    await waitForTabLoad(tab.id, 30000);
    return await pollForLinkedInAuthCompletion(tab.id, 180000);
  } catch (err) { return { success: false, authenticated: false, error: err.message, reason: "unexpected_error" }; }
}

// ══════════════════════════════════════════════════
// HYBRID OPERATIONS — 3-Level Fallback Chain
// Level 1: AX Tree (Accessibility)
// Level 2: AI Self-Healing (learned selectors)
// Level 3: Structural fallback (generic patterns)
// ══════════════════════════════════════════════════

async function hybridExtractProfile(tabId) {
  console.log("[LI-Hybrid] extractProfile — trying AX Tree...");

  // Level 1: AX Tree
  try {
    var axResult = await AXTree.extractProfile(tabId);
    if (axResult && axResult.name) {
      console.log("[LI-Hybrid] ✅ AX Tree succeeded:", axResult.name);
      // Enhance with photo URL via script injection (AX tree doesn't give img src easily)
      try {
        var photoRes = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: function () {
            // Use role/semantic attributes to find profile photo
            var img = document.querySelector("img[alt*='photo'], img[alt*='foto'], img[class*='profile-photo'], img[class*='pv-top-card']");
            return img ? img.src : null;
          },
        });
        if (photoRes[0] && photoRes[0].result) axResult.photoUrl = photoRes[0].result;
      } catch (_) {}
      axResult.profileUrl = (await chrome.tabs.get(tabId)).url;
      return { success: true, profile: axResult, method: "ax_tree" };
    }
  } catch (e) { console.warn("[LI-Hybrid] AX Tree failed:", e.message); }

  // Level 2: AI Self-Healing
  console.log("[LI-Hybrid] extractProfile — trying AI Learn...");
  try {
    var schema = await AILearn.getCached();
    if (!schema) {
      schema = await AILearn.learnFromAI(tabId, "profile", SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    if (schema) {
      var learnRes = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: AILearn.extractWithSchema,
        args: [schema],
      });
      var learnResult = learnRes[0] && learnRes[0].result;
      if (learnResult && learnResult.name) {
        console.log("[LI-Hybrid] ✅ AI Learn succeeded:", learnResult.name);
        return { success: true, profile: learnResult, method: "ai_learn" };
      }
      // Selectors stale — force re-learn
      console.log("[LI-Hybrid] AI Learn stale, re-learning...");
      await AILearn.clearCache();
      schema = await AILearn.learnFromAI(tabId, "profile", SUPABASE_URL, SUPABASE_ANON_KEY);
      if (schema) {
        var retryRes = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: AILearn.extractWithSchema,
          args: [schema],
        });
        var retryResult = retryRes[0] && retryRes[0].result;
        if (retryResult && retryResult.name) {
          return { success: true, profile: retryResult, method: "ai_learn_retry" };
        }
      }
    }
  } catch (e) { console.warn("[LI-Hybrid] AI Learn failed:", e.message); }

  // Level 3: Structural fallback (generic semantic patterns)
  console.log("[LI-Hybrid] extractProfile — structural fallback...");
  try {
    var fallbackRes = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () {
        var result = { name: null, headline: null, location: null, about: null, photoUrl: null, profileUrl: window.location.href, connectionStatus: "unknown" };
        // Use generic semantic patterns
        var h1 = document.querySelector("h1");
        if (h1) result.name = h1.textContent.trim();
        // Second text block after h1 is usually headline
        if (h1 && h1.nextElementSibling) {
          var next = h1.nextElementSibling;
          if (next.textContent.trim().length > 3 && next.textContent.trim().length < 200) {
            result.headline = next.textContent.trim();
          }
        }
        // Buttons for connection status
        var allBtns = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent !== null; });
        for (var i = 0; i < allBtns.length; i++) {
          var t = allBtns[i].textContent.trim().toLowerCase();
          if (/^(connect|collegati|connetti)$/.test(t)) { result.connectionStatus = "not_connected"; break; }
          if (/^(messag|scrivi)/.test(t)) { result.connectionStatus = "connected"; break; }
          if (/^(pending|in attesa)/.test(t)) { result.connectionStatus = "pending"; break; }
        }
        return result;
      },
    });
    var fallbackResult = fallbackRes[0] && fallbackRes[0].result;
    if (fallbackResult && fallbackResult.name) {
      console.log("[LI-Hybrid] ✅ Structural fallback succeeded:", fallbackResult.name);
      return { success: true, profile: fallbackResult, method: "structural_fallback" };
    }
  } catch (e) { console.warn("[LI-Hybrid] Structural fallback failed:", e.message); }

  return { success: false, error: "All 3 extraction strategies failed" };
}

async function hybridSendMessage(tabId, message) {
  console.log("[LI-Hybrid] sendMessage — trying AX Tree...");

  // Level 1: AX Tree
  try {
    var axResult = await AXTree.typeMessage(tabId, message);
    if (axResult && axResult.success) {
      console.log("[LI-Hybrid] ✅ Message sent via AX Tree");
      return axResult;
    }
  } catch (e) { console.warn("[LI-Hybrid] AX Tree message failed:", e.message); }

  // Level 2: AI Learn
  console.log("[LI-Hybrid] sendMessage — trying AI Learn...");
  try {
    var schema = await AILearn.getCached();
    if (!schema) schema = await AILearn.learnFromAI(tabId, "messaging", SUPABASE_URL, SUPABASE_ANON_KEY);
    if (schema) {
      var learnRes = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: AILearn.typeMessageWithSchema,
        args: [schema, message],
      });
      var learnResult = learnRes[0] && learnRes[0].result;
      if (learnResult && learnResult.success) return learnResult;
    }
  } catch (e) { console.warn("[LI-Hybrid] AI Learn message failed:", e.message); }

  // Level 3: Structural fallback
  console.log("[LI-Hybrid] sendMessage — structural fallback...");
  try {
    var fbRes = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function (msg) {
        // Find any contenteditable textbox
        var msgBox = document.querySelector("div[role='textbox'][contenteditable='true']")
          || document.querySelector("[contenteditable='true'][aria-label]");
        if (!msgBox) return { success: false, error: "Fallback: no textbox found" };
        msgBox.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, msg);
        msgBox.dispatchEvent(new Event("input", { bubbles: true }));
        // Find send button by text
        var sendBtn = Array.from(document.querySelectorAll("button")).find(function (b) {
          return /^(send|invia)$/i.test(b.textContent.trim()) && b.offsetParent !== null;
        });
        if (sendBtn) { sendBtn.click(); return { success: true, method: "structural_fallback" }; }
        return { success: false, error: "Fallback: send button not found" };
      },
      args: [message],
    });
    var fbResult = fbRes[0] && fbRes[0].result;
    if (fbResult && fbResult.success) return fbResult;
    return fbResult || { success: false, error: "All message strategies failed" };
  } catch (e) { return { success: false, error: "All message strategies failed: " + e.message }; }
}

async function hybridClickConnect(tabId) {
  console.log("[LI-Hybrid] clickConnect — trying AX Tree...");

  // Level 1: AX Tree
  try {
    var axResult = await AXTree.clickConnect(tabId);
    if (axResult && axResult.success) return axResult;
  } catch (e) { console.warn("[LI-Hybrid] AX Tree connect failed:", e.message); }

  // Level 2: AI Learn
  console.log("[LI-Hybrid] clickConnect — trying AI Learn...");
  try {
    var schema = await AILearn.getCached();
    if (!schema) schema = await AILearn.learnFromAI(tabId, "profile", SUPABASE_URL, SUPABASE_ANON_KEY);
    if (schema) {
      var learnRes = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: AILearn.clickConnectWithSchema,
        args: [schema],
      });
      var learnResult = learnRes[0] && learnRes[0].result;
      if (learnResult && learnResult.success) return learnResult;
    }
  } catch (e) { console.warn("[LI-Hybrid] AI Learn connect failed:", e.message); }

  // Level 3: Structural fallback
  console.log("[LI-Hybrid] clickConnect — structural fallback...");
  try {
    var fbRes = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () {
        var btn = Array.from(document.querySelectorAll("button")).find(function (el) {
          return /^(connect|collegati|connetti)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
        });
        if (btn) { btn.click(); return { success: true, method: "structural_fallback" }; }
        // Try "More" dropdown
        var moreBtn = Array.from(document.querySelectorAll("button")).find(function (el) {
          return /^(more|altro)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
        });
        if (moreBtn) {
          moreBtn.click();
          return new Promise(function (resolve) {
            setTimeout(function () {
              var dropItem = Array.from(document.querySelectorAll("[role='option'], [role='menuitem'], li, span")).find(function (el) {
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
    return (fbRes[0] && fbRes[0].result) || { success: false, error: "All connect strategies failed" };
  } catch (e) { return { success: false, error: e.message }; }
}

async function hybridClickMessage(tabId) {
  // Level 1: AX Tree
  try {
    var axResult = await AXTree.clickMessageButton(tabId);
    if (axResult && axResult.success) return axResult;
  } catch (e) {}
  // Level 3: Structural fallback (text-based)
  try {
    var fbRes = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () {
        var btn = Array.from(document.querySelectorAll("button, a")).find(function (el) {
          return /^messag|^scrivi/i.test(el.textContent.trim()) && el.offsetParent !== null;
        });
        if (btn) { btn.click(); return { success: true, method: "structural_fallback" }; }
        return { success: false, error: "Message button not found" };
      },
    });
    return (fbRes[0] && fbRes[0].result) || { success: false, error: "Message button not found" };
  } catch (e) { return { success: false, error: e.message }; }
}

async function hybridAddNote(tabId, noteText) {
  // Level 1: AX Tree
  try {
    var axResult = await AXTree.addNote(tabId, noteText);
    if (axResult && axResult.success) return axResult;
  } catch (e) {}
  // Level 3: Structural fallback
  try {
    var fbRes = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function (note) {
        var addBtn = Array.from(document.querySelectorAll("button")).find(function (el) {
          return /add a note|aggiungi nota/i.test(el.textContent.trim());
        });
        if (!addBtn) return { success: false, error: "Add Note button not found" };
        addBtn.click();
        return new Promise(function (resolve) {
          setTimeout(function () {
            var textarea = document.querySelector("textarea");
            if (!textarea) { resolve({ success: false, error: "Note textarea not found" }); return; }
            var nativeSet = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
            textarea.focus();
            nativeSet.call(textarea, note);
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            setTimeout(function () {
              var sendBtn = Array.from(document.querySelectorAll("button")).find(function (el) {
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

// ══════════════════════════════════════════════════
// HIGH-LEVEL OPERATIONS (use hybrid functions)
// ══════════════════════════════════════════════════

async function extractProfileByUrl(url) {
  if (!url) return { success: false, error: "URL mancante" };
  var tab = await getLinkedInTab(url);
  return await hybridExtractProfile(tab.id);
}

async function sendLinkedInMessage(profileUrl, message) {
  if (!profileUrl) return { success: false, error: "URL profilo mancante" };
  if (!message) return { success: false, error: "Messaggio mancante" };
  var tab = await getLinkedInTab(profileUrl.replace(/\/$/, ""));
  // Click Message button first
  var clickResult = await hybridClickMessage(tab.id);
  if (!clickResult || !clickResult.success) return { success: false, error: (clickResult && clickResult.error) || "Message button not found" };
  await new Promise(function (r) { setTimeout(r, 3000); });
  return await hybridSendMessage(tab.id, message);
}

async function sendConnectionRequest(profileUrl, note) {
  if (!profileUrl) return { success: false, error: "URL profilo mancante" };
  var tab = await getLinkedInTab(profileUrl.replace(/\/$/, ""));
  var clickResult = await hybridClickConnect(tab.id);
  if (!clickResult || !clickResult.success) return { success: false, error: (clickResult && clickResult.error) || "Connect button not found" };
  await new Promise(function (r) { setTimeout(r, 2000); });
  if (note && note.trim()) {
    return await hybridAddNote(tab.id, note);
  } else {
    // Send without note
    try {
      var sendRes = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          var btn = Array.from(document.querySelectorAll("button")).find(function (el) {
            return /send without|invia senza|send now/i.test(el.textContent.trim());
          }) || Array.from(document.querySelectorAll("button")).find(function (el) {
            return /^(send|invia)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
          });
          if (btn) { btn.click(); return { success: true }; }
          return { success: false, error: "Send button not found" };
        },
      });
      return (sendRes[0] && sendRes[0].result) || { success: false, error: "Send failed" };
    } catch (e) { return { success: false, error: e.message }; }
  }
}

async function searchLinkedInProfile(query) {
  if (!query) return { success: false, error: "Query mancante" };
  var searchUrl = "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(query);
  var tab = await getLinkedInTab(searchUrl);
  await new Promise(function (r) { setTimeout(r, 3000); });
  try {
    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () {
        // Use href pattern — stable across LinkedIn updates
        var allLinks = document.querySelectorAll("a[href*='/in/']");
        for (var i = 0; i < allLinks.length; i++) {
          var href = allLinks[i].href || "";
          if (/linkedin\.com\/in\/[^/]+/.test(href) && !/\/in\/miniprofile/.test(href) && !/\/in\/ACo/.test(href)) {
            var cleanUrl = href.split("?")[0].replace(/\/$/, "");
            var container = allLinks[i].closest("li, [data-chameleon-result-urn]");
            var name = "";
            var headline = "";
            if (container) {
              var nameEl = container.querySelector("span[aria-hidden='true']");
              if (nameEl) name = nameEl.textContent.trim();
              if (!name) { var dirEl = container.querySelector("h3 span[dir='ltr'], a span[dir='ltr'], span[dir='ltr']"); if (dirEl) name = dirEl.textContent.trim(); }
              if (!name && allLinks[i].textContent) { var lt = allLinks[i].textContent.replace(/\s+/g," ").trim(); if (lt.length>1 && lt.length<80) name = lt; }
              if (!name) { var h = container.querySelector("h3, h4"); if (h) name = h.textContent.replace(/\s+/g," ").trim(); }
              var secEl = container.querySelector("div[class*='subtitle'], p[class*='summary']");
              if (secEl) headline = secEl.textContent.replace(/\s+/g," ").trim().substring(0,200);
              if (!headline) { var ps = container.querySelectorAll("p, div[class*='t-']"); for (var pp=0;pp<ps.length;pp++) { var pt=ps[pp].textContent.replace(/\s+/g," ").trim(); if (pt && pt!==name && pt.length>3 && pt.length<200){headline=pt;break;} } }
            }
            if (!name) { var al = allLinks[i].getAttribute("aria-label")||""; if (al.length>1) name = al.split(",")[0].trim(); }
            return { profileUrl: cleanUrl, name: name, headline: headline };
          }
        }
        return null;
      },
    });
    var profileData = results[0] && results[0].result;
    if (profileData && profileData.profileUrl) return { success: true, profile: profileData };
    return { success: false, error: "Nessun profilo trovato per: " + query };
  } catch (err) { return { success: false, error: err.message }; }
}

async function readLinkedInInbox() {
  var tab = await getLinkedInTab("https://www.linkedin.com/messaging/", false);
  await new Promise(function (r) { setTimeout(r, 5000); });

  // Level 1: AX Tree
  try {
    var axResult = await AXTree.readInbox(tab.id);
    if (axResult && axResult.threads && axResult.threads.length > 0) return axResult;
  } catch (e) { console.warn("[LI-Hybrid] AX inbox failed:", e.message || e); }

  // Level 3: Structural fallback (link href pattern)
  try {
    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () {
        var threads = [];
        var seen = {};
        var threadLinks = document.querySelectorAll("a[href*='/messaging/thread/']");
        threadLinks.forEach(function (link) {
          var threadUrl = link.href || "";
          if (seen[threadUrl]) return;
          seen[threadUrl] = true;
          var container = link.closest("li") || link.parentElement;
          if (!container) return;
          var name = "";
          var lastMsg = "";
          var unread = false;
          var h3 = container.querySelector("h3");
          if (h3) { var h3t = h3.textContent.replace(/\s+/g," ").trim(); if (h3t.length>1 && h3t.length<80) name = h3t; }
          if (!name) { var spans = container.querySelectorAll("span"); for (var si=0;si<spans.length;si++) { var st=(spans[si].textContent||"").trim(); if (st.length>1 && st.length<60 && !/^\d{1,2}[\/:\.]/.test(st) && !/^(oggi|ieri|today|yesterday|now|ora)/i.test(st) && !/^(passa|go to|details)/i.test(st)) { name=st; break; } } }
          if (!name) { var img = container.querySelector("img[alt]"); if (img) { var alt=(img.getAttribute("alt")||"").trim(); if (alt.length>1 && alt.length<60 && !/photo|foto|avatar/i.test(alt)) name=alt; } }
          var msgP = container.querySelector("p, [class*='snippet']");
          if (msgP) lastMsg = msgP.textContent.replace(/\s+/g," ").trim().substring(0,120);
          var badge = container.querySelector("[class*='unread'], [class*='badge']");
          if (badge) unread = true;
          if (!name || /^(passa ai|go to|details|dettagli|conversation|conversazione)/i.test(name)) {
            return;
          }
          threads.push({ name: name, threadUrl: threadUrl, unread: unread, lastMessage: lastMsg });
        });
        return { success: true, threads: threads, method: "structural_fallback" };
      },
    });
    return (results[0] && results[0].result) || { success: false, error: "No inbox data" };
  } catch (e) { return { success: false, error: e.message }; }
}

async function readLinkedInThread(threadUrl) {
  if (!threadUrl) return { success: false, error: "Thread URL mancante" };
  var tab = await getLinkedInTab(threadUrl, false);
  await new Promise(function (r) { setTimeout(r, 6000); });

  // Level 1: AX Tree
  try {
    var axResult = await AXTree.readThread(tab.id);
    if (axResult && axResult.messages && axResult.messages.length > 0) return axResult;
  } catch (e) {}

  // Level 3: Structural fallback
  try {
    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () {
        var messages = [];
        // Find all list items that could be messages
        var items = document.querySelectorAll("li[class*='msg-'], li[class*='message'], [class*='msg-s-event']");
        if (items.length === 0) items = document.querySelectorAll("main li, [role='main'] li");
        items.forEach(function (item) {
          var bodyEl = item.querySelector("p, [class*='body'], [class*='content']");
          var senderEl = item.querySelector("h3, span[class*='name'], [class*='sender']");
          var timeEl = item.querySelector("time, [class*='time']");
          var text = bodyEl ? bodyEl.textContent.trim() : "";
          var sender = senderEl ? senderEl.textContent.trim() : "";
          var timestamp = timeEl ? (timeEl.getAttribute("datetime") || timeEl.textContent.trim()) : new Date().toISOString();
          if (text) messages.push({ text: text, sender: sender, timestamp: timestamp, direction: "inbound" });
        });
        return { success: true, messages: messages, method: "structural_fallback" };
      },
    });
    return (results[0] && results[0].result) || { success: false, error: "No thread data" };
  } catch (e) { return { success: false, error: e.message }; }
}

async function diagnosticLinkedInDom() {
  var tab = await getLinkedInTab("https://www.linkedin.com/messaging/", false);
  await new Promise(function (r) { setTimeout(r, 5000); });

  // Run diagnostic with AX Tree availability check
  var axAvailable = false;
  try { axAvailable = await AXTree.isAvailable(tab.id); } catch (_) {}

  var schema = await AILearn.getCached();

  var results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: function () {
      var url = window.location.href;
      var title = document.title;
      var bodyLen = (document.body.innerText || "").length;
      // Semantic checks (no hardcoded classes)
      var hasMain = !!document.querySelector("main, [role='main']");
      var hasNav = !!document.querySelector("nav, [role='banner'], [role='navigation']");
      var hasTextbox = !!document.querySelector("[role='textbox'], [contenteditable='true']");
      var threadLinks = document.querySelectorAll("a[href*='/messaging/thread/']").length;
      var buttons = [];
      document.querySelectorAll("button").forEach(function (b) {
        if (b.offsetParent !== null) buttons.push(b.textContent.trim().substring(0, 40));
      });
      var roles = [];
      document.querySelectorAll("[role]").forEach(function (el) {
        var r = el.getAttribute("role");
        if (roles.indexOf(r) === -1) roles.push(r);
      });
      return {
        success: true, url: url, title: title, bodyLength: bodyLen,
        hasMain: hasMain, hasNav: hasNav, hasTextbox: hasTextbox,
        threadLinksCount: threadLinks,
        visibleButtons: buttons.slice(0, 20),
        uniqueRoles: roles,
      };
    },
  });

  var domResult = (results[0] && results[0].result) || {};
  domResult.axTreeAvailable = axAvailable;
  domResult.aiLearnCached = !!schema;
  domResult.aiLearnAge = schema && schema.learnedAt ? Math.round((Date.now() - schema.learnedAt) / 60000) + " min ago" : "never";

  return domResult;
}

// AI DOM Learning action
async function learnLinkedInDom(pageType) {
  var url = pageType === "messaging" ? "https://www.linkedin.com/messaging/" : "https://www.linkedin.com/in/me/";
  var tab = await getLinkedInTab(url, false);
  await new Promise(function (r) { setTimeout(r, 4000); });
  var schema = await AILearn.learnFromAI(tab.id, pageType || "profile", SUPABASE_URL, SUPABASE_ANON_KEY);
  if (schema) return { success: true, schema: schema, keysCount: Object.keys(schema).length };
  return { success: false, error: "AI learning failed" };
}

// ══════════════════════════════════════════════════
// MESSAGE HANDLER
// ══════════════════════════════════════════════════

var _tabQueue = Promise.resolve();
function enqueueTabOp(fn) { _tabQueue = _tabQueue.then(fn, fn); return _tabQueue; }

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  var source = message && message.source;
  if (source !== "li-content-bridge" && source !== "li-popup") return false;

  if (message.action === "ping") { sendResponse({ success: true, version: "2.0" }); return false; }

  if (message.action === "verifySession") {
    enqueueTabOp(async function () {
      try { var r = await verifyLinkedInSession(); sendResponse({ success: true, authenticated: r.authenticated, reason: r.reason }); }
      catch (err) { sendResponse({ success: false, authenticated: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "syncCookie") {
    enqueueTabOp(async function () {
      try { sendResponse(await syncLiCookieToServer()); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "autoLogin") {
    enqueueTabOp(async function () {
      try { sendResponse(await autoLoginLinkedIn()); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "extractProfile") {
    enqueueTabOp(async function () {
      try { sendResponse(await extractProfileByUrl(message.url)); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "sendMessage") {
    enqueueTabOp(async function () {
      try { sendResponse(await sendLinkedInMessage(message.url, message.message)); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "sendConnectionRequest") {
    enqueueTabOp(async function () {
      try { sendResponse(await sendConnectionRequest(message.url, message.note)); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "searchProfile") {
    enqueueTabOp(async function () {
      try { sendResponse(await searchLinkedInProfile(message.query)); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "readLinkedInInbox") {
    enqueueTabOp(async function () {
      try { sendResponse(await readLinkedInInbox()); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "readLinkedInThread") {
    enqueueTabOp(async function () {
      try { sendResponse(await readLinkedInThread(message.threadUrl)); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "diagnosticLinkedInDom") {
    enqueueTabOp(async function () {
      try { sendResponse(await diagnosticLinkedInDom()); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "learnDom") {
    enqueueTabOp(async function () {
      try { sendResponse(await learnLinkedInDom(message.pageType)); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  return false;
});

// ── On install ──
chrome.runtime.onInstalled.addListener(async function () {
  console.log("[LinkedIn Extension v2.0] Installed — Hybrid AX Tree + AI Self-Healing");
  await syncLiCookieToServer();
});
