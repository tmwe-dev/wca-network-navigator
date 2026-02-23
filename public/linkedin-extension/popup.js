var SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

var statusEl = document.getElementById("status");
var logEl = document.getElementById("log");
var mainBtn = document.getElementById("mainBtn");

function setStatus(text, cls) { statusEl.className = "status " + cls; statusEl.textContent = text; }
function log(text, cls) {
  cls = cls || "";
  var line = document.createElement("div");
  line.className = cls;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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

function fillLinkedInLogin(email, password) {
  try {
    var userInput = document.querySelector("#username") || document.querySelector("input[name='session_key']");
    var passInput = document.querySelector("#password") || document.querySelector("input[name='session_password']");
    if (!userInput || !passInput) return { success: false, error: "Campi non trovati" };

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
      || document.querySelector(".login__form_action_container button");
    if (submitBtn) { submitBtn.click(); return { success: true, method: "button" }; }
    var form = userInput.closest("form");
    if (form) { form.submit(); return { success: true, method: "form" }; }
    return { success: false, error: "Nessun submit trovato" };
  } catch (e) { return { success: false, error: e.message }; }
}

function checkLinkedInSession() {
  try {
    var feedPresent = !!document.querySelector(".feed-shared-update-v2, .scaffold-layout, .global-nav__me");
    var loginPage = !!document.querySelector("#username, .login__form");
    return { authenticated: feedPresent && !loginPage, reason: feedPresent ? "feed_present" : "not_logged_in" };
  } catch (e) { return { authenticated: false, reason: "error" }; }
}

mainBtn.addEventListener("click", async function () {
  mainBtn.disabled = true;
  logEl.innerHTML = "";
  setStatus("⏳ Avvio login automatico...", "working");

  try {
    log("① Recupero credenziali...", "wait");
    var credRes = await fetch(SUPABASE_URL + "/functions/v1/get-linkedin-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY },
      body: JSON.stringify({}),
    });
    var creds = await credRes.json();
    if (!creds.email || !creds.password) throw new Error("Credenziali LinkedIn non configurate nelle Impostazioni.");
    log("✓ Credenziali ottenute", "done");

    log("② Apro pagina di login LinkedIn...", "wait");
    var tab = await chrome.tabs.create({ url: "https://www.linkedin.com/login", active: false });
    log("✓ Pagina aperta", "done");

    log("③ Attendo caricamento...", "wait");
    await waitForTabLoad(tab.id, 20000);
    log("✓ Pagina caricata", "done");

    log("④ Login automatico...", "wait");
    setStatus("⏳ Login in corso...", "working");
    var injRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: fillLinkedInLogin, args: [creds.email, creds.password],
    });
    var formResult = injRes[0] && injRes[0].result;
    if (!formResult || !formResult.success) throw new Error((formResult && formResult.error) || "Form non trovato");
    log("✓ Form inviato (" + formResult.method + ")", "done");

    log("⑤ Attendo risposta...", "wait");
    await waitForTabLoad(tab.id, 15000);
    log("✓ OK", "done");

    log("⑥ Verifico sessione...", "wait");
    var sessionRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: checkLinkedInSession,
    });
    var session = sessionRes[0] && sessionRes[0].result;
    var isLoggedIn = session && session.authenticated;
    log(isLoggedIn ? "   ✓ Login riuscito!" : "   ✗ Sessione non verificata", isLoggedIn ? "done" : "fail");

    log("⑦ Leggo cookie li_at...", "wait");
    var liAtCookie = await chrome.cookies.get({ url: "https://www.linkedin.com/", name: "li_at" });
    var hasLiAt = !!(liAtCookie && liAtCookie.value);
    log("   li_at: " + (hasLiAt ? "✅ trovato" : "❌ non trovato"), hasLiAt ? "done" : "fail");

    if (!hasLiAt && !isLoggedIn) {
      try { chrome.tabs.remove(tab.id); } catch (e) {}
      setStatus("❌ Login fallito", "error");
      log("Login non riuscito e cookie li_at assente.", "fail");
      mainBtn.disabled = false;
      return;
    }

    log("⑧ Invio cookie al server...", "wait");
    if (hasLiAt) {
      var saveRes = await fetch(SUPABASE_URL + "/functions/v1/save-linkedin-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY },
        body: JSON.stringify({ cookie: liAtCookie.value }),
      });
      var saveData = await saveRes.json();
      if (saveData.success) {
        setStatus("✅ Connesso! Cookie li_at salvato.", "ok");
        log("✓ Cookie salvato con successo!", "done");
      } else {
        setStatus("⚠️ Cookie trovato ma errore nel salvataggio", "error");
        log("Errore salvataggio: " + (saveData.message || "sconosciuto"), "fail");
      }
    } else {
      setStatus("⚠️ Login OK ma cookie li_at non disponibile", "error");
      log("Login OK ma il cookie li_at non è accessibile.", "fail");
    }

    try { chrome.tabs.remove(tab.id); } catch (e) {}
  } catch (err) {
    setStatus("❌ " + err.message, "error");
    log("Errore: " + err.message, "fail");
  }
  mainBtn.disabled = false;
});
