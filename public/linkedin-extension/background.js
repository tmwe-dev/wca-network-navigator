// ══════════════════════════════════════════════════
// LinkedIn Cookie Sync - Background Service Worker
// Handles auto-login, cookie sync, session verification, profile extraction
// ══════════════════════════════════════════════════

var SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

// ── Persistent LinkedIn tab — reused across all operations ──
var _liTabId = null;

async function safeTabCreate(options, maxRetries) {
  maxRetries = maxRetries || 3;
  for (var attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await chrome.tabs.create(options);
    } catch (err) {
      if (attempt < maxRetries - 1 && /cannot be edited/i.test(err.message)) {
        await new Promise(function(r) { setTimeout(r, 500); });
      } else {
        throw err;
      }
    }
  }
}

async function safeTabRemove(tabId) {
  // Never remove the persistent LinkedIn tab
  if (tabId === _liTabId) return;
  try { await chrome.tabs.remove(tabId); } catch (e) {}
}

// Get or create a single persistent LinkedIn tab
// If skipNavigate=true and tab is already on linkedin.com, reuse without navigating
async function getLinkedInTab(url, skipNavigateIfSameDomain) {
  // Check if existing tab is still alive
  if (_liTabId !== null) {
    try {
      var existing = await chrome.tabs.get(_liTabId);
      if (existing) {
        // If tab is already on linkedin.com and we don't need a specific page, reuse as-is
        if (skipNavigateIfSameDomain && existing.url && /linkedin\.com/i.test(existing.url)) {
          // Already on LinkedIn — no need to navigate
          if (existing.status !== "complete") await waitForTabLoad(_liTabId, 15000);
          return { id: _liTabId, reused: true };
        }
        // Navigate existing tab to new URL
        await chrome.tabs.update(_liTabId, { url: url });
        await waitForTabLoad(_liTabId, 20000);
        return { id: _liTabId, reused: false };
      }
    } catch (_) {
      _liTabId = null; // tab was closed by user
    }
  }
  // Also try to find any existing LinkedIn tab before creating one
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
  // Create new persistent tab (background, not active)
  var tab = await safeTabCreate({ url: url, active: false });
  _liTabId = tab.id;
  await waitForTabLoad(tab.id, 20000);
  return tab;
}

// ── Wait for tab to finish loading ──
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

// ── Check if LinkedIn session is active (injected into page) ──
function checkLinkedInSession() {
  try {
    var url = window.location.href || "";
    var title = document.title || "";
    var bodyText = document.body.innerText || "";

    // Logged-in UI markers across feed, messaging, profile, search, network, jobs
    var loggedInUi = !!document.querySelector([
      ".global-nav__me",
      ".global-nav",
      ".scaffold-layout",
      ".feed-shared-update-v2",
      ".msg-overlay-list-bubble",
      ".msg-conversations-container",
      "a[href*='/messaging/thread/']",
      "button[aria-label*='Messaggio']",
      "button[aria-label*='Message']",
      ".search-results-container",
      ".pv-top-card",
      ".profile-photo-edit",
      ".mn-connection-card",
      ".jobs-search-results-list"
    ].join(", "));

    var hasLiCookieUi = /linkedin\.com\/(feed|messaging|in\/|search\/results|mynetwork|jobs)/i.test(url);
    var loginPage = !!document.querySelector("#username, .login__form, input[name='session_key'], input[name='session_password']");
    var hasSignIn = /Sign in|Accedi|Log in/i.test(title) || /sign in|accedi|log in/i.test(bodyText.slice(0, 1500));

    var authenticated = (loggedInUi || hasLiCookieUi) && !loginPage && !hasSignIn;

    return {
      authenticated: authenticated,
      reason: authenticated
        ? (url.includes("/messaging") ? "messaging_present"
          : url.includes("/in/") ? "profile_present"
          : url.includes("/search/") ? "search_present"
          : url.includes("/mynetwork") ? "network_present"
          : url.includes("/jobs") ? "jobs_present"
          : "logged_in_ui_present")
        : loginPage ? "login_page"
        : hasSignIn ? "sign_in_title"
        : "unknown",
    };
  } catch (e) {
    return { authenticated: false, reason: "error: " + e.message };
  }
}

