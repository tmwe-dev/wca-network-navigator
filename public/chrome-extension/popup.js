const SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const mainBtn = document.getElementById("mainBtn");

function setStatus(text, cls) {
  statusEl.className = "status " + cls;
  statusEl.textContent = text;
}

function log(text, cls = "") {
  const line = document.createElement("div");
  line.className = cls;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

mainBtn.addEventListener("click", async () => {
  mainBtn.disabled = true;
  logEl.innerHTML = "";
  setStatus("⏳ Avvio login automatico...", "working");

  try {
    // Step 1: Get credentials
    log("① Recupero credenziali...", "wait");
    const credRes = await fetch(`${SUPABASE_URL}/functions/v1/get-wca-credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({}),
    });
    const creds = await credRes.json();
    if (!creds.username || !creds.password) throw new Error("Credenziali WCA non configurate. Vai su Impostazioni.");
    log("✓ Credenziali ottenute", "done");

    // Step 2: Open login page
    log("② Apro pagina di login...", "wait");
    const tab = await chrome.tabs.create({ url: "https://www.wcaworld.com/Account/Login", active: false });
    log("✓ Pagina aperta", "done");

    // Step 3: Wait for load
    log("③ Attendo caricamento...", "wait");
    await waitForTabLoad(tab.id, 20000);
    log("✓ Pagina caricata", "done");

    // Step 4: Fill and submit
    log("④ Login automatico...", "wait");
    setStatus("⏳ Login in corso...", "working");
    const injResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillAndSubmitLogin,
      args: [creds.username, creds.password],
    });
    const formResult = injResult[0]?.result;
    if (!formResult?.success) throw new Error(formResult?.error || "Form di login non trovato");
    log("✓ Form inviato", "done");

    // Step 5: Wait for redirect (short timeout, proceed anyway)
    log("⑤ Attendo risposta...", "wait");
    await waitForRedirectOrTimeout(tab.id, 8000);
    log("✓ Proseguo", "done");

    // Step 6: Read cookies
    log("⑥ Leggo cookie...", "wait");
    const cookies = await chrome.cookies.getAll({ domain: "www.wcaworld.com" });
    const hasAuth = cookies.some(c => c.name === ".ASPXAUTH" || c.name === ".AspNet.ApplicationCookie");
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
    log(`✓ ${cookies.length} cookie, .ASPXAUTH: ${hasAuth ? "✅" : "❌"}`, hasAuth ? "done" : "fail");

    if (!hasAuth) {
      // Try waiting a bit more and retry
      log("⏳ Riprovo tra 3s...", "wait");
      await sleep(3000);
      const cookies2 = await chrome.cookies.getAll({ domain: "www.wcaworld.com" });
      const hasAuth2 = cookies2.some(c => c.name === ".ASPXAUTH" || c.name === ".AspNet.ApplicationCookie");
      if (hasAuth2) {
        const cookieStr2 = cookies2.map(c => `${c.name}=${c.value}`).join("; ");
        log("✓ .ASPXAUTH trovato al secondo tentativo!", "done");
        await sendCookiesAndFinish(cookieStr2, tab.id);
        return;
      }
      try { chrome.tabs.remove(tab.id); } catch {}
      setStatus("❌ Login fallito: .ASPXAUTH mancante", "error");
      log("Credenziali errate o protezione anti-bot attiva.", "fail");
      mainBtn.disabled = false;
      return;
    }

    await sendCookiesAndFinish(cookieStr, tab.id);
  } catch (err) {
    setStatus("❌ " + err.message, "error");
    log("Errore: " + err.message, "fail");
    mainBtn.disabled = false;
  }
});

async function sendCookiesAndFinish(cookieStr, tabId) {
  log("⑦ Invio cookie al server...", "wait");
  setStatus("⏳ Verifica finale...", "working");
  try {
    const saveRes = await fetch(`${SUPABASE_URL}/functions/v1/save-wca-cookie`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ cookie: cookieStr }),
    });
    const saveData = await saveRes.json();
    try { chrome.tabs.remove(tabId); } catch {}

    if (saveData.authenticated) {
      setStatus("✅ Connesso! Tutto OK.", "ok");
      log("✓ Cookie salvato e verificato!", "done");
    } else {
      setStatus("⚠️ Cookie salvato, verifica fallita", "error");
      log("Cookie inviato ma contatti privati non visibili.", "fail");
    }
    if (saveData.diagnostics) {
      const d = saveData.diagnostics;
      log(`Contatti: ${d.contactsTotal || 0}, Nomi: ${d.contactsWithRealName || 0}, Email: ${d.contactsWithEmail || 0}`);
    }
  } catch (err) {
    setStatus("❌ Errore invio: " + err.message, "error");
    log("Errore: " + err.message, "fail");
  }
  mainBtn.disabled = false;
}

// ── Helpers ──

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForTabLoad(tabId, ms = 20000) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // proceed anyway
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

function waitForRedirectOrTimeout(tabId, ms = 8000) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // always proceed
    }, ms);
    let navigated = false;
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

function fillAndSubmitLogin(username, password) {
  try {
    const userInput = document.querySelector('input[name="UserName"], input[name="username"], input#UserName, input[type="text"]');
    const passInput = document.querySelector('input[name="Password"], input[name="password"], input#Password, input[type="password"]');
    const submitBtn = document.querySelector('input[type="submit"], button[type="submit"], .btn-login, .login-btn');
    const form = document.querySelector('form[action*="Login"], form[action*="login"], form');

    if (!userInput || !passInput) return { success: false, error: "Campi username/password non trovati" };

    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSet.call(userInput, username);
    userInput.dispatchEvent(new Event('input', { bubbles: true }));
    userInput.dispatchEvent(new Event('change', { bubbles: true }));
    nativeSet.call(passInput, password);
    passInput.dispatchEvent(new Event('input', { bubbles: true }));
    passInput.dispatchEvent(new Event('change', { bubbles: true }));

    if (submitBtn) submitBtn.click();
    else if (form) form.submit();
    else return { success: false, error: "Nessun bottone submit trovato" };

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
