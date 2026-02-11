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
    // Step 1: Get credentials from server
    log("① Recupero credenziali dal server...", "wait");
    const credRes = await fetch(`${SUPABASE_URL}/functions/v1/get-wca-credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
    });
    const creds = await credRes.json();
    if (!creds.username || !creds.password) {
      throw new Error("Credenziali WCA non configurate nel server. Vai su Impostazioni → WCA.");
    }
    log("✓ Credenziali ottenute", "done");

    // Step 2: Open login page in background
    log("② Apro pagina di login WCA...", "wait");
    const tab = await chrome.tabs.create({
      url: "https://www.wcaworld.com/Account/Login",
      active: false,
    });
    log("✓ Pagina aperta (tab " + tab.id + ")", "done");

    // Step 3: Wait for page to load, then inject login script
    log("③ Attendo caricamento pagina...", "wait");
    await waitForTabLoad(tab.id);
    log("✓ Pagina caricata", "done");

    // Step 4: Fill and submit login form
    log("④ Compilo e invio il form di login...", "wait");
    setStatus("⏳ Login in corso...", "working");
    
    const injectionResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillAndSubmitLogin,
      args: [creds.username, creds.password],
    });

    const formResult = injectionResult[0]?.result;
    if (!formResult?.success) {
      throw new Error(formResult?.error || "Form di login non trovato nella pagina");
    }
    log("✓ Form compilato e inviato", "done");

    // Step 5: Wait for redirect after login
    log("⑤ Attendo redirect post-login...", "wait");
    await waitForNavigation(tab.id, 15000);
    log("✓ Redirect completato", "done");

    // Step 6: Read all cookies
    log("⑥ Leggo tutti i cookie...", "wait");
    const cookies = await chrome.cookies.getAll({ domain: "www.wcaworld.com" });
    const hasAuth = cookies.some(c => c.name === ".ASPXAUTH" || c.name === ".AspNet.ApplicationCookie");
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
    
    log(`✓ ${cookies.length} cookie trovati, .ASPXAUTH: ${hasAuth ? "✅" : "❌"}`, hasAuth ? "done" : "fail");

    if (!hasAuth) {
      // Close tab
      try { chrome.tabs.remove(tab.id); } catch {}
      setStatus("❌ Login fallito: .ASPXAUTH non presente. Credenziali errate?", "error");
      mainBtn.disabled = false;
      return;
    }

    // Step 7: Send cookies to server
    log("⑦ Invio cookie al server...", "wait");
    setStatus("⏳ Invio e verifica...", "working");
    
    const saveRes = await fetch(`${SUPABASE_URL}/functions/v1/save-wca-cookie`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ cookie: cookieStr }),
    });
    const saveData = await saveRes.json();

    // Step 8: Close tab and show result
    try { chrome.tabs.remove(tab.id); } catch {}

    if (saveData.authenticated) {
      setStatus("✅ Connesso! Contatti personali visibili.", "ok");
      log("✓ Tutto OK! Cookie salvato e verificato.", "done");
    } else {
      setStatus("⚠️ Cookie salvato ma verifica contatti fallita.", "error");
      log("Cookie inviato ma i contatti privati non sono visibili.", "fail");
    }

    if (saveData.diagnostics) {
      const d = saveData.diagnostics;
      log(`Contatti: ${d.contactsTotal || 0}, Nomi: ${d.contactsWithRealName || 0}, Email: ${d.contactsWithEmail || 0}`);
    }
  } catch (err) {
    setStatus("❌ " + err.message, "error");
    log("Errore: " + err.message, "fail");
  } finally {
    mainBtn.disabled = false;
  }
});

// ── Helpers ──

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timeout caricamento pagina (15s)"));
    }, 15000);

    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1000); // extra wait for JS to init
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function waitForNavigation(tabId, ms = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // resolve anyway, maybe login didn't redirect
    }, ms);

    let navigated = false;
    function listener(id, info) {
      if (id === tabId && info.status === "complete" && !navigated) {
        navigated = true;
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 2000); // wait for cookies to settle
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Injected into the WCA login page
function fillAndSubmitLogin(username, password) {
  try {
    const userInput = document.querySelector('input[name="UserName"], input[name="username"], input#UserName, input[type="text"]');
    const passInput = document.querySelector('input[name="Password"], input[name="password"], input#Password, input[type="password"]');
    const form = document.querySelector('form[action*="Login"], form[action*="login"], form');
    const submitBtn = document.querySelector('input[type="submit"], button[type="submit"], .btn-login, .login-btn');

    if (!userInput || !passInput) {
      return { success: false, error: "Campi username/password non trovati" };
    }

    // Set values using native input setter for React-style forms
    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSet.call(userInput, username);
    userInput.dispatchEvent(new Event('input', { bubbles: true }));
    nativeSet.call(passInput, password);
    passInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Submit
    if (submitBtn) {
      submitBtn.click();
    } else if (form) {
      form.submit();
    } else {
      return { success: false, error: "Nessun bottone submit o form trovato" };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
