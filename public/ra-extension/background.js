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
      url: "https://ecommerce2.reportaziende.it/login3/",
      active: true,
    });

    // Wait for login page to load
    await new Promise(function(resolve) {
      const timeout = setTimeout(function() { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 20000);
      function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          setTimeout(resolve, 1500);
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Fill and submit the login form
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillLogin,
      args: [creds.username, creds.password],
    });

    // Wait for form submission and redirect (fillLogin has internal 1.5s + 0.5s delays)
    await new Promise(function(r) { setTimeout(r, 4000); });

    // Wait for navigation after submit
    await new Promise(function(resolve) {
      const timeout = setTimeout(function() { chrome.tabs.onUpdated.removeListener(listener2); resolve(); }, 15000);
      function listener2(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener2);
          clearTimeout(timeout);
          setTimeout(resolve, 2000);
        }
      }
      chrome.tabs.onUpdated.addListener(listener2);
    });

    // Verify the final URL — success means we're NOT on login or error page
    const tabInfo = await chrome.tabs.get(tab.id);
    const finalUrl = tabInfo.url || "";
    if (finalUrl.includes("/login3") || finalUrl.includes("errore_404") || finalUrl.includes("p=login")) {
      return { success: false, error: "Login fallito: la pagina è ancora su login/errore. Verificare le credenziali." };
    }

    // Login successful — sync cookies
    await syncRACookies();

    return { success: true, message: "Login completato con successo." };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function fillLogin(username, password) {
  setTimeout(function() {
    const emailField = document.querySelector('input#username, input[name="username"], input[type="email"], input#email');
    const passField = document.querySelector('input#password, input[type="password"]');
    const submitBtn = document.querySelector('input[type="submit"].btn_blu, input[type="submit"], button[type="submit"]');

    if (emailField) {
      emailField.value = username;
      emailField.dispatchEvent(new Event("input", { bubbles: true }));
      emailField.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (passField) {
      passField.value = password;
      passField.dispatchEvent(new Event("input", { bubbles: true }));
      passField.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // Check "Resta collegato" / remember me
    const rememberMe = document.querySelector('#rememberme, input[name="rememberme"], input[name="remember"]');
    if (rememberMe && !rememberMe.checked) {
      rememberMe.checked = true;
      rememberMe.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (submitBtn) {
      setTimeout(function() { submitBtn.click(); }, 500);
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
  const cookies3 = await chrome.cookies.getAll({ domain: "ecommerce2.reportaziende.it" });
  const allCookies = [...cookies, ...cookies2, ...cookies3];
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

// ══════════════════════════════════════════════
// DISCOVERY: Inspect modals on search.php?tab=2 to find real field names
// ══════════════════════════════════════════════
function discoverFormFields() {
  try {
    const fields = { ateco: [], geography: [], fatturato: [], dipendenti: [], contatti: [], allInputs: [] };

    // Scan all inputs/selects inside the page (including hidden ones inside modals)
    const allInputs = document.querySelectorAll("input, select, textarea");
    for (let i = 0; i < allInputs.length; i++) {
      const el = allInputs[i];
      const info = {
        tag: el.tagName.toLowerCase(),
        type: el.type || "",
        name: el.name || "",
        id: el.id || "",
        placeholder: el.placeholder || "",
        className: el.className || "",
        parentId: el.parentElement ? (el.parentElement.id || "") : "",
      };
      fields.allInputs.push(info);

      // Categorize
      const ctx = (info.name + " " + info.id + " " + info.placeholder + " " + info.parentId).toLowerCase();
      if (ctx.indexOf("ateco") >= 0) fields.ateco.push(info);
      if (ctx.indexOf("region") >= 0 || ctx.indexOf("provincia") >= 0 || ctx.indexOf("comune") >= 0 || ctx.indexOf("geograf") >= 0) fields.geography.push(info);
      if (ctx.indexOf("fatturato") >= 0 || ctx.indexOf("ricav") >= 0) fields.fatturato.push(info);
      if (ctx.indexOf("dipendent") >= 0 || ctx.indexOf("addetti") >= 0) fields.dipendenti.push(info);
      if (ctx.indexOf("contatt") >= 0 || ctx.indexOf("telefon") >= 0 || ctx.indexOf("email") >= 0) fields.contatti.push(info);
    }

    // Also detect modal IDs
    const modals = document.querySelectorAll("[id*='MODAL'], [id*='modal'], .modal");
    fields.modalIds = [];
    for (let m = 0; m < modals.length; m++) {
      fields.modalIds.push(modals[m].id || modals[m].className);
    }

    // Detect forms
    const forms = document.querySelectorAll("form");
    fields.formIds = [];
    for (let f = 0; f < forms.length; f++) {
      fields.formIds.push({ id: forms[f].id || "", action: forms[f].action || "", name: forms[f].name || "" });
    }

    return fields;
  } catch (e) {
    return { error: e.message };
  }
}

// ══════════════════════════════════════════════
// FILL & SUBMIT: Interact with modals on search.php?tab=2
// ══════════════════════════════════════════════
function fillAndSubmitSearchForm(params) {
  // MUST be fully synchronous — chrome.scripting.executeScript cannot resolve Promises
  try {
    // Helper: set input value with events
    function setInput(el, value) {
      if (!el || !value) return false;
      if (typeof el === "string") el = document.querySelector(el);
      if (!el) return false;
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    // Helper: set checkboxes/radios inside a container by matching values
    function setCheckboxes(container, values) {
      if (!values || values.length === 0 || !container) return;
      if (typeof container === "string") container = document.querySelector(container);
      if (!container) return;
      const inputs = container.querySelectorAll("input[type='checkbox'], input[type='radio']");
      for (let i = 0; i < inputs.length; i++) {
        const val = (inputs[i].value || "").toLowerCase();
        let label = "";
        const lbl = inputs[i].parentElement;
        if (lbl) label = (lbl.textContent || "").toLowerCase().trim();
        for (let v = 0; v < values.length; v++) {
          const target = values[v].toLowerCase();
          if (val === target || val.indexOf(target) >= 0 || label.indexOf(target) >= 0) {
            inputs[i].checked = true;
            inputs[i].dispatchEvent(new Event("change", { bubbles: true }));
            break;
          }
        }
      }
    }

    // Helper: find input by label match inside a container
    function setInputByLabel(container, labelMatch, value) {
      if (!value || !container) return;
      if (typeof container === "string") container = document.querySelector(container);
      if (!container) return;
      const inputs = container.querySelectorAll("input[type='text'], input[type='number'], input:not([type='checkbox']):not([type='radio']):not([type='hidden'])");
      for (let i = 0; i < inputs.length; i++) {
        let ctx = ((inputs[i].name || "") + " " + (inputs[i].id || "") + " " + (inputs[i].placeholder || "")).toLowerCase();
        const parent = inputs[i].closest(".form-group, .input-group, label, .row");
        if (parent) ctx += " " + (parent.textContent || "").toLowerCase();
        if (ctx.indexOf(labelMatch) >= 0) {
          setInput(inputs[i], String(value));
          return;
        }
      }
    }

    // All modal elements are already in the DOM (even when hidden).
    // We set values directly without opening them.

    // ── 1. ATECO ──
    if (params.atecoCode || (params.atecoCodes && params.atecoCodes.length > 0)) {
      const codes = params.atecoCodes || [params.atecoCode];
      const atecoModalIds = ["#MODALsettoreAteco", "#modalAteco", "#modal-ateco", "#MODALateco"];
      let atecoSet = false;
      for (let am = 0; am < atecoModalIds.length; am++) {
        const atecoModal = document.querySelector(atecoModalIds[am]);
        if (atecoModal) {
          const atecoInput = atecoModal.querySelector("input[type='text'], input[type='search'], input:not([type='checkbox']):not([type='radio']):not([type='hidden'])");
          if (atecoInput && codes.length > 0) setInput(atecoInput, codes[0]);
          setCheckboxes(atecoModal, codes);
          atecoSet = true;
          break;
        }
      }
      if (!atecoSet) {
        const atecoHidden = document.querySelector("input[name*='ateco'], input[name*='Ateco'], input[name*='ATECO']");
        if (atecoHidden) setInput(atecoHidden, codes.join(","));
      }
    }

    // ── 2. GEOGRAPHY ──
    const regions = params.regions || (params.region ? [params.region] : []);
    const provinces = params.provinces || (params.province ? [params.province] : []);
    if (regions.length > 0 || provinces.length > 0) {
      const geoModalIds = ["#MODALgeografica", "#modalGeografica", "#modal-geografia", "#MODALgeografia"];
      let geoSet = false;
      for (let gm = 0; gm < geoModalIds.length; gm++) {
        const geoModal = document.querySelector(geoModalIds[gm]);
        if (geoModal) {
          if (regions.length > 0) setCheckboxes(geoModal, regions);
          if (provinces.length > 0) setCheckboxes(geoModal, provinces);
          geoSet = true;
          break;
        }
      }
      if (!geoSet) {
        const regInput = document.querySelector("input[name*='regione'], input[name*='Regione']");
        if (regInput && regions.length > 0) setInput(regInput, regions.join(","));
        const provInput = document.querySelector("input[name*='provincia'], input[name*='Provincia']");
        if (provInput && provinces.length > 0) setInput(provInput, provinces.join(","));
      }
    }

    // ── 3. FATTURATO ──
    if (params.filters && (params.filters.fatturato_min || params.filters.fatturato_max)) {
      const fatModalIds = ["#MODALfatturato", "#modalFatturato", "#modal-fatturato"];
      for (let fm = 0; fm < fatModalIds.length; fm++) {
        const fatModal = document.querySelector(fatModalIds[fm]);
        if (fatModal) {
          setInputByLabel(fatModal, "min", params.filters.fatturato_min);
          setInputByLabel(fatModal, "max", params.filters.fatturato_max);
          break;
        }
      }
    }

    // ── 4. DIPENDENTI ──
    if (params.filters && (params.filters.dipendenti_min || params.filters.dipendenti_max)) {
      const dipModalIds = ["#MODALnumeroDipendenti", "#modalDipendenti", "#modal-dipendenti"];
      for (let dm = 0; dm < dipModalIds.length; dm++) {
        const dipModal = document.querySelector(dipModalIds[dm]);
        if (dipModal) {
          setInputByLabel(dipModal, "min", params.filters.dipendenti_min);
          setInputByLabel(dipModal, "max", params.filters.dipendenti_max);
          break;
        }
      }
    }

    // ── 5. CONTATTI ──
    if (params.filters && (params.filters.has_phone_and_email || params.filters.has_phone || params.filters.has_email)) {
      const contModalIds = ["#MODALcontatti", "#modalContatti", "#modal-contatti"];
      for (let cm2 = 0; cm2 < contModalIds.length; cm2++) {
        const contModal = document.querySelector(contModalIds[cm2]);
        if (contModal) {
          const contValues = [];
          if (params.filters.has_phone_and_email) contValues.push("telefono e email", "entrambi", "tel e email");
          else {
            if (params.filters.has_phone) contValues.push("telefono", "tel");
            if (params.filters.has_email) contValues.push("email", "e-mail");
          }
          setCheckboxes(contModal, contValues);
          break;
        }
      }
    }

    // ── 6. SUBMIT ──
    const form = document.querySelector("#cercaAvanzataForm, form[name='cercaAvanzata'], form[action*='search']");
    if (form) {
      form.submit();
      return { submitted: true, method: "form.submit" };
    }
    // Fallback: click search button
    let searchBtn = document.querySelector(".btn-search, #btnCerca, button.cerca, a.cerca");
    if (!searchBtn) {
      const allBtns = document.querySelectorAll("button, a.btn");
      for (let sb = 0; sb < allBtns.length; sb++) {
        if ((allBtns[sb].textContent || "").trim().toLowerCase() === "cerca") {
          searchBtn = allBtns[sb];
          break;
        }
      }
    }
    if (searchBtn) {
      searchBtn.click();
      return { submitted: true, method: "button.click" };
    }
    // Last resort
    const anyForm = document.querySelector("form");
    if (anyForm) {
      anyForm.submit();
      return { submitted: true, method: "anyForm.submit" };
    }
    return { submitted: false, error: "Nessun form o pulsante Cerca trovato" };
  } catch (e) {
    return { submitted: false, error: e.message };
  }
}

// Extract search results from RA DataTable (injected into the results page)
function extractSearchResults() {
  const results = [];
  try {
    // RA uses DataTables - look for the results table
    let targetTable = null;

    // Try specific DataTable selectors first
    targetTable = document.querySelector("#DataTables_Table_0, .dataTable, table.display, table.table-striped");
    
    if (!targetTable) {
      // Fallback: find table with company links
      const tables = document.querySelectorAll("table");
      for (let t = 0; t < tables.length; t++) {
        const tbodyRows = tables[t].querySelectorAll("tbody tr");
        if (tbodyRows.length > 0 && tables[t].querySelector("a[href]")) {
          targetTable = tables[t];
          break;
        }
      }
    }

    if (!targetTable) {
      // Last fallback: DataTable wrapper
      const dtWrapper = document.querySelector(".dataTables_wrapper");
      if (dtWrapper) targetTable = dtWrapper.querySelector("table");
    }

    if (targetTable) {
      const rows = targetTable.querySelectorAll("tbody tr");
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll("td");
        if (cells.length < 2) continue;

        // Find the link to the company profile
        const link = row.querySelector("a[href]");
        if (!link) continue;

        const name = link.textContent.trim();
        let href = link.getAttribute("href");
        if (!name || !href) continue;
        if (!href.startsWith("http")) {
          href = "https://www.reportaziende.it" + (href.startsWith("/") ? "" : "/") + href;
        }

        // Extract P.IVA (11 digits) and city from cells
        let piva = null;
        let city = null;
        let province = null;
        let ateco = null;
        for (let c = 0; c < cells.length; c++) {
          const cellText = cells[c].textContent.trim();
          // P.IVA is 11 digits
          const pivaMatch = cellText.match(/\b(\d{11})\b/);
          if (pivaMatch && !piva) piva = pivaMatch[1];
          // Province: 2-letter code in parentheses like (MI) or standalone
          const provMatch = cellText.match(/\(([A-Z]{2})\)/);
          if (provMatch && !province) province = provMatch[1];
          // City: short text that's not a number and not the company name
          if (!city && cellText.length > 1 && cellText.length < 50 && !/^\d+$/.test(cellText) && cellText !== name && !/\d{11}/.test(cellText) && !/^[A-Z]{2}$/.test(cellText)) {
            city = cellText;
          }
          // ATECO code pattern: XX.XX.XX
          const atecoMatch = cellText.match(/\b(\d{2}\.\d{2}(?:\.\d{1,2})?)\b/);
          if (atecoMatch && !ateco) ateco = atecoMatch[1];
        }

        results.push({ name: name, url: href, piva: piva, city: city, province: province, ateco: ateco });
      }
    }

    // Detect total results count
    let totalText = "";
    let totalCount = 0;
    const infoEl = document.querySelector(".dataTables_info, .risultati, .total-results, .search-results-count");
    if (infoEl) {
      totalText = infoEl.textContent.trim();
      // Try to parse number like "1.234 risultati" or "Showing 1 to 25 of 1,234"
      const numMatch = totalText.match(/(?:di|of|totale|trovate?|risultati?:?)\s*([\d.,]+)/i) || totalText.match(/([\d.,]+)\s*(?:risultati|aziende|record)/i);
      if (numMatch) {
        totalCount = parseInt(numMatch[1].replace(/[.,]/g, ""), 10) || 0;
      }
    }

    // Detect pagination
    let hasNextPage = false;
    const nextBtn = document.querySelector(".paginate_button.next:not(.disabled), a.next:not(.disabled), a[rel='next'], .page-item.next:not(.disabled) a");
    if (nextBtn && !nextBtn.classList.contains("disabled")) hasNextPage = true;

    // Also detect CTA gate (paywall modal) as sign of no session
    const ctaGate = document.querySelector("#modalCTAGate, .cta-gate, .paywall-modal");
    const ctaVisible = ctaGate && (ctaGate.style.display !== "none" && ctaGate.classList.contains("show"));

    return { results: results, hasNextPage: hasNextPage, totalText: totalText, totalCount: totalCount, ctaGateDetected: !!ctaVisible };
  } catch (e) {
    return { results: [], hasNextPage: false, totalText: "", totalCount: 0, error: e.message };
  }
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
    if (tabInfo.url && (tabInfo.url.includes("/login3") || tabInfo.url.includes("errore_404"))) {
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

// ── Helper: detect session-expired URLs ──
function isSessionExpiredUrl(url) {
  if (!url) return false;
  return (
    url.includes("errore_404") ||
    url.includes("p=login")
  );
}

// ── Helper: open a tab, wait for load, and check session; auto-login + retry once ──
async function openTabWithSessionCheck(url) {
  let tab = await chrome.tabs.create({ url: url, active: false });
  await new Promise(function(resolve) {
    const timeout = setTimeout(function() { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 20000);
    function listener(tabId, info) {
      if (tabId === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        setTimeout(resolve, 2500);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });

  let tabInfo = await chrome.tabs.get(tab.id);
  if (isSessionExpiredUrl(tabInfo.url)) {
    // Session expired — close tab, attempt auto-login, retry once
    await chrome.tabs.remove(tab.id);
    addLog("⚠️ Sessione scaduta, tentativo auto-login...");
    const loginResult = await autoLogin();
    if (!loginResult.success) {
      return { tab: null, error: "session_expired", loginError: loginResult.error };
    }
    // Wait for login to complete (tab opens, fills form, submits)
    await new Promise(function(r) { setTimeout(r, 12000); });
    // Sync cookies after login
    await syncRACookies();
    await new Promise(function(r) { setTimeout(r, 2000); });

    // Retry opening the target page
    addLog("🔄 Riprovo dopo auto-login...");
    tab = await chrome.tabs.create({ url: url, active: false });
    await new Promise(function(resolve) {
      const timeout = setTimeout(function() { chrome.tabs.onUpdated.removeListener(listener2); resolve(); }, 20000);
      function listener2(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener2);
          clearTimeout(timeout);
          setTimeout(resolve, 2500);
        }
      }
      chrome.tabs.onUpdated.addListener(listener2);
    });

    tabInfo = await chrome.tabs.get(tab.id);
    if (isSessionExpiredUrl(tabInfo.url)) {
      await chrome.tabs.remove(tab.id);
      return { tab: null, error: "session_expired", reason: "Auto-login fallito. Effettua il login manualmente su ReportAziende." };
    }
  }

  return { tab: tab, error: null };
}

// Run field discovery on the search page (one-time diagnostic)
async function runDiscoverFields() {
  try {
    const result = await openTabWithSessionCheck("https://www.reportaziende.it/search.php?tab=2");
    if (result.error) return { success: false, error: result.error, reason: result.reason };
    const tab = result.tab;
    const [scriptResult] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: discoverFormFields });
    await chrome.tabs.remove(tab.id);
    return { success: true, fields: scriptResult ? scriptResult.result : null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Search for companies using Ricerca Avanzata (search.php?tab=2) with modal interaction
async function scrapeSearchResults(params) {
  let tab = null;
  try {
    // Navigate with session check + auto-login retry
    const openResult = await openTabWithSessionCheck("https://www.reportaziende.it/search.php?tab=2");
    if (openResult.error) {
      return { success: false, error: openResult.error, results: [], reason: openResult.reason };
    }
    tab = openResult.tab;

    // Inject the form-filling script (interacts with modals) and submit
    const [fillResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillAndSubmitSearchForm,
      args: [params],
    });

    const fillData = fillResult && fillResult.result;
    if (fillData && !fillData.submitted) {
      await chrome.tabs.remove(tab.id); tab = null;
      return { success: false, error: "Form non compilato: " + (fillData.error || "sconosciuto"), results: [] };
    }

    // Wait for results page to load after form submission
    await new Promise(function(resolve) {
      const timeout = setTimeout(function() {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 25000);
      function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          setTimeout(resolve, 3000); // Extra wait for DataTable to render
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Check for login redirect after form submit
    const tabInfo = await chrome.tabs.get(tab.id);
    if (isSessionExpiredUrl(tabInfo.url)) {
      await chrome.tabs.remove(tab.id); tab = null;
      return { success: false, error: "session_expired", results: [] };
    }

    // Extract results from the DataTable
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractSearchResults,
    });

    await chrome.tabs.remove(tab.id); tab = null;

    if (result && result.result) {
      // Check if CTA gate was detected (paywall = not properly logged in)
      if (result.result.ctaGateDetected && (!result.result.results || result.result.results.length === 0)) {
        return { success: false, error: "session_expired", results: [], reason: "CTA gate detected" };
      }
      return { success: true, ...result.result };
    }
    return { success: false, error: "Nessun risultato estratto", results: [] };
  } catch (err) {
    if (tab) try { await chrome.tabs.remove(tab.id); } catch(e) {}
    return { success: false, error: err.message, results: [] };
  }
}

// Search Only: get list without scraping profiles
async function runSearchOnly(params) {
  if (scrapingState.active) return { success: false, error: "Scraping già in corso" };
  resetState(); scrapingState.active = true;
  addLog("Avvio ricerca lista aziende...");
  const delay = (params.delaySeconds || 20) * 1000;
  const atecoCodes = params.atecoCodes || (params.atecoCode ? [params.atecoCode] : []);
  const regions = params.regions || (params.region ? [params.region] : []);
  const provinces = params.provinces || (params.province ? [params.province] : []);
  try {
    let allResults = [];
    for (let ai = 0; ai < atecoCodes.length; ai++) {
      if (scrapingState.stopped) break;
      const ateco = atecoCodes[ai];
      const regList = regions.length > 0 ? regions : [""];
      const provList = provinces.length > 0 ? provinces : [""];
      for (let ri = 0; ri < regList.length; ri++) {
        for (let pi = 0; pi < provList.length; pi++) {
          if (scrapingState.stopped) break;
          let page = 1, hasMore = true;
          while (hasMore && !scrapingState.stopped) {
            addLog("Ricerca: ATECO=" + ateco + (regList[ri] ? " Reg=" + regList[ri] : "") + " pag." + page);
            const sr = await scrapeSearchResults({ atecoCode: ateco, region: regList[ri] || undefined, province: provList[pi] || undefined, filters: params.filters, page: page });
            if (!sr.success) { if (sr.error === "session_expired") { addLog("⚠️ Sessione scaduta!"); scrapingState.active = false; return { success: false, error: "session_expired", results: allResults, log: scrapingState.log.slice(-50) }; } addLog("Errore: " + sr.error); break; }
            if (sr.results && sr.results.length > 0) { allResults = allResults.concat(sr.results); addLog("Trovate " + sr.results.length + " (tot: " + allResults.length + ")"); }
            hasMore = sr.hasNextPage && sr.results && sr.results.length > 0; page++;
            if (hasMore) await new Promise(function(r) { setTimeout(r, delay); });
            if (allResults.length >= 2000) { addLog("Limite 2000 raggiunto."); hasMore = false; }
          }
        }
      }
    }
    addLog("Ricerca completata: " + allResults.length + " aziende trovate.");
    scrapingState.active = false;
    return { success: true, results: allResults, total: allResults.length, log: scrapingState.log.slice(-50) };
  } catch (err) { addLog("Errore: " + err.message); scrapingState.active = false; return { success: false, error: err.message, results: [], log: scrapingState.log.slice(-50) }; }
}

// Scrape Selected: scrape only specific URLs chosen by user
async function runScrapeSelected(params) {
  if (scrapingState.active) return { success: false, error: "Scraping già in corso" };
  const items = params.items || [];
  if (items.length === 0) return { success: false, error: "Nessun elemento" };
  resetState(); scrapingState.active = true; scrapingState.total = items.length;
  addLog("Scraping " + items.length + " profili selezionati");
  let delay = (params.delaySeconds || 20) * 1000, batchSize = params.batchSize || 5, batch = [], LONG_PAUSE_EVERY = 10, LONG_PAUSE_MS = 45000;
  try {
    for (let i = 0; i < items.length; i++) {
      if (scrapingState.stopped) { addLog("Interrotto."); break; }
      scrapingState.currentCompany = items[i].name; scrapingState.processed = i + 1;
      addLog("Scraping " + (i+1) + "/" + items.length + ": " + items[i].name);
      const pr = await scrapeCompanyProfile(items[i].url);
      if (pr.success && pr.data) { batch.push(pr.data); addLog("✅ " + items[i].name); }
      else { scrapingState.errors++; if (pr.error === "session_expired") { addLog("⚠️ Sessione scaduta!"); if (batch.length > 0) await saveBatch(batch); scrapingState.active = false; return { success: false, error: "session_expired", saved: scrapingState.saved }; } addLog("❌ " + items[i].name); }
      if (batch.length >= batchSize) { await saveBatch(batch); batch = []; }
      if (i < items.length - 1 && !scrapingState.stopped) { var jit = delay * (0.8 + Math.random() * 0.8); if (LONG_PAUSE_EVERY > 0 && (i + 1) % LONG_PAUSE_EVERY === 0) { addLog("⏸️ Pausa lunga (" + (LONG_PAUSE_MS/1000) + "s) dopo " + (i+1) + " profili..."); await new Promise(function(r) { setTimeout(r, LONG_PAUSE_MS); }); } else { await new Promise(function(r) { setTimeout(r, jit); }); } }
    }
    if (batch.length > 0) await saveBatch(batch);
    addLog("Completato. Salvati: " + scrapingState.saved + ", Errori: " + scrapingState.errors);
    scrapingState.active = false;
    return { success: true, total: scrapingState.total, saved: scrapingState.saved, errors: scrapingState.errors };
  } catch (err) { addLog("Errore: " + err.message); scrapingState.active = false; return { success: false, error: err.message }; }
}

// Batch scrape: search + profile extraction
async function runBatchScrape(params) {
  if (scrapingState.active) {
    return { success: false, error: "Scraping già in corso" };
  }

  resetState();
  scrapingState.active = true;
  addLog("Avvio scraping batch: ATECO=" + (params.atecoCode || "tutti"));

  const delay = (params.delaySeconds || 20) * 1000;
  const batchSize = params.batchSize || 5;
  const LONG_PAUSE_EVERY = 10;
  const LONG_PAUSE_MS = 45000;

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

      // Delay between requests with long pause every N profiles
      if (i < allResults.length - 1 && !scrapingState.stopped) {
        if (LONG_PAUSE_EVERY > 0 && (i + 1) % LONG_PAUSE_EVERY === 0) {
          addLog("⏸️ Pausa lunga (" + (LONG_PAUSE_MS/1000) + "s) dopo " + (i+1) + " profili...");
          await new Promise((r) => setTimeout(r, LONG_PAUSE_MS));
        } else {
          const jitter = delay * (0.8 + Math.random() * 0.8);
          await new Promise((r) => setTimeout(r, jitter));
        }
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
      sendResponse({ success: true, extension: "ra-cookie-sync", version: "3.0" });
    } else if (msg.action === "discoverFields") {
      runDiscoverFields().then(sendResponse);
      return true;
    } else if (msg.action === "syncCookies") {
      syncRACookies().then(sendResponse);
      return true;
    } else if (msg.action === "autoLogin") {
      autoLogin().then(sendResponse);
      return true;
    } else if (msg.action === "scrapeByAteco") {
      runBatchScrape(msg.params || {}).then(sendResponse);
      return true;
    } else if (msg.action === "searchOnly") {
      runSearchOnly(msg.params || {}).then(sendResponse);
      return true;
    } else if (msg.action === "scrapeSelected") {
      runScrapeSelected(msg.params || {}).then(sendResponse);
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