// ── Extract profile data from a LinkedIn profile page (injected) ──
function extractLinkedInProfile() {
  try {
    var result = {
      name: null,
      headline: null,
      location: null,
      about: null,
      photoUrl: null,
      profileUrl: window.location.href,
      connectionStatus: "unknown",
    };

    // Name
    var nameEl = document.querySelector("h1.text-heading-xlarge, h1.inline");
    if (nameEl) result.name = nameEl.textContent.trim();

    // Headline (title/role)
    var headlineEl = document.querySelector(".text-body-medium.break-words, .pv-top-card--list .text-body-medium");
    if (headlineEl) result.headline = headlineEl.textContent.trim();

    // Location
    var locationEl = document.querySelector(".text-body-small.inline.t-black--light.break-words, span.text-body-small[class*='t-black--light']");
    if (locationEl) result.location = locationEl.textContent.trim();

    // About section
    var aboutSection = document.querySelector("#about ~ .display-flex .inline-show-more-text, .pv-about-section .pv-about__summary-text");
    if (aboutSection) result.about = aboutSection.textContent.trim();

    // Photo
    var photoEl = document.querySelector("img.pv-top-card-profile-picture__image, img.profile-photo-edit__preview");
    if (photoEl && photoEl.src) result.photoUrl = photoEl.src;

    // Connection status detection
    // Look for the main action button on the profile
    var connectBtn = document.querySelector("button.pvs-profile-actions__action[aria-label*='Collegati'], button.pvs-profile-actions__action[aria-label*='Connect']");
    var messageBtn = document.querySelector("button.pvs-profile-actions__action[aria-label*='Messaggio'], button.pvs-profile-actions__action[aria-label*='Message']");
    var pendingBtn = document.querySelector("button.pvs-profile-actions__action[aria-label*='In attesa'], button.pvs-profile-actions__action[aria-label*='Pending']");

    if (pendingBtn) {
      result.connectionStatus = "pending";
    } else if (messageBtn && !connectBtn) {
      result.connectionStatus = "connected";
    } else if (connectBtn) {
      result.connectionStatus = "not_connected";
    } else {
      // Fallback: check all buttons text
      var allBtns = document.querySelectorAll("button.pvs-profile-actions__action");
      for (var i = 0; i < allBtns.length; i++) {
        var btnText = (allBtns[i].textContent || "").trim().toLowerCase();
        if (btnText === "messaggio" || btnText === "message") { result.connectionStatus = "connected"; break; }
        if (btnText === "collegati" || btnText === "connect") { result.connectionStatus = "not_connected"; break; }
        if (btnText === "in attesa" || btnText === "pending") { result.connectionStatus = "pending"; break; }
      }
    }

    return result;
  } catch (e) {
    return { error: e.message };
  }
}

// ── Get li_at cookie ──
async function getLiAtCookie() {
  try {
    var cookie = await chrome.cookies.get({ url: "https://www.linkedin.com/", name: "li_at" });
    return cookie ? cookie.value : null;
  } catch (e) {
    return null;
  }
}

// ── Sync li_at cookie to server ──
async function syncLiCookieToServer() {
  try {
    var liAt = await getLiAtCookie();
    if (!liAt) return { success: false, error: "Cookie li_at non trovato" };

    var res = await fetch(SUPABASE_URL + "/functions/v1/save-linkedin-cookie", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ cookie: liAt }),
    });
    var data = await res.json();
    return { success: true, cookieLength: liAt.length, saved: data.success };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ── Verify LinkedIn session — cookie-first, no unnecessary navigation ──
async function verifyLinkedInSession() {
  // Step 1: Check cookie first — if no cookie, we're definitely not logged in
  var liAt = await getLiAtCookie();
  if (!liAt) {
    return { authenticated: false, reason: "no_cookie" };
  }

  // Step 2: Cookie exists — try to verify page state using existing tab (no navigation)
  var tab = await getLinkedInTab("https://www.linkedin.com/feed/", true); // skipNavigate if already on LI
  try {
    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: checkLinkedInSession,
    });
    var sessionResult = results[0] && results[0].result;
    if (sessionResult && sessionResult.authenticated) {
      // Sync cookie in background, don't block
      syncLiCookieToServer().catch(function(){});
    }
    return sessionResult || { authenticated: false, reason: "no_result" };
  } catch (err) {
    // Script injection failed but cookie exists — assume authenticated
    return { authenticated: true, reason: "cookie_present_script_error", cookieLength: liAt.length };
  }
}

