// ══════════════════════════════════════════════
// ReportAziende Cookie Sync - Background Service Worker
// ══════════════════════════════════════════════

const SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

// ── Sync cookies from reportaziende.it ──
async function syncRACookies() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: ".reportaziende.it" });
    const cookies2 = await chrome.cookies.getAll({ domain: "reportaziende.it" });
    const cookies3 = await chrome.cookies.getAll({ domain: "ecommerce2.reportaziende.it" });
    const allCookies = [...cookies, ...cookies2, ...cookies3];

    if (allCookies.length === 0) {
      return { success: false, error: "Nessun cookie trovato per reportaziende.it" };
    }

    // Build cookie string
    const uniqueCookies = {};
    allCookies.forEach((c) => { uniqueCookies[c.name] = c.value; });
    const cookieString = Object.entries(uniqueCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    // Save to Supabase
    const res = await fetch(`${SUPABASE_URL}/functions/v1/save-ra-cookie`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ cookie: cookieString }),
    });

    const data = await res.json();
    return { success: true, ...data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Auto-login to reportaziende.it ──
async function autoLogin() {
  try {
    // Get credentials from Supabase
    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-ra-credentials`, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    const creds = await res.json();
    if (!creds.username || !creds.password) {
      return { success: false, error: "Credenziali non configurate. Vai su Impostazioni → Report Aziende." };
    }

    // Open login page
    const tab = await chrome.tabs.create({
      url: "https://www.reportaziende.it/login",
      active: true,
    });

    // Wait for page load then inject login script
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: fillLogin,
          args: [creds.username, creds.password],
        });
      }
    });

    return { success: true, message: "Login in corso..." };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function fillLogin(username, password) {
  setTimeout(() => {
    const emailField = document.querySelector('input[type="email"], input[name="email"], input[name="username"], input#email, input#username');
    const passField = document.querySelector('input[type="password"]');
    const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');

    if (emailField) {
      emailField.value = username;
      emailField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (passField) {
      passField.value = password;
      passField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (submitBtn) {
      setTimeout(() => submitBtn.click(), 500);
    }
  }, 1500);
}

// ── Message handler ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.source === "ra-content-bridge") {
    if (msg.action === "ping") {
      sendResponse({ success: true, extension: "ra-cookie-sync", version: "1.0" });
    } else if (msg.action === "syncCookies") {
      syncRACookies().then(sendResponse);
      return true; // async
    } else if (msg.action === "autoLogin") {
      autoLogin().then(sendResponse);
      return true;
    } else {
      sendResponse({ success: false, error: "Unknown action" });
    }
  }
  return false;
});
