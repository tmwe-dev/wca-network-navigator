var SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

var statusEl = document.getElementById("status");
var logEl = document.getElementById("log");
var mainBtn = document.getElementById("mainBtn");

function setStatus(text, cls) {
  statusEl.className = "status " + cls;
  statusEl.textContent = text;
}

function log(text, cls) {
  cls = cls || "";
  var line = document.createElement("div");
  line.className = cls;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

// ── Get ALL wcaworld cookies ──
async function getAllWcaCookies() {
  var byUrl = await chrome.cookies.getAll({ url: "https://www.wcaworld.com/" });
  var byDomain1 = await chrome.cookies.getAll({ domain: ".wcaworld.com" });
  var byDomain2 = await chrome.cookies.getAll({ domain: "www.wcaworld.com" });
  var byDomain3 = await chrome.cookies.getAll({ domain: "wcaworld.com" });

  var aspxAuth = null;
  try {
    aspxAuth = await chrome.cookies.get({ url: "https://www.wcaworld.com/", name: ".ASPXAUTH" });
  } catch (e) { /* ignore */ }

  var map = new Map();
  [byUrl, byDomain1, byDomain2, byDomain3].forEach(function (list) {
    list.forEach(function (c) {
      map.set(c.domain + "|" + c.name + "|" + c.path, c);
    });
  });
  if (aspxAuth) map.set("aspxauth-direct", aspxAuth);

  return Array.from(map.values());
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
        setTimeout(resolve, 1500);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function waitForRedirectOrTimeout(tabId, ms) {
  ms = ms || 10000;
  return new Promise(function (resolve) {
    var timeout = setTimeout(function () {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, ms);
    var navigated = false;
    function listener(id, info) {
      if (id === tabId && info.status === "complete" && !navigated) {
        navigated = true;
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 2000);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ── Send cookies to server ──
async function sendCookiesAndFinish(cookieStr, tabId) {
  log("⑨ Invio cookie al server...", "wait");
  setStatus("⏳ Verifica finale...", "working");
  try {
    var saveRes = await fetch(SUPABASE_URL + "/functions/v1/save-wca-cookie", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ cookie: cookieStr }),
    });
    var saveData = await saveRes.json();
    if (tabId) { try { chrome.tabs.remove(tabId); } catch (e) { /* ignore */ } }

    if (saveData.hasAspxAuth || saveData.authenticated) {
      setStatus("✅ Connesso! Tutto OK.", "ok");
      log("✓ Cookie salvato e sessione attiva!", "done");
    } else {
      setStatus("❌ Connessione fallita", "error");
      log("Cookie senza autenticazione.", "fail");
    }
  } catch (err) {
    setStatus("❌ Errore invio: " + err.message, "error");
    log("Errore: " + err.message, "fail");
  }
  mainBtn.disabled = false;
}

// ── Injected functions for login ──
function analyzeLoginPage() {
  try {
    var forms = document.querySelectorAll("form");
    var allInputs = document.querySelectorAll("input");
    var inputDetails = Array.from(allInputs)
      .filter(function (i) { return i.type !== "hidden"; })
      .map(function (i) { return (i.name || i.id || "?") + "(" + i.type + ")"; })
      .join(", ");
    return { url: window.location.href, formCount: forms.length, inputDetails: inputDetails, pageTitle: document.title };
  } catch (e) { return { error: e.message }; }
}

function fillAndSubmitLogin(username, password) {
  try {
    var userInput = document.querySelector("#UserName")
      || document.querySelector("input[name='UserName']")
      || document.querySelector("input[name='usr']")
      || document.querySelector("input[type='text']")
      || document.querySelector("input[type='email']");

    var passInput = document.querySelector("#Password")
      || document.querySelector("input[name='Password']")
      || document.querySelector("input[name='pwd']")
      || document.querySelector("input[type='password']");

    if (!userInput || !passInput) {
      return { success: false, error: "Campi non trovati. User:" + !!userInput + " Pass:" + !!passInput };
    }

    var nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    userInput.focus();
    nativeSet.call(userInput, username);
    userInput.dispatchEvent(new Event("input", { bubbles: true }));
    userInput.dispatchEvent(new Event("change", { bubbles: true }));

    passInput.focus();
    nativeSet.call(passInput, password);
    passInput.dispatchEvent(new Event("input", { bubbles: true }));
    passInput.dispatchEvent(new Event("change", { bubbles: true }));

    var submitBtn = document.querySelector("input[type='submit']")
      || document.querySelector("button[type='submit']")
      || document.querySelector(".btn-login")
      || document.querySelector("button.btn-primary");
    var form = userInput.closest("form") || document.querySelector("form");

    var method = "unknown";
    if (submitBtn) { submitBtn.click(); method = "button"; }
    else if (form) { form.submit(); method = "form"; }
    else { return { success: false, error: "Nessun submit trovato" }; }

    return { success: true, method: method };
  } catch (e) { return { success: false, error: e.message }; }
}

function diagnoseAfterLogin() {
  try {
    var errorEl = document.querySelector(".validation-summary-errors, .alert-danger, .error-message");
    return {
      url: window.location.href,
      pageTitle: document.title,
      errorMessage: errorEl ? errorEl.textContent.trim().substring(0, 200) : null,
      isLoggedIn: !!document.querySelector("a[href*='Logout'], a[href*='logout'], a[href*='SignOut']"),
      stillOnLoginPage: !!document.querySelector("input[type='password']"),
    };
  } catch (e) { return { error: e.message }; }
}

// ══════════════════════════════════════════════════
// CONNECT BUTTON
// ══════════════════════════════════════════════════
mainBtn.addEventListener("click", async function () {
  mainBtn.disabled = true;
  logEl.innerHTML = "";
  setStatus("⏳ Avvio login automatico...", "working");

  try {
    log("① Recupero credenziali...", "wait");
    var credRes = await fetch(SUPABASE_URL + "/functions/v1/get-wca-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY },
      body: JSON.stringify({}),
    });
    var creds = await credRes.json();
    if (!creds.username || !creds.password) throw new Error("Credenziali WCA non configurate.");
    log("✓ Credenziali ottenute", "done");

    log("② Apro pagina di login...", "wait");
    var tab = await chrome.tabs.create({ url: "https://www.wcaworld.com/Account/Login", active: false });
    log("✓ Pagina aperta", "done");

    log("③ Attendo caricamento...", "wait");
    await waitForTabLoad(tab.id, 20000);
    log("✓ Pagina caricata", "done");

    log("④ Analizzo form...", "wait");
    var analyzeRes = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: analyzeLoginPage });
    var pageInfo = analyzeRes[0] && analyzeRes[0].result;
    if (pageInfo) log("   Campi: " + (pageInfo.inputDetails || "nessuno"), "wait");

    log("⑤ Login automatico...", "wait");
    setStatus("⏳ Login in corso...", "working");
    var injRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: fillAndSubmitLogin, args: [creds.username, creds.password],
    });
    var formResult = injRes[0] && injRes[0].result;
    if (!formResult || !formResult.success) throw new Error((formResult && formResult.error) || "Form non trovato");
    log("✓ Form inviato (" + formResult.method + ")", "done");

    log("⑥ Attendo risposta...", "wait");
    await waitForRedirectOrTimeout(tab.id, 10000);
    log("✓ OK", "done");

    log("⑦ Verifico...", "wait");
    var diagRes = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: diagnoseAfterLogin });
    var diag = diagRes[0] && diagRes[0].result;
    if (diag) {
      if (diag.errorMessage) log("   ⚠ Errore: " + diag.errorMessage, "fail");
      if (diag.isLoggedIn) log("   ✓ Login riuscito!", "done");
      if (diag.stillOnLoginPage) log("   ✗ Ancora sulla pagina di login", "fail");
    }

    log("⑧ Leggo cookie...", "wait");
    var allCookies = await getAllWcaCookies();
    var hasAuth = allCookies.some(function (c) { return c.name === ".ASPXAUTH" || c.name === ".AspNet.ApplicationCookie"; });
    log("   " + allCookies.length + " cookie, .ASPXAUTH: " + (hasAuth ? "✅" : "❌"), hasAuth ? "done" : "fail");

    if (!hasAuth) {
      log("   Riprovo tra 5s...", "wait");
      await sleep(5000);
      allCookies = await getAllWcaCookies();
      hasAuth = allCookies.some(function (c) { return c.name === ".ASPXAUTH" || c.name === ".AspNet.ApplicationCookie"; });
    }

    if (!hasAuth && diag && diag.isLoggedIn) {
      log("   Login OK ma .ASPXAUTH non visibile. Invio cookie disponibili...", "wait");
    }

    if (!hasAuth && (!diag || !diag.isLoggedIn)) {
      if (tab.id) { try { chrome.tabs.remove(tab.id); } catch (e) {} }
      setStatus("❌ Login fallito", "error");
      log("Login non riuscito e .ASPXAUTH assente.", "fail");
      mainBtn.disabled = false;
      return;
    }

    var cookieStr = allCookies.map(function (c) { return c.name + "=" + c.value; }).join("; ");
    await sendCookiesAndFinish(cookieStr, tab.id);
  } catch (err) {
    setStatus("❌ " + err.message, "error");
    log("Errore: " + err.message, "fail");
    mainBtn.disabled = false;
  }
});