function inspectLinkedInPage() {
  try {
    function firstVisible(selectorList) {
      for (var i = 0; i < selectorList.length; i++) {
        var nodes = document.querySelectorAll(selectorList[i]);
        for (var j = 0; j < nodes.length; j++) {
          var el = nodes[j];
          if (!el) continue;
          var style = window.getComputedStyle(el);
          var visible = style.display !== "none" && style.visibility !== "hidden" && !el.disabled && (el.offsetParent !== null || style.position === "fixed");
          if (visible) return el;
        }
      }
      return null;
    }

    var session = checkLinkedInSession();
    var url = window.location.href;
    var title = document.title || "";
    var userInput = firstVisible(["#username", "input[name='session_key']", "input[autocomplete='username']"]);
    var passInput = firstVisible(["#password", "input[name='session_password']", "input[autocomplete='current-password']"]);
    var loginForm = !!(userInput || passInput || document.querySelector(".login__form, form[action*='login-submit'], form[action*='checkpoint/lg/login-submit']"));
    var googleButton = Array.from(document.querySelectorAll("a, button")).find(function (el) {
      var text = (el.textContent || "").trim();
      return /continue with google|continua con google|sign in with google|accedi con google/i.test(text) && el.offsetParent !== null;
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
    var hasCaptcha = !!document.querySelector("iframe[src*='captcha'], #captcha, .recaptcha, [data-captcha]");
    var hasPhoneVerify = !!document.querySelector("#input__phone_verification_pin, input[name='pin']");
    var hasTwoStep = !!document.querySelector("input[name='verificationCode'], input[name='otpPin'], input[autocomplete='one-time-code']");
    var errorMsg = document.querySelector(".alert-content, .form__label--error, #error-for-password, [role='alert']");

    return {
      url: url,
      title: title,
      authenticated: !!(session && session.authenticated),
      sessionReason: session && session.reason ? session.reason : "unknown",
      hasLoginForm: loginForm,
      hasUsername: !!userInput,
      hasPassword: !!passInput,
      hasGoogleButton: !!googleButton,
      hasSignInLink: !!signInLink,
      isChallenge: /checkpoint|challenge|security-verification|two-step|verify|captcha/i.test(url) || hasCaptcha || hasPhoneVerify || hasTwoStep,
      errorText: errorMsg ? (errorMsg.textContent || "").trim() : null,
    };
  } catch (e) {
    return {
      url: window.location.href,
      title: document.title || "",
      authenticated: false,
      hasLoginForm: false,
      hasGoogleButton: false,
      hasSignInLink: false,
      isChallenge: false,
      errorText: null,
      error: e.message,
    };
  }
}

function prepareOfficialLinkedInLoginPage() {
  try {
    var state = inspectLinkedInPage();
    if (state.authenticated) return { success: true, state: "authenticated", url: state.url };
    if (state.hasLoginForm) return { success: true, state: "form_ready", url: state.url };

    var signInLink = Array.from(document.querySelectorAll("a, button")).find(function (el) {
      var text = (el.textContent || "").trim();
      if (!el || el.offsetParent === null) return false;
      if (/google/i.test(text)) return false;
      if (/join|iscriviti|registrati/i.test(text)) return false;
      if (/^sign in$|^log in$|^accedi$/i.test(text)) return true;
      if (el.tagName === "A" && /\/login/.test(el.getAttribute("href") || "")) return true;
      return false;
    });

    if (signInLink) {
      signInLink.click();
      return { success: true, state: "clicked_sign_in", url: window.location.href };
    }

    window.location.href = "https://www.linkedin.com/login";
    return { success: true, state: "navigated_to_login", url: window.location.href };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Auto-login to LinkedIn ──
function fillLinkedInLogin(email, password) {
  try {
    function firstVisible(selectorList) {
      for (var i = 0; i < selectorList.length; i++) {
        var nodes = document.querySelectorAll(selectorList[i]);
        for (var j = 0; j < nodes.length; j++) {
          var el = nodes[j];
          if (!el) continue;
          var style = window.getComputedStyle(el);
          var visible = style.display !== "none" && style.visibility !== "hidden" && !el.disabled && (el.offsetParent !== null || style.position === "fixed");
          if (visible) return el;
        }
      }
      return null;
    }

    var userInput = firstVisible(["#username", "input[name='session_key']", "input[autocomplete='username']"]);
    var passInput = firstVisible(["#password", "input[name='session_password']", "input[autocomplete='current-password']"]);

    if (!userInput || !passInput) {
      return { success: false, error: "Campi login non trovati nella pagina ufficiale. User:" + !!userInput + " Pass:" + !!passInput };
    }

    var nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    userInput.focus();
    nativeSet.call(userInput, email);
    userInput.dispatchEvent(new Event("input", { bubbles: true }));
    userInput.dispatchEvent(new Event("change", { bubbles: true }));

    passInput.focus();
    nativeSet.call(passInput, password);
    passInput.dispatchEvent(new Event("input", { bubbles: true }));
    passInput.dispatchEvent(new Event("change", { bubbles: true }));

    var submitBtn = firstVisible([
      "button[type='submit']",
      ".login__form_action_container button",
      "button.btn__primary--large",
      "button[data-litms-control-urn*='login-submit']"
    ]);

    if (submitBtn) {
      submitBtn.click();
      return { success: true, method: "button" };
    }

    var form = userInput.closest("form");
    if (form) {
      form.requestSubmit ? form.requestSubmit() : form.submit();
      return { success: true, method: "form" };
    }

    return { success: false, error: "Nessun submit trovato" };
  } catch (e) {
    return { success: false, error: e.message };
  }
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
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (e) {
      return {
        success: false,
        authenticated: false,
        reason: "tab_closed",
        message: "Il tab LinkedIn è stato chiuso prima del completamento del login.",
      };
    }

    lastUrl = tab && tab.url ? tab.url : lastUrl;

    if (/accounts\.google\.com/i.test(lastUrl)) sawGoogle = true;
    if (/checkpoint|challenge|security-verification|two-step|verify|captcha/i.test(lastUrl)) sawChallenge = true;

    var liAt = await getLiAtCookie();
    if (liAt) {
      var syncResult = await syncLiCookieToServer();
      var authenticated = true;

      if (/linkedin\.com/i.test(lastUrl)) {
        try {
          var sessionRes = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: checkLinkedInSession,
          });
          var session = sessionRes[0] && sessionRes[0].result;
          authenticated = !session || !!session.authenticated;
        } catch (e) {}
      }

      return {
        success: authenticated,
        authenticated: authenticated,
        cookieSynced: !!syncResult.success,
        reason: sawGoogle ? "google_auth_completed" : sawChallenge ? "challenge_resolved_manually" : "login_success",
        currentUrl: lastUrl,
      };
    }

    if (/linkedin\.com/i.test(lastUrl)) {
      try {
        var stateRes = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: inspectLinkedInPage,
        });
        var state = stateRes[0] && stateRes[0].result;

        if (state) {
          if (state.authenticated) {
            var syncIfAuthenticated = await syncLiCookieToServer();
            return {
              success: true,
              authenticated: true,
              cookieSynced: !!syncIfAuthenticated.success,
              reason: sawGoogle ? "google_auth_completed" : "login_success",
              currentUrl: state.url || lastUrl,
            };
          }

          if (state.errorText) {
            return {
              success: false,
              authenticated: false,
              reason: "login_error",
              message: state.errorText,
              currentUrl: state.url || lastUrl,
            };
          }

          if (state.isChallenge) sawChallenge = true;
          if (state.hasGoogleButton && !state.hasLoginForm) sawGoogle = true;
        }
      } catch (e) {}
    }
  }

  return {
    success: false,
    authenticated: false,
    reason: sawGoogle ? "google_auth_timeout" : sawChallenge ? "challenge_timeout" : "login_timeout",
    message: sawGoogle
      ? "Google ha aperto la sua autenticazione. Completa l'accesso nel tab aperto: appena LinkedIn torna online il cookie verrà sincronizzato."
      : sawChallenge
      ? "LinkedIn richiede una verifica di sicurezza. Completa la verifica nel tab aperto e riprova."
      : "Login LinkedIn non completato in tempo.",
    tabStillOpen: true,
    currentUrl: lastUrl,
    needsGoogleAuth: sawGoogle,
  };
}

