// ══════════════════════════════════════════════
// ReportAziende Cookie Sync + Scraper - Background Service Worker
// ══════════════════════════════════════════════

const SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

// ── Scraping state ──
let scrapingState = {
  active: false,
  stopped: false,
  total: 0,
  processed: 0,
  saved: 0,
  errors: 0,
  currentCompany: "",
  log: [],
};

function resetState() {
  scrapingState = { active: false, stopped: false, total: 0, processed: 0, saved: 0, errors: 0, currentCompany: "", log: [] };
}

function addLog(msg) {
  scrapingState.log.push({ time: new Date().toISOString(), msg });
  if (scrapingState.log.length > 200) scrapingState.log.shift();
}

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

    const uniqueCookies = {};
    allCookies.forEach((c) => { uniqueCookies[c.name] = c.value; });
    const cookieString = Object.entries(uniqueCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

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

    const tab = await chrome.tabs.create({
      url: "https://www.reportaziende.it/login",
      active: true,
    });

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

// ══════════════════════════════════════════════
// SCRAPING FUNCTIONS
// ══════════════════════════════════════════════

// Fetch a page with RA cookies
async function fetchWithCookies(url) {
  const cookies = await chrome.cookies.getAll({ domain: ".reportaziende.it" });
  const cookies2 = await chrome.cookies.getAll({ domain: "reportaziende.it" });
  const allCookies = [...cookies, ...cookies2];
  const uniqueCookies = {};
  allCookies.forEach((c) => { uniqueCookies[c.name] = c.value; });
  const cookieStr = Object.entries(uniqueCookies).map(([k, v]) => `${k}=${v}`).join("; ");

  const res = await fetch(url, {
    headers: { "Cookie": cookieStr },
    credentials: "include",
  });
  return res;
}

// Extract company profile data by injecting a script into the tab
function extractProfileData() {
  // This function runs inside the RA company profile page
  const getText = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : null;
  };

  const getTableValue = (label) => {
    const rows = document.querySelectorAll("tr, .row, .info-row, dt, .field-label");
    for (const row of rows) {
      const text = row.textContent || "";
      if (text.toLowerCase().includes(label.toLowerCase())) {
        const valueEl = row.querySelector("td:last-child, dd, .field-value, span.value");
        if (valueEl) return valueEl.textContent.trim();
        // Try next sibling
        const next = row.nextElementSibling;
        if (next) return next.textContent.trim();
        // Try extracting from same row
        const parts = text.split(/[:\t]/);
        if (parts.length > 1) return parts.slice(1).join(":").trim();
      }
    }
    return null;
  };

  const parseCurrency = (str) => {
    if (!str) return null;
    const cleaned = str.replace(/[€.\s]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const parseInteger = (str) => {
    if (!str) return null;
    const cleaned = str.replace(/[.\s]/g, "");
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  };

  // Extract management/contacts
  const contacts = [];
  const managementSection = document.querySelectorAll("table");
  for (const table of managementSection) {
    const headerText = (table.previousElementSibling || {}).textContent || "";
    if (headerText.toLowerCase().includes("esponent") || headerText.toLowerCase().includes("management") || headerText.toLowerCase().includes("amministrat")) {
      const rows = table.querySelectorAll("tr");
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 2) {
          const name = cells[0] ? cells[0].textContent.trim() : "";
          const role = cells[1] ? cells[1].textContent.trim() : "";
          const cf = cells[2] ? cells[2].textContent.trim() : null;
          if (name && name.length > 2) {
            contacts.push({ name, role, codice_fiscale: cf });
          }
        }
      }
    }
  }

  // Try to find company name from heading
  const companyName = getText("h1") || getText(".company-name") || getText(".ragione-sociale") || document.title.split(" - ")[0] || "";

  const result = {
    company_name: companyName,
    partita_iva: getTableValue("partita iva") || getTableValue("p. iva") || getTableValue("p.iva"),
    codice_fiscale: getTableValue("codice fiscale") || getTableValue("c.f."),
    address: getTableValue("indirizzo") || getTableValue("sede"),
    cap: getTableValue("cap"),
    city: getTableValue("comune") || getTableValue("città") || getTableValue("citta"),
    province: getTableValue("provincia"),
    region: getTableValue("regione"),
    phone: getTableValue("telefono") || getTableValue("tel"),
    email: getTableValue("email") || getTableValue("e-mail"),
    pec: getTableValue("pec"),
    website: getTableValue("sito") || getTableValue("sito web") || getTableValue("website"),
    fatturato: parseCurrency(getTableValue("fatturato") || getTableValue("ricavi")),
    utile: parseCurrency(getTableValue("utile") || getTableValue("risultato")),
    dipendenti: parseInteger(getTableValue("dipendenti") || getTableValue("addetti")),
    anno_bilancio: parseInteger(getTableValue("anno bilancio") || getTableValue("anno")),
    codice_ateco: getTableValue("codice ateco") || getTableValue("ateco"),
    descrizione_ateco: getTableValue("descrizione ateco") || getTableValue("attività"),
    forma_giuridica: getTableValue("forma giuridica") || getTableValue("natura giuridica"),
    data_costituzione: getTableValue("data costituzione") || getTableValue("costituzione"),
    rating_affidabilita: getTableValue("rating") || getTableValue("affidabilità"),
    credit_score: parseCurrency(getTableValue("credit score") || getTableValue("score")),
    contacts,
    raw_profile_html: document.documentElement.outerHTML,
    source: "reportaziende",
  };

  return result;
}

