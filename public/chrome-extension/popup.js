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
    if (!creds.username || !creds.password) throw new Error("Credenziali WCA non configurate.");
    log("✓ Credenziali ottenute", "done");

    // Step 2: Open login page
    log("② Apro pagina di login...", "wait");
    const tab = await chrome.tabs.create({ url: "https://www.wcaworld.com/Account/Login", active: false });
    log("✓ Pagina aperta", "done");

    // Step 3: Wait for load
    log("③ Attendo caricamento...", "wait");
    await waitForTabLoad(tab.id, 20000);
    log("✓ Pagina caricata", "done");

    // Step 4: Analyze the login form first
    log("④ Analizzo form di login...", "wait");
    const analyzeResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: analyzeLoginPage,
    });
    const pageInfo = analyzeResult[0]?.result;
    log(`   URL: ${pageInfo?.url || '?'}`, "wait");
    log(`   Form trovati: ${pageInfo?.formCount || 0}`, "wait");
    log(`   Input text: ${pageInfo?.textInputs || 0}, password: ${pageInfo?.passwordInputs || 0}`, "wait");
    if (pageInfo?.inputDetails) log(`   Campi: ${pageInfo.inputDetails}`, "wait");

    // Step 5: Fill and submit
    log("⑤ Compilo e invio login...", "wait");
    setStatus("⏳ Login in corso...", "working");
    const injResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillAndSubmitLogin,
      args: [creds.username, creds.password],
    });
    const formResult = injResult[0]?.result;
    if (!formResult?.success) {
      throw new Error(formResult?.error || "Form di login non trovato");
    }
    log(`✓ Form inviato (metodo: ${formResult.method || '?'})`, "done");

    // Step 6: Wait for response
    log("⑥ Attendo risposta...", "wait");
    await waitForRedirectOrTimeout(tab.id, 10000);
    log("✓ Attesa completata", "done");

    // Step 7: Diagnose what happened
    log("⑦ Verifico risultato login...", "wait");
    const diagResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: diagnoseAfterLogin,
    });
    const diag = diagResult[0]?.result;
    log(`   URL dopo login: ${diag?.url || '?'}`, "wait");
    if (diag?.errorMessage) log(`   ⚠ Errore pagina: ${diag.errorMessage}`, "fail");
    if (diag?.isLoggedIn) log("   ✓ Sembra loggato!", "done");
    if (diag?.pageTitle) log(`   Titolo: ${diag.pageTitle}`, "wait");

    // Step 8: Read cookies using URL method (more reliable)
    log("⑧ Leggo cookie...", "wait");
    const allCookies = await getAllWcaCookies();
    let hasAuth = allCookies.some(c => c.name === ".ASPXAUTH" || c.name === ".AspNet.ApplicationCookie");
    log(`   Cookie trovati: ${allCookies.length}`, "wait");
    log(`   .ASPXAUTH: ${hasAuth ? "✅" : "❌"}`, hasAuth ? "done" : "fail");
    log(`   Nomi: ${allCookies.map(c => c.name).join(", ")}`, "wait");
    // Show domains for debugging
    const domains = [...new Set(allCookies.map(c => c.domain))];
    log(`   Domini: ${domains.join(", ")}`, "wait");

    if (!hasAuth) {
      // Wait and retry with all methods
      log("   Riprovo tra 5s...", "wait");
      await sleep(5000);
      const allCookies2 = await getAllWcaCookies();
      hasAuth = allCookies2.some(c => c.name === ".ASPXAUTH" || c.name === ".AspNet.ApplicationCookie");
      
      if (hasAuth) {
        log("   ✓ .ASPXAUTH trovato al secondo tentativo!", "done");
        const cookieStr = allCookies2.map(c => `${c.name}=${c.value}`).join("; ");
        await sendCookiesAndFinish(cookieStr, tab.id);
        return;
      }

      log(`   Ancora ${allCookies2.length} cookie, nomi: ${allCookies2.map(c=>c.name).join(", ")}`, "fail");

      // Last resort: send whatever cookies we have (the session might work without .ASPXAUTH visible to extension)
      try { chrome.tabs.remove(tab.id); } catch {}
      
      // Even without .ASPXAUTH, try sending all cookies - the login DID succeed
      if (diag?.isLoggedIn) {
        log("   Login riuscito ma .ASPXAUTH non visibile. Invio cookie disponibili...", "wait");
        const cookieStr = allCookies2.map(c => `${c.name}=${c.value}`).join("; ");
        await sendCookiesAndFinish(cookieStr, null);
        return;
      }

      setStatus("❌ Login fallito: .ASPXAUTH non visibile", "error");
      log("Il login è riuscito (MemberSection raggiunta) ma il cookie .ASPXAUTH non è accessibile dall'estensione.", "fail");
      log("Prova: apri wcaworld.com manualmente nel browser, poi riclicca qui.", "fail");
      mainBtn.disabled = false;
      return;
    }

    const cookieStr = allCookies.map(c => `${c.name}=${c.value}`).join("; ");
    await sendCookiesAndFinish(cookieStr, tab.id);
  } catch (err) {
    setStatus("❌ " + err.message, "error");
    log("Errore: " + err.message, "fail");
    mainBtn.disabled = false;
  }
});

