var SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

var statusEl = document.getElementById("status");
var logEl = document.getElementById("log");
var mainBtn = document.getElementById("mainBtn");
var extractBtn = document.getElementById("extractBtn");
var extractConfig = document.getElementById("extractConfig");
var wcaIdsInput = document.getElementById("wcaIds");

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
// INJECTED: Extract contacts from a WCA profile page
// ══════════════════════════════════════════════════
function extractContactsFromPage() {
  try {
    var result = { wcaId: null, contacts: [], companyName: null };

    // Get WCA ID from URL
    var urlMatch = window.location.href.match(/\/directory\/members\/(\d+)/i);
    if (urlMatch) result.wcaId = parseInt(urlMatch[1]);

    // Get company name from h1
    var h1 = document.querySelector("h1");
    if (h1) result.companyName = h1.textContent.trim();

    // Find all contactperson_row blocks
    var allRows = document.querySelectorAll("[class*='contactperson_row'], .contactperson_row, tr.contactperson_row, div.contactperson_row");
    
    // Fallback: search by class substring in all elements
    if (allRows.length === 0) {
      var allEls = document.querySelectorAll("*");
      var rows = [];
      for (var i = 0; i < allEls.length; i++) {
        if (allEls[i].className && typeof allEls[i].className === "string" && allEls[i].className.indexOf("contactperson_row") >= 0) {
          rows.push(allEls[i]);
        }
      }
      allRows = rows;
    }

    for (var r = 0; r < allRows.length; r++) {
      var row = allRows[r];
      var contact = {};

      // Extract fields by looking for profile_label + profile_val pairs
      var labels = row.querySelectorAll("[class*='profile_label']");
      for (var l = 0; l < labels.length; l++) {
        var labelText = labels[l].textContent.trim().replace(/:$/, "");
        // Find the next sibling or cousin with profile_val
        var valEl = labels[l].nextElementSibling;
        if (!valEl || (valEl.className && valEl.className.indexOf("profile_val") < 0)) {
          // Try parent's next sibling
          var parent = labels[l].parentElement;
          if (parent) {
            var next = parent.nextElementSibling;
            if (next) {
              valEl = next.querySelector("[class*='profile_val']") || next;
            }
          }
        }
        
        var value = valEl ? valEl.textContent.trim() : "";
        // Clean up: remove "Members only" prefix/suffix
        if (/Members\s*only/i.test(value) || /please.*Login/i.test(value)) value = "";

        if (/^Title$/i.test(labelText)) contact.title = value;
        else if (/^Name$/i.test(labelText)) contact.name = value;
        else if (/^Email$/i.test(labelText)) {
          // Also check for mailto links
          var emailLink = valEl ? valEl.querySelector("a[href^='mailto:']") : null;
          if (emailLink) {
            contact.email = emailLink.href.replace("mailto:", "").trim();
          } else if (value && value.indexOf("@") >= 0) {
            contact.email = value;
          }
        }
        else if (/^Direct\s*Line$/i.test(labelText) || /^Phone$/i.test(labelText)) contact.phone = value;
        else if (/^Mobile$/i.test(labelText)) contact.mobile = value;
      }

      // Only add if we have meaningful data
      if (contact.title || contact.name) {
        if (!contact.name && contact.title) contact.name = contact.title;
        result.contacts.push(contact);
      }
    }

    return result;
  } catch (e) {
    return { error: e.message, contacts: [] };
  }
}

// ══════════════════════════════════════════════════
// CONNECT BUTTON (same as v2)
// ══════════════════════════════════════════════════
mainBtn.addEventListener("click", async function () {
  mainBtn.disabled = true;
  extractBtn.disabled = true;
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
      extractBtn.disabled = false;
      return;
    }

    var cookieStr = allCookies.map(function (c) { return c.name + "=" + c.value; }).join("; ");
    await sendCookiesAndFinish(cookieStr, tab.id);
    extractBtn.disabled = false;
  } catch (err) {
    setStatus("❌ " + err.message, "error");
    log("Errore: " + err.message, "fail");
    mainBtn.disabled = false;
    extractBtn.disabled = false;
  }
});