// Extract search results list from a search page
function extractSearchResults() {
  const results = [];
  // Try various common patterns for result lists
  const rows = document.querySelectorAll("table tbody tr, .result-item, .company-row, .search-result");
  for (const row of rows) {
    const link = row.querySelector("a[href*='/azienda/'], a[href*='/company/'], a[href*='reportaziende.it/']");
    if (link) {
      const name = link.textContent.trim();
      let href = link.getAttribute("href");
      if (href && !href.startsWith("http")) {
        href = "https://www.reportaziende.it" + (href.startsWith("/") ? "" : "/") + href;
      }
      if (name && href) {
        results.push({ name, url: href });
      }
    }
  }

  // Also try to detect pagination
  const nextLink = document.querySelector("a.next, a[rel='next'], .pagination a:last-child, a[aria-label='Next']");
  const nextUrl = nextLink ? nextLink.getAttribute("href") : null;

  return { results, nextUrl, totalText: document.querySelector(".total-results, .risultati")?.textContent || "" };
}

// Scrape a single company profile
async function scrapeCompanyProfile(url) {
  try {
    const tab = await chrome.tabs.create({ url, active: false });

    // Wait for page load
    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(resolve, 2000); // Extra wait for JS rendering
        }
      });
    });

    // Check if redirected to login (session expired)
    const tabInfo = await chrome.tabs.get(tab.id);
    if (tabInfo.url && tabInfo.url.includes("/login")) {
      await chrome.tabs.remove(tab.id);
      return { success: false, error: "session_expired", data: null };
    }

    // Inject extraction script
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractProfileData,
    });

    await chrome.tabs.remove(tab.id);

    if (result && result.result) {
      return { success: true, data: result.result };
    }
    return { success: false, error: "No data extracted", data: null };
  } catch (err) {
    return { success: false, error: err.message, data: null };
  }
}

// Search for companies by ATECO code and optional filters
async function scrapeSearchResults(params) {
  try {
    // Build search URL
    let searchUrl = "https://www.reportaziende.it/ricerca-personalizzata?";
    const qp = [];
    if (params.atecoCode) qp.push("ateco=" + encodeURIComponent(params.atecoCode));
    if (params.region) qp.push("regione=" + encodeURIComponent(params.region));
    if (params.province) qp.push("provincia=" + encodeURIComponent(params.province));
    if (params.minFatturato) qp.push("fatturato_min=" + params.minFatturato);
    if (params.maxFatturato) qp.push("fatturato_max=" + params.maxFatturato);
    if (params.page) qp.push("page=" + params.page);
    searchUrl += qp.join("&");

    const tab = await chrome.tabs.create({ url: searchUrl, active: false });

    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(resolve, 2000);
        }
      });
    });

    // Check session
    const tabInfo = await chrome.tabs.get(tab.id);
    if (tabInfo.url && tabInfo.url.includes("/login")) {
      await chrome.tabs.remove(tab.id);
      return { success: false, error: "session_expired", results: [] };
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractSearchResults,
    });

    await chrome.tabs.remove(tab.id);

    if (result && result.result) {
      return { success: true, ...result.result };
    }
    return { success: false, error: "No results extracted", results: [] };
  } catch (err) {
    return { success: false, error: err.message, results: [] };
  }
}