async function sendCookiesAndFinish(cookieStr, tabId) {
  log("⑨ Invio cookie al server...", "wait");
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
      setStatus("⚠️ Cookie salvato, verifica contatti fallita", "error");
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

// Get ALL cookies for wcaworld.com using multiple methods
async function getAllWcaCookies() {
  const byUrl = await chrome.cookies.getAll({ url: "https://www.wcaworld.com/" });
  const byDomain1 = await chrome.cookies.getAll({ domain: ".wcaworld.com" });
  const byDomain2 = await chrome.cookies.getAll({ domain: "www.wcaworld.com" });
  const byDomain3 = await chrome.cookies.getAll({ domain: "wcaworld.com" });
  
  // Also try to get .ASPXAUTH specifically
  let aspxAuth = null;
  try {
    aspxAuth = await chrome.cookies.get({ url: "https://www.wcaworld.com/", name: ".ASPXAUTH" });
  } catch (e) {}
  
  // Merge all unique cookies
  const map = new Map();
  for (const list of [byUrl, byDomain1, byDomain2, byDomain3]) {
    for (const c of list) {
      map.set(`${c.domain}|${c.name}|${c.path}`, c);
    }
  }
  if (aspxAuth) map.set(`.aspxauth-direct`, aspxAuth);
  
  return Array.from(map.values());
}


  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
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

// Analyze the login page structure
function analyzeLoginPage() {
  try {
    const forms = document.querySelectorAll('form');
    const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])');
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    const allInputs = document.querySelectorAll('input');
    
    const inputDetails = Array.from(allInputs)
      .filter(i => i.type !== 'hidden')
      .map(i => `${i.name || i.id || '?'}(${i.type})`)
      .join(', ');

    return {
      url: window.location.href,
      formCount: forms.length,
      textInputs: textInputs.length,
      passwordInputs: passwordInputs.length,
      inputDetails,
      pageTitle: document.title,
    };
  } catch (e) {
    return { error: e.message };
  }
}

// Fill and submit the login form
function fillAndSubmitLogin(username, password) {
  try {
    // Try specific WCA selectors first, then generic
    const userInput = document.querySelector('#UserName') 
      || document.querySelector('input[name="UserName"]')
      || document.querySelector('input[name="username"]')
      || document.querySelector('input[type="text"]')
      || document.querySelector('input[type="email"]');
    
    const passInput = document.querySelector('#Password')
      || document.querySelector('input[name="Password"]')
      || document.querySelector('input[name="password"]')
      || document.querySelector('input[type="password"]');

    if (!userInput || !passInput) {
      return { 
        success: false, 
        error: `Campi non trovati. User: ${!!userInput}, Pass: ${!!passInput}. Inputs visibili: ${document.querySelectorAll('input:not([type="hidden"])').length}` 
      };
    }

    // Use native setter for maximum compatibility
    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    
    // Focus, clear, set value, dispatch events
    userInput.focus();
    nativeSet.call(userInput, username);
    userInput.dispatchEvent(new Event('input', { bubbles: true }));
    userInput.dispatchEvent(new Event('change', { bubbles: true }));
    userInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    
    passInput.focus();
    nativeSet.call(passInput, password);
    passInput.dispatchEvent(new Event('input', { bubbles: true }));
    passInput.dispatchEvent(new Event('change', { bubbles: true }));
    passInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

    // Find submit button
    const submitBtn = document.querySelector('input[type="submit"]')
      || document.querySelector('button[type="submit"]')
      || document.querySelector('.btn-login')
      || document.querySelector('.login-btn')
      || document.querySelector('button.btn-primary');
    
    const form = userInput.closest('form') || document.querySelector('form');

    let method = 'unknown';
    if (submitBtn) {
      submitBtn.click();
      method = 'button-click';
    } else if (form) {
      form.submit();
      method = 'form-submit';
    } else {
      // Try pressing Enter in the password field
      passInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      method = 'enter-key';
    }

    return { success: true, method };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Diagnose the page state after login attempt
function diagnoseAfterLogin() {
  try {
    const url = window.location.href;
    const title = document.title;
    
    // Check for error messages
    const errorEl = document.querySelector('.validation-summary-errors, .alert-danger, .error-message, .field-validation-error');
    const errorMessage = errorEl ? errorEl.textContent.trim().substring(0, 200) : null;
    
    // Check if we're on a logged-in page
    const hasLogoutLink = !!document.querySelector('a[href*="Logout"], a[href*="logout"], a[href*="SignOut"]');
    const hasLoginForm = !!document.querySelector('input[type="password"]');
    
    return {
      url,
      pageTitle: title,
      errorMessage,
      isLoggedIn: hasLogoutLink && !hasLoginForm,
      hasLogoutLink,
      stillOnLoginPage: hasLoginForm,
    };
  } catch (e) {
    return { error: e.message };
  }
}
