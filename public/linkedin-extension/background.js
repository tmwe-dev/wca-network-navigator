// ══════════════════════════════════════════════════
// LinkedIn Cookie Sync - Background Service Worker
// Handles auto-login, cookie sync, session verification, profile extraction
// ══════════════════════════════════════════════════

var SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

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
  var tab = await chrome.tabs.create({ url: "https://www.linkedin.com/feed/", active: false });
  try {
    await waitForTabLoad(tab.id, 20000);
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
  } finally {
    try { chrome.tabs.remove(tab.id); } catch (e) {}
  }
}

// ── Auto-login to LinkedIn ──
function fillLinkedInLogin(email, password) {
  try {
    var userInput = document.querySelector("#username") || document.querySelector("input[name='session_key']");
    var passInput = document.querySelector("#password") || document.querySelector("input[name='session_password']");

    if (!userInput || !passInput) {
      return { success: false, error: "Campi login non trovati. User:" + !!userInput + " Pass:" + !!passInput };
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

    var submitBtn = document.querySelector("button[type='submit']")
      || document.querySelector(".login__form_action_container button")
      || document.querySelector("button.btn__primary--large");

    if (submitBtn) { submitBtn.click(); return { success: true, method: "button" }; }

    var form = userInput.closest("form");
    if (form) { form.submit(); return { success: true, method: "form" }; }

    return { success: false, error: "Nessun submit trovato" };
  } catch (e) { return { success: false, error: e.message }; }
}

async function autoLoginLinkedIn() {
  // 1. Get credentials from server
  var credRes = await fetch(SUPABASE_URL + "/functions/v1/get-linkedin-credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY },
    body: JSON.stringify({}),
  });
  var creds = await credRes.json();
  if (!creds.email || !creds.password) throw new Error("Credenziali LinkedIn non configurate.");

  // 2. Open login page
  var tab = await chrome.tabs.create({ url: "https://www.linkedin.com/login", active: false });
  await waitForTabLoad(tab.id, 20000);

  // 3. Fill and submit login form
  var injRes = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fillLinkedInLogin,
    args: [creds.email, creds.password],
  });
  var formResult = injRes[0] && injRes[0].result;
  if (!formResult || !formResult.success) {
    try { chrome.tabs.remove(tab.id); } catch (e) {}
    throw new Error((formResult && formResult.error) || "Form non trovato");
  }

  // 4. Wait for redirect
  await waitForTabLoad(tab.id, 15000);

  // 5. Check session
  var sessionRes = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: checkLinkedInSession,
  });
  var session = sessionRes[0] && sessionRes[0].result;

  // 6. Sync cookie
  var syncResult = await syncLiCookieToServer();

  try { chrome.tabs.remove(tab.id); } catch (e) {}

  return {
    success: !!(session && session.authenticated),
    authenticated: session ? session.authenticated : false,
    cookieSynced: syncResult.success,
    reason: session ? session.reason : "unknown",
  };
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
    var tab = await chrome.tabs.create({ url: messagingUrl, active: false });
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
        try { chrome.tabs.remove(tab.id); } catch (e) {}
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

      try { chrome.tabs.remove(tab.id); } catch (e) {}
      return typeResult || { success: false, error: "Nessun risultato" };
    } catch (err) {
      try { chrome.tabs.remove(tab.id); } catch (e) {}
      return { success: false, error: err.message };
    }
  }
}

// ── Extract profile by URL ──
async function extractProfileByUrl(url) {
  if (!url) return { success: false, error: "URL mancante" };

  var tab = await chrome.tabs.create({ url: url, active: false });
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
    try { chrome.tabs.remove(tab.id); } catch (e) {}
  }
}

// ── Message handler ──
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.source !== "li-content-bridge") return false;

  if (message.action === "ping") {
    sendResponse({ success: true, version: "1.0" });
    return false;
  }

  if (message.action === "verifySession") {
    (async function () {
      try {
        var result = await verifyLinkedInSession();
        sendResponse({ success: true, authenticated: result.authenticated, reason: result.reason });
      } catch (err) { sendResponse({ success: false, authenticated: false, error: err.message }); }
    })();
    return true;
  }

  if (message.action === "syncCookie") {
    (async function () {
      try { var result = await syncLiCookieToServer(); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    })();
    return true;
  }

  if (message.action === "autoLogin") {
    (async function () {
      try { var result = await autoLoginLinkedIn(); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    })();
    return true;
  }

  if (message.action === "extractProfile") {
    (async function () {
      try { var result = await extractProfileByUrl(message.url); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    })();
    return true;
  }

  if (message.action === "sendMessage") {
    (async function () {
      try { var result = await sendLinkedInMessage(message.url, message.message); sendResponse(result); }
      catch (err) { sendResponse({ success: false, error: err.message }); }
    })();
    return true;
  }

  return false;
});

// ── On install: sync cookie if already logged in ──
chrome.runtime.onInstalled.addListener(async function () {
  console.log("[LinkedIn Extension] Installed");
  await syncLiCookieToServer();
});