async function autoLoginLinkedIn() {
  var existingCookie = await getLiAtCookie();
  if (existingCookie) {
    var sessionCheck = await verifyLinkedInSession();
    if (sessionCheck.authenticated) {
      return { success: true, authenticated: true, reason: "already_logged_in", cookieSynced: true };
    }
  }

  var credRes = await fetch(SUPABASE_URL + "/functions/v1/get-linkedin-credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  var creds = await credRes.json();
  if (!creds.email || !creds.password) {
    throw new Error("Credenziali LinkedIn non configurate.");
  }

  var tab = await getLinkedInTab("https://www.linkedin.com/");
  // Make it active for login flow (user may need to solve CAPTCHA)
  try { await chrome.tabs.update(tab.id, { active: true }); } catch(_) {}

  try {

    var initialStateRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: inspectLinkedInPage,
    });
    var initialState = initialStateRes[0] && initialStateRes[0].result;

    if (initialState && initialState.authenticated) {
      var syncInitial = await syncLiCookieToServer();
      return {
        success: true,
        authenticated: true,
        cookieSynced: !!syncInitial.success,
        reason: "already_logged_in",
        currentUrl: initialState.url,
      };
    }

    var prepRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: prepareOfficialLinkedInLoginPage,
    });
    var prep = prepRes[0] && prepRes[0].result;
    if (!prep || !prep.success) {
      return {
        success: false,
        authenticated: false,
        reason: "login_prepare_failed",
        message: (prep && prep.error) || "Impossibile aprire la pagina ufficiale di login LinkedIn.",
      };
    }

    if (prep.state !== "form_ready" && prep.state !== "authenticated") {
      await waitForTabLoad(tab.id, 25000);
    }

    var readyStateRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: inspectLinkedInPage,
    });
    var readyState = readyStateRes[0] && readyStateRes[0].result;

    if (readyState && readyState.authenticated) {
      var syncReady = await syncLiCookieToServer();
      return {
        success: true,
        authenticated: true,
        cookieSynced: !!syncReady.success,
        reason: "already_logged_in",
        currentUrl: readyState.url,
      };
    }

    if (readyState && readyState.hasGoogleButton && !readyState.hasLoginForm) {
      var googleFlow = await pollForLinkedInAuthCompletion(tab.id, 180000, { sawGoogle: true });
      // Tab stays open
      return googleFlow;
    }

    if (!readyState || !readyState.hasLoginForm) {
      return {
        success: false,
        authenticated: false,
        reason: "login_form_not_found",
        message: "Non trovo il form di login nella pagina ufficiale di LinkedIn.",
        currentUrl: readyState && readyState.url,
      };
    }

    var injRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillLinkedInLogin,
      args: [creds.email, creds.password],
    });
    var formResult = injRes[0] && injRes[0].result;
    if (!formResult || !formResult.success) {
      return {
        success: false,
        authenticated: false,
        reason: "login_fill_failed",
        message: (formResult && formResult.error) || "Form di login non compilabile.",
      };
    }

    await waitForTabLoad(tab.id, 30000);

    var completion = await pollForLinkedInAuthCompletion(tab.id, 180000);
    // Tab stays open
    return completion;
  } catch (err) {
    return {
      success: false,
      authenticated: false,
      error: err.message,
      reason: "unexpected_error",
    };
  }
}

