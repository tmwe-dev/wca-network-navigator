// ══════════════════════════════════════════════════
// LinkedIn Extension — Auth & Session Module
// Cookie management, session verification, auto-login
// Uses native input API instead of execCommand
// ══════════════════════════════════════════════════

var Auth = (function () {

  // ── Cookie ──
  async function getLiAtCookie() {
    try {
      var cookie = await chrome.cookies.get({ url: "https://www.linkedin.com/", name: "li_at" });
      return cookie ? cookie.value : null;
    } catch (_) {
      return null;
    }
  }

  async function syncCookieToServer() {
    try {
      var liAt = await getLiAtCookie();
      if (!liAt) return Config.errorResponse(Config.ERROR.NO_COOKIE, "Cookie li_at non trovato");

      var url = Config.getUrl();
      var key = Config.getKey();
      if (!url || !key) return Config.errorResponse(Config.ERROR.NO_CONFIG, "Configurazione Supabase mancante");

      var res = await fetch(url + "/functions/v1/save-linkedin-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": key, "Authorization": "Bearer " + key },
        body: JSON.stringify({ cookie: liAt }),
      });
      var data = await res.json();
      return Config.successResponse({ cookieLength: liAt.length, saved: data.success });
    } catch (err) {
      return Config.errorResponse(Config.ERROR.UNKNOWN, err.message);
    }
  }

  // ── Session verification (URL + minimal DOM) ──
  async function verifySession() {
    var liAt = await getLiAtCookie();
    if (!liAt) return { authenticated: false, reason: "no_cookie" };

    var tab = await TabManager.getLinkedInTab("https://www.linkedin.com/feed/", true);
    try {
      var results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          var url = window.location.href || "";
          var title = document.title || "";
          var onLoggedPage = /linkedin\.com\/(feed|messaging|in\/|search\/results|mynetwork|jobs)/i.test(url);
          var loginPage = /\/login|\/checkpoint|uas\/login/i.test(url);
          var hasSignIn = /Sign in|Accedi|Log in/i.test(title);
          var hasMainContent = !!document.querySelector("main, [role='main']");
          var authenticated = (onLoggedPage || hasMainContent) && !loginPage && !hasSignIn;
          return {
            authenticated: authenticated,
            reason: authenticated ? "session_active" : loginPage ? "login_page" : hasSignIn ? "sign_in_title" : "unknown",
          };
        },
      });
      var sessionResult = results[0] && results[0].result;
      if (sessionResult && sessionResult.authenticated) {
        syncCookieToServer().catch(function () {});
      }
      return sessionResult || { authenticated: false, reason: "no_result" };
    } catch (_) {
      return { authenticated: true, reason: "cookie_present_script_error", cookieLength: liAt.length };
    }
  }

  // ── Page inspection (stable login form IDs) ──
  function inspectPage() {
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

  function prepareLoginPage() {
    try {
      var state = Auth.inspectPage();
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

  // ── Native input fill (replaces execCommand) ──
  function fillLoginForm(email, password) {
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

      // Use native setter + synthetic events (no execCommand)
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

  // ── Polling for auth completion ──
  async function pollForAuthCompletion(tabId, timeoutMs, options) {
    timeoutMs = timeoutMs || 180000;
    options = options || {};
    var sawGoogle = !!options.sawGoogle;
    var sawChallenge = !!options.sawChallenge;
    var lastUrl = "";
    var startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      await new Promise(function (r) { setTimeout(r, 2000); });
      var tab;
      try { tab = await chrome.tabs.get(tabId); } catch (_) {
        return Config.errorResponse(Config.ERROR.TAB_CLOSED, "Tab chiuso durante il login");
      }
      lastUrl = tab && tab.url ? tab.url : lastUrl;
      if (/accounts\.google\.com/i.test(lastUrl)) sawGoogle = true;
      if (/checkpoint|challenge|security-verification|two-step|verify|captcha/i.test(lastUrl)) sawChallenge = true;

      var liAt = await getLiAtCookie();
      if (liAt) {
        var syncResult = await syncCookieToServer();
        return Config.successResponse({
          authenticated: true,
          cookieSynced: !!syncResult.success,
          reason: sawGoogle ? "google_auth_completed" : sawChallenge ? "challenge_resolved" : "login_success",
          currentUrl: lastUrl,
        });
      }

      if (/linkedin\.com/i.test(lastUrl)) {
        try {
          var stateRes = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: inspectPage });
          var state = stateRes[0] && stateRes[0].result;
          if (state && state.authenticated) {
            var syncAuth = await syncCookieToServer();
            return Config.successResponse({
              authenticated: true,
              cookieSynced: !!syncAuth.success,
              reason: "login_success",
              currentUrl: state.url || lastUrl,
            });
          }
          if (state && state.isChallenge) sawChallenge = true;
        } catch (_) {}
      }
    }

    return Config.errorResponse(
      Config.ERROR.TIMEOUT,
      sawChallenge ? "Timeout verifica manuale" : "Timeout login"
    );
  }

  // ── Auto login flow ──
  async function autoLogin() {
    var existingCookie = await getLiAtCookie();
    if (existingCookie) {
      var sessionCheck = await verifySession();
      if (sessionCheck.authenticated) {
        var syncAlready = await syncCookieToServer();
        return Config.successResponse({ authenticated: true, reason: "already_logged_in", cookieSynced: !!syncAlready.success });
      }
    }

    if (!Config.isReady()) return Config.errorResponse(Config.ERROR.NO_CONFIG, "Configurazione non impostata");

    var credRes = await fetch(Config.getUrl() + "/functions/v1/get-linkedin-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": Config.getKey(), "Authorization": "Bearer " + Config.getKey() },
      body: JSON.stringify({}),
    });
    var creds = await credRes.json();
    if (!creds.email || !creds.password) return Config.errorResponse(Config.ERROR.LOGIN_FAILED, "Credenziali LinkedIn non configurate");

    var tab = await TabManager.getLinkedInTab("https://www.linkedin.com/");
    try { await chrome.tabs.update(tab.id, { active: true }); } catch (_) {}

    try {
      var initialStateRes = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: inspectPage });
      var initialState = initialStateRes[0] && initialStateRes[0].result;
      if (initialState && initialState.authenticated) {
        var syncInitial = await syncCookieToServer();
        return Config.successResponse({ authenticated: true, cookieSynced: !!syncInitial.success, reason: "already_logged_in" });
      }

      var prepRes = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: prepareLoginPage });
      var prep = prepRes[0] && prepRes[0].result;
      if (!prep || !prep.success) return Config.errorResponse(Config.ERROR.LOGIN_FAILED, "Preparazione login fallita");
      if (prep.state !== "form_ready" && prep.state !== "authenticated") await TabManager.waitForLoad(tab.id, 25000);

      var readyStateRes = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: inspectPage });
      var readyState = readyStateRes[0] && readyStateRes[0].result;
      if (readyState && readyState.authenticated) {
        var syncReady = await syncCookieToServer();
        return Config.successResponse({ authenticated: true, cookieSynced: !!syncReady.success, reason: "already_logged_in" });
      }
      if (readyState && readyState.hasGoogleButton && !readyState.hasLoginForm) {
        return await pollForAuthCompletion(tab.id, 180000, { sawGoogle: true });
      }
      if (!readyState || !readyState.hasLoginForm) return Config.errorResponse(Config.ERROR.LOGIN_FAILED, "Form di login non trovato");

      var injRes = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fillLoginForm, args: [creds.email, creds.password] });
      var formResult = injRes[0] && injRes[0].result;
      if (!formResult || !formResult.success) return Config.errorResponse(Config.ERROR.LOGIN_FAILED, formResult && formResult.error || "Fill fallito");

      await TabManager.waitForLoad(tab.id, 30000);
      return await pollForAuthCompletion(tab.id, 180000);
    } catch (err) {
      return Config.errorResponse(Config.ERROR.LOGIN_FAILED, err.message);
    }
  }

  return {
    getLiAtCookie: getLiAtCookie,
    syncCookieToServer: syncCookieToServer,
    verifySession: verifySession,
    inspectPage: inspectPage,
    fillLoginForm: fillLoginForm,
    autoLogin: autoLogin,
  };
})();