// Batch scrape: search + profile extraction
async function runBatchScrape(params) {
  if (scrapingState.active) {
    return { success: false, error: "Scraping già in corso" };
  }

  resetState();
  scrapingState.active = true;
  addLog("Avvio scraping batch: ATECO=" + (params.atecoCode || "tutti"));

  const delay = (params.delaySeconds || 10) * 1000;
  const batchSize = params.batchSize || 5;

  try {
    // Step 1: Get search results (all pages)
    let allResults = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && !scrapingState.stopped) {
      addLog("Ricerca pagina " + page + "...");
      const searchRes = await scrapeSearchResults({ ...params, page });

      if (!searchRes.success) {
        if (searchRes.error === "session_expired") {
          addLog("⚠️ Sessione scaduta! Fai login e riprova.");
          scrapingState.active = false;
          return { success: false, error: "session_expired" };
        }
        addLog("Errore ricerca: " + searchRes.error);
        break;
      }

      if (searchRes.results && searchRes.results.length > 0) {
        allResults = allResults.concat(searchRes.results);
        addLog("Trovate " + searchRes.results.length + " aziende (pagina " + page + ")");
      }

      hasMore = !!searchRes.nextUrl && searchRes.results && searchRes.results.length > 0;
      page++;

      if (hasMore) {
        await new Promise((r) => setTimeout(r, delay));
      }

      // Limit to max 500 results per run
      if (allResults.length >= 500) {
        addLog("Limite 500 risultati raggiunto.");
        break;
      }
    }

    if (allResults.length === 0) {
      addLog("Nessun risultato trovato.");
      scrapingState.active = false;
      return { success: true, message: "Nessun risultato", saved: 0 };
    }

    scrapingState.total = allResults.length;
    addLog("Totale aziende da scrapare: " + allResults.length);

    // Step 2: Scrape each profile
    let batch = [];

    for (let i = 0; i < allResults.length; i++) {
      if (scrapingState.stopped) {
        addLog("Scraping interrotto dall'utente.");
        break;
      }

      const item = allResults[i];
      scrapingState.currentCompany = item.name;
      scrapingState.processed = i + 1;
      addLog("Scraping " + (i + 1) + "/" + allResults.length + ": " + item.name);

      const profileRes = await scrapeCompanyProfile(item.url);

      if (profileRes.success && profileRes.data) {
        batch.push(profileRes.data);
        addLog("✅ " + item.name);
      } else {
        scrapingState.errors++;
        if (profileRes.error === "session_expired") {
          addLog("⚠️ Sessione scaduta!");
          scrapingState.active = false;
          // Save what we have
          if (batch.length > 0) await saveBatch(batch);
          return { success: false, error: "session_expired", saved: scrapingState.saved };
        }
        addLog("❌ " + item.name + ": " + (profileRes.error || "errore"));
      }

      // Save batch
      if (batch.length >= batchSize) {
        await saveBatch(batch);
        batch = [];
      }

      // Delay between requests
      if (i < allResults.length - 1 && !scrapingState.stopped) {
        // Add some randomness ±30%
        const jitter = delay * (0.7 + Math.random() * 0.6);
        await new Promise((r) => setTimeout(r, jitter));
      }
    }

    // Save remaining batch
    if (batch.length > 0) {
      await saveBatch(batch);
    }

    addLog("Scraping completato. Salvati: " + scrapingState.saved + ", Errori: " + scrapingState.errors);
    scrapingState.active = false;

    return {
      success: true,
      total: scrapingState.total,
      saved: scrapingState.saved,
      errors: scrapingState.errors,
    };
  } catch (err) {
    addLog("Errore fatale: " + err.message);
    scrapingState.active = false;
    return { success: false, error: err.message };
  }
}

async function saveBatch(prospects) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/save-ra-prospects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ prospects }),
    });
    const data = await res.json();
    if (data.success) {
      scrapingState.saved += data.saved || prospects.length;
      addLog("💾 Batch salvato: " + (data.saved || prospects.length) + " prospect");
    } else {
      addLog("⚠️ Errore salvataggio batch: " + (data.message || "sconosciuto"));
    }
  } catch (err) {
    addLog("⚠️ Errore salvataggio: " + err.message);
  }
}

// ── Message handler ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.source === "ra-content-bridge") {
    if (msg.action === "ping") {
      sendResponse({ success: true, extension: "ra-cookie-sync", version: "2.0" });
    } else if (msg.action === "syncCookies") {
      syncRACookies().then(sendResponse);
      return true;
    } else if (msg.action === "autoLogin") {
      autoLogin().then(sendResponse);
      return true;
    } else if (msg.action === "scrapeByAteco") {
      runBatchScrape(msg.params || {}).then(sendResponse);
      return true;
    } else if (msg.action === "scrapeCompany") {
      scrapeCompanyProfile(msg.url).then(sendResponse);
      return true;
    } else if (msg.action === "getScrapingStatus") {
      sendResponse({
        success: true,
        active: scrapingState.active,
        total: scrapingState.total,
        processed: scrapingState.processed,
        saved: scrapingState.saved,
        errors: scrapingState.errors,
        currentCompany: scrapingState.currentCompany,
        log: scrapingState.log.slice(-30),
      });
    } else if (msg.action === "stopScraping") {
      scrapingState.stopped = true;
      addLog("Stop richiesto dall'utente.");
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "Unknown action" });
    }
  }
  return false;
});