// ── Send a direct message on LinkedIn ──
function typeLinkedInMessage(messageText) {
  try {
    // Look for the message input in the messaging overlay or page
    var msgBox = document.querySelector("div.msg-form__contenteditable[contenteditable='true']")
      || document.querySelector("div[role='textbox'][contenteditable='true']");

    if (!msgBox) return { success: false, error: "Campo messaggio non trovato" };

    msgBox.focus();
    // Use execCommand for contenteditable divs
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, messageText);
    msgBox.dispatchEvent(new Event("input", { bubbles: true }));

    // Find and click send button
    var sendBtn = document.querySelector("button.msg-form__send-button")
      || document.querySelector("button[type='submit'].msg-form__send-btn")
      || document.querySelector("button.msg-form__send-toggle button")
      || Array.from(document.querySelectorAll("button")).find(function (b) {
          return /invia|send/i.test(b.textContent);
        });

    if (sendBtn) {
      sendBtn.click();
      return { success: true, method: "button" };
    }
    return { success: false, error: "Bottone invio non trovato. Messaggio inserito ma non inviato." };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function sendLinkedInMessage(profileUrl, message) {
  if (!profileUrl) return { success: false, error: "URL profilo mancante" };
  if (!message) return { success: false, error: "Messaggio mancante" };

  // Normalize to messaging URL
  var messagingUrl = profileUrl.replace(/\/$/, "");
  // If it's a profile URL, open the overlay messaging
  if (!/\/messaging\//.test(messagingUrl)) {
    // Open profile first to trigger the message button
    var tab = await getLinkedInTab(messagingUrl);
    try {

      // Click the "Message" button on the profile
      var clickRes = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          var msgBtn = document.querySelector("button.pvs-profile-actions__action[aria-label*='essag']")
            || Array.from(document.querySelectorAll("button, a")).find(function (el) {
              return /messag|scrivi/i.test(el.textContent) && el.offsetParent !== null;
            });
          if (msgBtn) { msgBtn.click(); return { success: true }; }
          return { success: false, error: "Bottone Messaggio non trovato nel profilo" };
        },
      });

      var clickResult = clickRes[0] && clickRes[0].result;
      if (!clickResult || !clickResult.success) {
        return { success: false, error: (clickResult && clickResult.error) || "Bottone messaggio non trovato" };
      }

      // Wait for messaging overlay to load
      await new Promise(function (r) { setTimeout(r, 3000); });

      // Type and send the message
      var typeRes = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: typeLinkedInMessage,
        args: [message],
      });
      var typeResult = typeRes[0] && typeRes[0].result;

      return typeResult || { success: false, error: "Nessun risultato" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

// ── Send connection request on LinkedIn ──
function clickConnectButton() {
  try {
    // Primary: the "Connect" / "Collegati" button in profile actions
    var connectBtn = document.querySelector("button.pvs-profile-actions__action[aria-label*='onnect']")
      || document.querySelector("button.pvs-profile-actions__action[aria-label*='olleg']")
      || Array.from(document.querySelectorAll("button")).find(function (el) {
        return /^(connect|collegati|connetti)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
      });

    if (connectBtn) { connectBtn.click(); return { success: true, method: "direct" }; }

    // Sometimes Connect is hidden in "More" dropdown
    var moreBtn = document.querySelector("button.pvs-profile-actions__action[aria-label*='ore']")
      || Array.from(document.querySelectorAll("button")).find(function (el) {
        return /^(more|altro|più)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
      });

    if (moreBtn) {
      moreBtn.click();
      // Wait a bit for dropdown
      return new Promise(function (resolve) {
        setTimeout(function () {
          var dropdownConnect = Array.from(document.querySelectorAll("div[role='option'], li, span")).find(function (el) {
            return /connect|collegati|connetti/i.test(el.textContent.trim()) && el.offsetParent !== null;
          });
          if (dropdownConnect) {
            dropdownConnect.click();
            resolve({ success: true, method: "more_dropdown" });
          } else {
            resolve({ success: false, error: "Bottone Collegati non trovato nel menu" });
          }
        }, 1000);
      });
    }

    return { success: false, error: "Bottone Collegati/Connect non trovato" };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function addConnectionNote(noteText) {
  try {
    // Click "Add a note" button in the connection modal
    var addNoteBtn = Array.from(document.querySelectorAll("button")).find(function (el) {
      return /add a note|aggiungi nota|aggiungi un messaggio/i.test(el.textContent.trim());
    });
    if (!addNoteBtn) return { success: false, error: "Bottone 'Aggiungi nota' non trovato" };
    addNoteBtn.click();

    // Wait for textarea to appear
    return new Promise(function (resolve) {
      setTimeout(function () {
        var textarea = document.querySelector("textarea[name='message']")
          || document.querySelector("textarea#custom-message")
          || document.querySelector(".send-invite__custom-message textarea")
          || document.querySelector("textarea");

        if (!textarea) { resolve({ success: false, error: "Textarea nota non trovata" }); return; }

        var nativeSet = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        textarea.focus();
        nativeSet.call(textarea, noteText);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.dispatchEvent(new Event("change", { bubbles: true }));

        // Click send
        setTimeout(function () {
          var sendBtn = Array.from(document.querySelectorAll("button")).find(function (el) {
            return /^(send|invia)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
          });
          if (sendBtn) {
            sendBtn.click();
            resolve({ success: true });
          } else {
            resolve({ success: false, error: "Bottone Invia non trovato" });
          }
        }, 500);
      }, 1000);
    });
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function sendConnectionRequest(profileUrl, note) {
  if (!profileUrl) return { success: false, error: "URL profilo mancante" };

  var tab = await getLinkedInTab(profileUrl.replace(/\/$/, ""));
  try {

    // Click Connect button
    var clickRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: clickConnectButton,
    });
    var clickResult = clickRes[0] && clickRes[0].result;

    if (!clickResult || !clickResult.success) {
      return { success: false, error: (clickResult && clickResult.error) || "Bottone Connect non trovato" };
    }

    // Wait for modal to appear
    await new Promise(function (r) { setTimeout(r, 2000); });

    if (note && note.trim()) {
      // Add a personalized note
      var noteRes = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: addConnectionNote,
        args: [note],
      });
      var noteResult = noteRes[0] && noteRes[0].result;
      return {
        success: !!(noteResult && noteResult.success),
        method: "connect_with_note",
        noteAdded: !!(noteResult && noteResult.success),
        error: noteResult && noteResult.error,
      };
    } else {
      // Send without note — click "Send without a note" or the direct send
      var sendRes = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          var sendBtn = Array.from(document.querySelectorAll("button")).find(function (el) {
            return /send without|invia senza|send now/i.test(el.textContent.trim());
          }) || Array.from(document.querySelectorAll("button")).find(function (el) {
            return /^(send|invia)$/i.test(el.textContent.trim()) && el.offsetParent !== null;
          });
          if (sendBtn) { sendBtn.click(); return { success: true }; }
          return { success: false, error: "Bottone invio non trovato" };
        },
      });
      var sendResult = sendRes[0] && sendRes[0].result;
      return {
        success: !!(sendResult && sendResult.success),
        method: "connect_without_note",
        error: sendResult && sendResult.error,
      };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Extract profile by URL ──
async function extractProfileByUrl(url) {
  if (!url) return { success: false, error: "URL mancante" };

  var tab = await getLinkedInTab(url);
  try {

    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractLinkedInProfile,
    });
    var profileData = results[0] && results[0].result;
    return { success: true, profile: profileData || {} };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Search LinkedIn profile by name/company ──
async function searchLinkedInProfile(query) {
  if (!query) return { success: false, error: "Query mancante" };

  // Build a LinkedIn people search URL
  var searchUrl = "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(query);
  var tab = await getLinkedInTab(searchUrl);
  try {

    // Extract the first result from search
    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () {
        try {
          // Find the first person result link (multiple selectors for resilience)
          var resultLinks = document.querySelectorAll(
            "a.app-aware-link[href*='/in/'], " +
            "a[href*='linkedin.com/in/'], " +
            "span.entity-result__title-text a[href*='/in/'], " +
            ".reusable-search__result-container a[href*='/in/']"
          );
          for (var i = 0; i < resultLinks.length; i++) {
            var href = resultLinks[i].href;
            // Filter out non-profile links
            if (/linkedin\.com\/in\/[^/]+/.test(href) && !/\/in\/miniprofile/.test(href) && !/\/in\/ACo/.test(href)) {
              var nameEl = resultLinks[i].querySelector("span[aria-hidden='true']")
                || resultLinks[i].querySelector("span.entity-result__title-text span")
                || resultLinks[i].closest(".entity-result__item, li")?.querySelector("span[dir='ltr']");
              var name = nameEl ? nameEl.textContent.trim() : "";
              // Extract headline from sibling
              var container = resultLinks[i].closest(".entity-result__item, li.reusable-search__result-container, li[class*='result'], div[data-chameleon-result-urn]");
              var headlineEl = container ? (container.querySelector(".entity-result__primary-subtitle, .entity-result__summary, .t-14.t-black--light, .entity-result__content .t-14") || null) : null;
              var headline = headlineEl ? headlineEl.textContent.trim() : "";
              // Clean URL (remove query params)
              var cleanUrl = href.split("?")[0].replace(/\/$/, "");
              return { profileUrl: cleanUrl, name: name, headline: headline };
            }
          }

          // Fallback: try any link with /in/ pattern
          var allLinks = document.querySelectorAll("a[href*='/in/']");
          for (var j = 0; j < allLinks.length; j++) {
            var h = allLinks[j].href;
            if (/linkedin\.com\/in\/[^/]+/.test(h) && !/\/in\/miniprofile/.test(h)) {
              var cleanH = h.split("?")[0].replace(/\/$/, "");
              return { profileUrl: cleanH, name: "", headline: "" };
            }
          }

          return null;
        } catch (e) {
          return null;
        }
      },
    });

    var profileData = results[0] && results[0].result;
    if (profileData && profileData.profileUrl) {
      return { success: true, profile: profileData };
    }
    return { success: false, error: "Nessun profilo trovato per: " + query };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Tab operation queue to prevent race conditions ──
var _tabQueue = Promise.resolve();
function enqueueTabOp(fn) {
  _tabQueue = _tabQueue.then(fn, fn);
  return _tabQueue;
}

// ── Message handler ──
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  var source = message && message.source;
  if (source !== "li-content-bridge" && source !== "li-popup") return false;

  if (message.action === "ping") {
    sendResponse({ success: true, version: "1.0" });
    return false;
  }

  if (message.action === "verifySession") {
    enqueueTabOp(async function () {
      try {
        var result = await verifyLinkedInSession();
        sendResponse({ success: true, authenticated: result.authenticated, reason: result.reason });
      } catch (err) { sendResponse({ success: false, authenticated: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "syncCookie") {
    enqueueTabOp(async function () {
      try { var result = await syncLiCookieToServer(); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "autoLogin") {
    enqueueTabOp(async function () {
      try { var result = await autoLoginLinkedIn(); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "extractProfile") {
    enqueueTabOp(async function () {
      try { var result = await extractProfileByUrl(message.url); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "sendMessage") {
    enqueueTabOp(async function () {
      try { var result = await sendLinkedInMessage(message.url, message.message); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "sendConnectionRequest") {
    enqueueTabOp(async function () {
      try { var result = await sendConnectionRequest(message.url, message.note); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "searchProfile") {
    enqueueTabOp(async function () {
      try { var result = await searchLinkedInProfile(message.query); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "readLinkedInInbox") {
    enqueueTabOp(async function () {
      try { var result = await readLinkedInInbox(); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "readLinkedInThread") {
    enqueueTabOp(async function () {
      try { var result = await readLinkedInThread(message.threadUrl); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  if (message.action === "diagnosticLinkedInDom") {
    enqueueTabOp(async function () {
      try { var result = await diagnosticLinkedInDom(); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  return false;
});

// ── Diagnostic: inspect LinkedIn messaging DOM ──
async function diagnosticLinkedInDom() {
  var tab = await getLinkedInTab("https://www.linkedin.com/messaging/", false);
  await new Promise(function (r) { setTimeout(r, 5000); });

  var results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: function () {
      try {
        var url = window.location.href;
        var title = document.title;
        var bodyLen = (document.body.innerText || "").length;

        // Check various possible conversation list selectors
        var selectors = [
          "li.msg-conversation-listitem",
          ".msg-conversations-container__convo-item-link",
          "[data-control-name='overlay.connection_list_item']",
          ".msg-convo-wrapper",
          ".msg-thread",
          "li[class*='msg-conversation']",
          "li[class*='conversation']",
          "[class*='messaging-list']",
          "[class*='msg-overlay-list']",
          "a[href*='/messaging/thread/']",
          ".scaffold-layout__list li",
          ".msg-conversations-container li",
          "[data-finite-scroll-hotkey-item]",
        ];

        var found = {};
        selectors.forEach(function (s) {
          try { found[s] = document.querySelectorAll(s).length; } catch (e) { found[s] = -1; }
        });

        // Get first 500 chars of body for context
        var bodySnippet = (document.body.innerText || "").substring(0, 500);

        // Get all class names from li elements
        var liClasses = [];
        var allLi = document.querySelectorAll("li");
        for (var i = 0; i < Math.min(allLi.length, 30); i++) {
          if (allLi[i].className) liClasses.push(allLi[i].className.substring(0, 100));
        }

        // Get all links containing /messaging/
        var msgLinks = [];
        var allLinks = document.querySelectorAll("a[href*='/messaging/']");
        for (var j = 0; j < Math.min(allLinks.length, 10); j++) {
          msgLinks.push(allLinks[j].href);
        }

        return {
          success: true,
          url: url,
          title: title,
          bodyLength: bodyLen,
          selectorResults: found,
          liClasses: liClasses,
          messagingLinks: msgLinks,
          bodySnippet: bodySnippet,
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
  });

  return (results[0] && results[0].result) || { success: false, error: "Nessun risultato" };
}

// ── Read LinkedIn Messaging Inbox ──
async function readLinkedInInbox() {
  var tab = await getLinkedInTab("https://www.linkedin.com/messaging/", false);
  await new Promise(function (r) { setTimeout(r, 5000); });

  var results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: function () {
      try {
        var threads = [];

        // Strategy 1: Find all links to /messaging/thread/
        var threadLinks = document.querySelectorAll("a[href*='/messaging/thread/']");
        var seen = {};

        threadLinks.forEach(function (link) {
          try {
            var threadUrl = link.href || "";
            if (seen[threadUrl]) return;
            seen[threadUrl] = true;

            // Walk up to find the list item container
            var container = link.closest("li") || link.parentElement;
            if (!container) return;

            // Try multiple name selectors
            var nameEl = container.querySelector(
              "h3, [class*='participant-name'], [class*='conversation-name'], " +
              "[class*='msg-conversation-listitem__participant'], span.truncate"
            );
            // Fallback: first heading-like element
            if (!nameEl) {
              var headings = container.querySelectorAll("span, h3, h4");
              for (var i = 0; i < headings.length; i++) {
                var t = (headings[i].textContent || "").trim();
                if (t.length > 1 && t.length < 60 && !/^\d/.test(t)) { nameEl = headings[i]; break; }
              }
            }

            // Try multiple preview selectors
            var previewEl = container.querySelector(
              "p, [class*='message-snippet'], [class*='snippet'], [class*='preview']"
            );

            var unreadEl = container.querySelector(
              "[class*='unread'], [class*='notification-badge'], .notification-badge"
            );

            var name = nameEl ? nameEl.textContent.trim() : "";
            var lastMessage = previewEl ? previewEl.textContent.trim() : "";
            var unread = !!unreadEl;

            if (name) {
              threads.push({ name: name, lastMessage: lastMessage, unread: unread, threadUrl: threadUrl });
            }
          } catch (e) {}
        });

        // Strategy 2: If no links found, try list items with class patterns
        if (threads.length === 0) {
          var items = document.querySelectorAll(
            "li[class*='msg-conversation'], li[class*='conversation'], " +
            "[data-finite-scroll-hotkey-item], .scaffold-layout__list li"
          );
          items.forEach(function (item) {
            try {
              var link = item.querySelector("a[href*='/messaging/']") || item.querySelector("a");
              var nameEl = item.querySelector("h3, span[class*='name'], [class*='participant']");
              var previewEl = item.querySelector("p, [class*='snippet']");

              var name = nameEl ? nameEl.textContent.trim() : "";
              var threadUrl = link ? link.href : "";
              var lastMessage = previewEl ? previewEl.textContent.trim() : "";

              if (name && threadUrl) {
                threads.push({ name: name, lastMessage: lastMessage, unread: false, threadUrl: threadUrl });
              }
            } catch (e) {}
          });
        }

        return { success: true, threads: threads, strategy: threads.length > 0 ? "found" : "empty" };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
  });

  return (results[0] && results[0].result) || { success: false, error: "Nessun risultato" };
}

// ── Read a specific LinkedIn thread ──
async function readLinkedInThread(threadUrl) {
  if (!threadUrl) return { success: false, error: "Thread URL mancante" };

  var tab = await getLinkedInTab(threadUrl, false);
  await new Promise(function (r) { setTimeout(r, 6000); });

  var results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: function () {
      try {
        var messages = [];

        // Strategy 1: Standard message events
        var msgItems = document.querySelectorAll(
          ".msg-s-message-list__event, [class*='msg-s-event'], " +
          "[class*='message-list-item'], [data-control-name='message_event']"
        );

        // Strategy 2: If nothing, try broader selectors
        if (!msgItems || msgItems.length === 0) {
          msgItems = document.querySelectorAll(
            ".msg-s-message-group, [class*='msg-event'], " +
            "[class*='message-event'], li[class*='msg-']"
          );
        }

        // Detect current user name for direction
        var myName = "";
        var mePhoto = document.querySelector("img.global-nav__me-photo, img[class*='global-nav__me']");
        if (mePhoto) myName = mePhoto.getAttribute("alt") || "";
        if (!myName) {
          var meLink = document.querySelector(".feed-identity-module__actor-meta a, [class*='global-nav__me'] span");
          if (meLink) myName = meLink.textContent.trim();
        }

        msgItems.forEach(function (item) {
          try {
            // Sender name
            var senderEl = item.querySelector(
              "[class*='message-group__name'], [class*='event-listitem__name'], " +
              "[class*='sender'], h3, span[class*='name']"
            );

            // Message body
            var bodyEl = item.querySelector(
              "[class*='event-listitem__body'], [class*='event__content'] p, " +
              "[class*='message-body'], p"
            );

            // Timestamp
            var timeEl = item.querySelector("time, [class*='timestamp'], [class*='time']");

            var sender = senderEl ? senderEl.textContent.trim() : "";
            var text = bodyEl ? bodyEl.textContent.trim() : "";
            var timestamp = timeEl ? (timeEl.getAttribute("datetime") || timeEl.textContent.trim()) : new Date().toISOString();

            var direction = "inbound";
            if (sender && myName) {
              var myFirst = myName.toLowerCase().split(" ")[0];
              if (myFirst && sender.toLowerCase().includes(myFirst)) direction = "outbound";
            }

            if (text) {
              messages.push({ text: text, sender: sender, timestamp: timestamp, direction: direction });
            }
          } catch (e) {}
        });

        return { success: true, messages: messages, count: messages.length };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
  });

  return (results[0] && results[0].result) || { success: false, error: "Nessun risultato" };
}

// ── On install: sync cookie if already logged in ──
chrome.runtime.onInstalled.addListener(async function () {
  console.log("[LinkedIn Extension] Installed");
  await syncLiCookieToServer();
});
