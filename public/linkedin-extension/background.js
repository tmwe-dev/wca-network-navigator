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

// Get or create a single persistent LinkedIn tab, navigate it to `url`
async function getLinkedInTab(url) {
  // Check if existing tab is still alive
  if (_liTabId !== null) {
    try {
      var existing = await chrome.tabs.get(_liTabId);
      if (existing) {
        // Navigate existing tab to new URL
        await chrome.tabs.update(_liTabId, { url: url });
        await waitForTabLoad(_liTabId, 20000);
        return { id: _liTabId };
      }
    } catch (_) {
      _liTabId = null; // tab was closed by user
    }
  }
  // Create new persistent tab
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
    // Check for feed elements that only appear when logged in
    var feedPresent = !!document.querySelector(".feed-shared-update-v2, .scaffold-layout, .global-nav__me");
    var loginPage = !!document.querySelector("#username, .login__form");
    var bodyText = document.body.innerText || "";
    var hasSignIn = /Sign in|Accedi|Log in/i.test(document.title);

    return {
      authenticated: feedPresent && !loginPage && !hasSignIn,
      reason: feedPresent ? "feed_present" : loginPage ? "login_page" : hasSignIn ? "sign_in_title" : "unknown",
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


// ── Verify LinkedIn session ──
async function verifyLinkedInSession() {
  var tab = await getLinkedInTab("https://www.linkedin.com/feed/");
  try {
    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: checkLinkedInSession,
    });
    var sessionResult = results[0] && results[0].result;
    if (sessionResult && sessionResult.authenticated) {
      await syncLiCookieToServer();
    }
    return sessionResult || { authenticated: false, reason: "no_result" };
  } catch (err) {
    return { authenticated: false, reason: "error: " + err.message };
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
      safeTabRemove(tab.id)
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
      safeTabRemove(tab.id)
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
      safeTabRemove(tab.id)
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
      if (googleFlow.success || !googleFlow.tabStillOpen) {
        safeTabRemove(tab.id)
      }
      return googleFlow;
    }

    if (!readyState || !readyState.hasLoginForm) {
      safeTabRemove(tab.id)
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
      safeTabRemove(tab.id)
      return {
        success: false,
        authenticated: false,
        reason: "login_fill_failed",
        message: (formResult && formResult.error) || "Form di login non compilabile.",
      };
    }

    await waitForTabLoad(tab.id, 30000);

    var completion = await pollForLinkedInAuthCompletion(tab.id, 180000);
    if (completion.success || !completion.tabStillOpen) {
      safeTabRemove(tab.id)
    }
    return completion;
  } catch (err) {
    safeTabRemove(tab.id)
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
    var tab = await safeTabCreate({ url: messagingUrl, active: false });
    try {
      await waitForTabLoad(tab.id, 20000);

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
        safeTabRemove(tab.id)
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

      safeTabRemove(tab.id)
      return typeResult || { success: false, error: "Nessun risultato" };
    } catch (err) {
      safeTabRemove(tab.id)
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

  var tab = await safeTabCreate({ url: profileUrl.replace(/\/$/, ""), active: false });
  try {
    await waitForTabLoad(tab.id, 20000);

    // Click Connect button
    var clickRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: clickConnectButton,
    });
    var clickResult = clickRes[0] && clickRes[0].result;

    if (!clickResult || !clickResult.success) {
      safeTabRemove(tab.id)
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
      safeTabRemove(tab.id)
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
      safeTabRemove(tab.id)
      return {
        success: !!(sendResult && sendResult.success),
        method: "connect_without_note",
        error: sendResult && sendResult.error,
      };
    }
  } catch (err) {
    safeTabRemove(tab.id)
    return { success: false, error: err.message };
  }
}

// ── Extract profile by URL ──
async function extractProfileByUrl(url) {
  if (!url) return { success: false, error: "URL mancante" };

  var tab = await safeTabCreate({ url: url, active: false });
  try {
    await waitForTabLoad(tab.id, 20000);

    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractLinkedInProfile,
    });
    var profileData = results[0] && results[0].result;
    return { success: true, profile: profileData || {} };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    safeTabRemove(tab.id)
  }
}

// ── Search LinkedIn profile by name/company ──
async function searchLinkedInProfile(query) {
  if (!query) return { success: false, error: "Query mancante" };

  // Build a LinkedIn people search URL
  var searchUrl = "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(query);
  var tab = await safeTabCreate({ url: searchUrl, active: false });
  try {
    await waitForTabLoad(tab.id, 20000);

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
  } finally {
    safeTabRemove(tab.id)
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

  return false;
});

// ── On install: sync cookie if already logged in ──
chrome.runtime.onInstalled.addListener(async function () {
  console.log("[LinkedIn Extension] Installed");
  await syncLiCookieToServer();
});