// ══════════════════════════════════════════════════
// EXTRACT CONTACTS BUTTON
// ══════════════════════════════════════════════════
var extractMode = false;
extractBtn.addEventListener("click", async function () {
  if (!extractMode) {
    extractMode = true;
    extractConfig.style.display = "block";
    extractBtn.textContent = "▶ Avvia Estrazione";
    return;
  }

  extractBtn.disabled = true;
  mainBtn.disabled = true;
  logEl.innerHTML = "";
  setStatus("⏳ Estrazione contatti...", "working");

  try {
    var idsText = wcaIdsInput.value.trim();
    var wcaIds = [];

    if (idsText) {
      // Parse comma-separated IDs
      wcaIds = idsText.split(/[,\s]+/).map(function (s) { return parseInt(s.trim()); }).filter(function (n) { return !isNaN(n) && n > 0; });
    }

    if (wcaIds.length === 0) {
      // Try current tab
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url && tabs[0].url.indexOf("wcaworld.com/directory/members/") >= 0) {
        log("Estrazione dalla tab corrente...", "wait");
        var res = await chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, func: extractContactsFromPage });
        var data = res[0] && res[0].result;
        if (data && data.contacts && data.contacts.length > 0) {
          log("✓ " + data.companyName + ": " + data.contacts.length + " contatti trovati", "done");
          for (var c = 0; c < data.contacts.length; c++) {
            var ct = data.contacts[c];
            var info = (ct.name || ct.title || "?");
            if (ct.email) info += " | " + ct.email;
            if (ct.phone) info += " | ☎ " + ct.phone;
            if (ct.mobile) info += " | 📱 " + ct.mobile;
            log("   " + info, ct.email ? "done" : "info");
          }
          // Send to server
          await sendContactsToServer([data]);
        } else {
          log("Nessun contatto trovato nella pagina", "fail");
        }
      } else {
        log("Inserisci WCA IDs o apri un profilo WCA in una tab.", "fail");
      }
    } else {
      // Open each profile in a background tab and extract
      log("Estrazione di " + wcaIds.length + " profili...", "wait");
      var allData = [];
      var successCount = 0;
      var contactsTotal = 0;

      for (var i = 0; i < wcaIds.length; i++) {
        var wcaId = wcaIds[i];
        log("(" + (i + 1) + "/" + wcaIds.length + ") Apro profilo " + wcaId + "...", "wait");

        var tab = await chrome.tabs.create({
          url: "https://www.wcaworld.com/directory/members/" + wcaId,
          active: false,
        });
        await waitForTabLoad(tab.id, 15000);

        var extractRes = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractContactsFromPage,
        });
        var pageData = extractRes[0] && extractRes[0].result;

        if (pageData && pageData.contacts && pageData.contacts.length > 0) {
          pageData.wcaId = wcaId;
          var contactsWithEmail = pageData.contacts.filter(function (c) { return c.email; }).length;
          var contactsWithPhone = pageData.contacts.filter(function (c) { return c.phone || c.mobile; }).length;
          log("   ✓ " + (pageData.companyName || wcaId) + ": " + pageData.contacts.length + " contatti (" + contactsWithEmail + " email, " + contactsWithPhone + " tel)", contactsWithEmail > 0 ? "done" : "info");
          allData.push(pageData);
          successCount++;
          contactsTotal += pageData.contacts.length;
        } else {
          log("   ✗ " + wcaId + ": nessun contatto", "fail");
        }

        try { chrome.tabs.remove(tab.id); } catch (e) {}

        // Small delay between profiles
        if (i < wcaIds.length - 1) await sleep(2000);
      }

      log("───────────────────", "wait");
      log("Totale: " + successCount + "/" + wcaIds.length + " profili, " + contactsTotal + " contatti", "done");

      if (allData.length > 0) {
        await sendContactsToServer(allData);
      }
    }
  } catch (err) {
    setStatus("❌ " + err.message, "error");
    log("Errore: " + err.message, "fail");
  }

  extractBtn.disabled = false;
  mainBtn.disabled = false;
  extractMode = false;
  extractConfig.style.display = "none";
  extractBtn.textContent = "📇 Estrai Contatti";
});

// ── Send extracted contacts to the backend ──
async function sendContactsToServer(dataArray) {
  log("📤 Invio contatti al server...", "wait");
  try {
    var batch = dataArray.map(function (d) {
      return { wcaId: d.wcaId, contacts: d.contacts };
    });

    var res = await fetch(SUPABASE_URL + "/functions/v1/save-wca-contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ batch: batch }),
    });
    var result = await res.json();

    if (result.success && result.results) {
      var totalUpdated = 0;
      var totalInserted = 0;
      for (var r = 0; r < result.results.length; r++) {
        totalUpdated += result.results[r].updated || 0;
        totalInserted += result.results[r].inserted || 0;
      }
      log("✅ Salvati! " + totalUpdated + " aggiornati, " + totalInserted + " nuovi", "done");
      setStatus("✅ Contatti estratti e salvati!", "ok");
    } else {
      log("⚠ Risposta: " + JSON.stringify(result), "fail");
      setStatus("⚠ Salvataggio parziale", "error");
    }
  } catch (err) {
    log("❌ Errore invio: " + err.message, "fail");
    setStatus("❌ Errore: " + err.message, "error");
  }
}