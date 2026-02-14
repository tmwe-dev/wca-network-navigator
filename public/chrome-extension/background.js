// ══════════════════════════════════════════════════
// WCA Cookie Sync - Background Service Worker
// Handles automated contact extraction, session verification, and cookie sync
// ══════════════════════════════════════════════════

var SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

// ── Extract contacts from a WCA profile page (injected into tab) ──
function extractContactsFromPage() {
  try {
    var result = { wcaId: null, contacts: [], companyName: null };

    var urlMatch = window.location.href.match(/\/directory\/members\/(\d+)/i);
    if (urlMatch) result.wcaId = parseInt(urlMatch[1]);

    var h1 = document.querySelector("h1");
    if (h1) result.companyName = h1.textContent.trim();

    var allRows = document.querySelectorAll("[class*='contactperson_row'], .contactperson_row, tr.contactperson_row, div.contactperson_row");

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

      var labels = row.querySelectorAll("[class*='profile_label']");
      for (var l = 0; l < labels.length; l++) {
        var labelText = labels[l].textContent.trim().replace(/:$/, "");
        var valEl = labels[l].nextElementSibling;
        if (!valEl || (valEl.className && valEl.className.indexOf("profile_val") < 0)) {
          var parent = labels[l].parentElement;
          if (parent) {
            var next = parent.nextElementSibling;
            if (next) {
              valEl = next.querySelector("[class*='profile_val']") || next;
            }
          }
        }

        var value = valEl ? valEl.textContent.trim() : "";
        if (/Members\s*only/i.test(value) || /please.*Login/i.test(value)) value = "";

        if (/^Title$/i.test(labelText)) contact.title = value;
        else if (/^Name$/i.test(labelText)) contact.name = value;
        else if (/^Email$/i.test(labelText)) {
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

// ── Check if a page has real authenticated contact data ──
function checkSessionOnPage() {
  try {
    // Check if the page has a login prompt
    var bodyText = document.body.innerText || "";
    if (/please.*log\s*in/i.test(bodyText) || /sign\s*in.*to.*continue/i.test(bodyText)) {
      return { authenticated: false, reason: "login_prompt" };
    }

    // Check for real contact rows with data (not "Members only")
    var contactRows = document.querySelectorAll("[class*='contactperson_row']");
    if (contactRows.length === 0) {
      // Fallback scan
      var allEls = document.querySelectorAll("*");
      var rows = [];
      for (var i = 0; i < allEls.length; i++) {
        if (allEls[i].className && typeof allEls[i].className === "string" && allEls[i].className.indexOf("contactperson_row") >= 0) {
          rows.push(allEls[i]);
        }
      }
      contactRows = rows;
    }

    if (contactRows.length === 0) {
      // Page loaded but no contact rows — could be a profile without contacts
      // Check if HTML is substantial (not a redirect page)
      return { authenticated: document.body.innerHTML.length > 5000, reason: "no_contact_rows_but_page_loaded" };
    }

    // Check if any contact has real email (not "Members only")
    var hasRealData = false;
    for (var r = 0; r < contactRows.length; r++) {
      var text = contactRows[r].innerText || "";
      if (text.indexOf("@") >= 0 && !/Members\s*only/i.test(text)) {
        hasRealData = true;
        break;
      }
    }

    return { authenticated: hasRealData || contactRows.length > 0, reason: hasRealData ? "real_contacts" : "contacts_but_no_email" };
  } catch (e) {
    return { authenticated: false, reason: "error: " + e.message };
  }
}

// ── Wait for tab to finish loading ──
function waitForTabLoad(tabId, ms) {
  ms = ms || 15000;
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

// ── Check if page content is substantial (not a blank/error page) ──
function checkPageLoaded() {
  try {
    var len = (document.body && document.body.innerHTML) ? document.body.innerHTML.length : 0;
    return { length: len, loaded: len > 5000 };
  } catch (e) {
    return { length: 0, loaded: false };
  }
}

// ── Extract contacts for a single WCA ID (with retry for failed loads) ──
async function extractContactsForId(wcaId) {
  var MAX_RETRIES = 1;
  var RETRY_DELAYS = [5000];

  for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    var tab = null;
    try {
      tab = await chrome.tabs.create({
        url: "https://www.wcaworld.com/directory/members/" + wcaId,
        active: false,
      });

      await waitForTabLoad(tab.id, 30000);

      // Check if page actually loaded (not blank/error)
      var loadCheck = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: checkPageLoaded,
      });
      var pageLoadResult = loadCheck[0] && loadCheck[0].result;
      var pageLoaded = pageLoadResult && pageLoadResult.loaded;

      if (!pageLoaded && attempt < MAX_RETRIES) {
        // Page didn't load — retry after delay
        console.log("[WCA Extension] Page not loaded for " + wcaId + " (attempt " + (attempt + 1) + "/" + (MAX_RETRIES + 1) + ", length=" + (pageLoadResult ? pageLoadResult.length : 0) + "), retrying...");
        try { chrome.tabs.remove(tab.id); } catch (e) {}
        await new Promise(function(r) { setTimeout(r, RETRY_DELAYS[attempt]); });
        continue;
      }

      var results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractContactsFromPage,
      });

      var pageData = results[0] && results[0].result;
      if (pageData) {
        pageData.wcaId = wcaId;
        pageData.pageLoaded = !!pageLoaded;
      }

      return pageData || { wcaId: wcaId, contacts: [], pageLoaded: !!pageLoaded, error: "No data" };
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.log("[WCA Extension] Error for " + wcaId + " (attempt " + (attempt + 1) + "), retrying: " + err.message);
        await new Promise(function(r) { setTimeout(r, RETRY_DELAYS[attempt]); });
        continue;
      }
      return { wcaId: wcaId, contacts: [], pageLoaded: false, error: err.message };
    } finally {
      if (tab) {
        try { chrome.tabs.remove(tab.id); } catch (e) {}
      }
    }
  }

  return { wcaId: wcaId, contacts: [], pageLoaded: false, error: "Max retries exceeded" };
}

// ── Verify WCA session by opening a known profile ──
async function verifyWcaSession() {
  var TEST_WCA_ID = 86580;
  var tab = await chrome.tabs.create({
    url: "https://www.wcaworld.com/directory/members/" + TEST_WCA_ID,
    active: false,
  });

  try {
    await waitForTabLoad(tab.id, 15000);

    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: checkSessionOnPage,
    });

    var sessionResult = results[0] && results[0].result;




    return sessionResult || { authenticated: false, reason: "no_result" };
  } catch (err) {
    return { authenticated: false, reason: "error: " + err.message };
  } finally {
    try { chrome.tabs.remove(tab.id); } catch (e) {}
  }
}

// ── Sync all WCA cookies to the server (improved .ASPXAUTH capture) ──
async function syncWcaCookiesToServer() {
  try {
    // Collect cookies from multiple sources to maximize .ASPXAUTH capture
    var cookieMap = {}; // name -> value (deduplication)

    // Method 1: domain-based getAll
    var domainVariants = [".wcaworld.com", "wcaworld.com", "www.wcaworld.com"];
    for (var d = 0; d < domainVariants.length; d++) {
      try {
        var cookies = await chrome.cookies.getAll({ domain: domainVariants[d] });
        for (var c = 0; c < cookies.length; c++) {
          cookieMap[cookies[c].name] = cookies[c].value;
        }
      } catch (e) { /* ignore */ }
    }

    // Method 2: URL-based getAll (may capture HttpOnly cookies better)
    try {
      var urlCookies = await chrome.cookies.getAll({ url: "https://www.wcaworld.com/" });
      for (var u = 0; u < urlCookies.length; u++) {
        cookieMap[urlCookies[u].name] = urlCookies[u].value;
      }
    } catch (e) { /* ignore */ }

    // Method 3: Direct .ASPXAUTH lookup by name (explicit HttpOnly capture attempt)
    try {
      var aspxCookie = await chrome.cookies.get({ url: "https://www.wcaworld.com/", name: ".ASPXAUTH" });
      if (aspxCookie) {
        cookieMap[aspxCookie.name] = aspxCookie.value;
      }
    } catch (e) { /* ignore */ }

    // Also try ASP.NET_SessionId
    try {
      var sessionCookie = await chrome.cookies.get({ url: "https://www.wcaworld.com/", name: "ASP.NET_SessionId" });
      if (sessionCookie) {
        cookieMap[sessionCookie.name] = sessionCookie.value;
      }
    } catch (e) { /* ignore */ }

    // Build cookie string
    var names = Object.keys(cookieMap);
    if (names.length === 0) {
      return { success: false, error: "No WCA cookies found" };
    }

    var cookieString = names.map(function (name) { return name + "=" + cookieMap[name]; }).join("; ");
    var hasAspxAuth = !!cookieMap[".ASPXAUTH"];

    var res = await fetch(SUPABASE_URL + "/functions/v1/save-wca-cookie", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ cookie: cookieString }),
    });
    var result = await res.json();
    return { success: true, authenticated: result.authenticated, cookieLength: cookieString.length, hasAspxAuth: hasAspxAuth };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Save contacts to server ──
async function sendContactsToServer(dataArray) {
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
  return await res.json();
}

// ── Listen for messages from content script (webapp bridge) ──
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.source !== "wca-content-bridge") return false;

  if (message.action === "ping") {
    sendResponse({ success: true, version: "5.0" });
    return false;
  }

  if (message.action === "extractContacts") {
    var wcaId = message.wcaId;
    if (!wcaId) {
      sendResponse({ success: false, error: "wcaId required" });
      return false;
    }

    (async function () {
      try {
        var result = await extractContactsForId(wcaId);
        if (result.contacts && result.contacts.length > 0) {
          await sendContactsToServer([result]);
        }
        sendResponse({
          success: true,
          wcaId: wcaId,
          contacts: result.contacts || [],
          companyName: result.companyName,
          pageLoaded: result.pageLoaded !== undefined ? result.pageLoaded : true,
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message, wcaId: wcaId });
      }
    })();
    return true;
  }

  if (message.action === "verifySession") {
    (async function () {
      try {
        var result = await verifyWcaSession();
        sendResponse({ success: true, authenticated: result.authenticated, reason: result.reason });
      } catch (err) {
        sendResponse({ success: false, authenticated: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === "syncCookie") {
    (async function () {
      try {
        var result = await syncWcaCookiesToServer();
        sendResponse(result);
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});

// ── Register extension ID on install ──
chrome.runtime.onInstalled.addListener(async function () {
  var extensionId = chrome.runtime.id;
  console.log("[WCA Extension] Installed, ID:", extensionId);

  try {
    await fetch(SUPABASE_URL + "/rest/v1/app_settings?key=eq.chrome_extension_id", {
      method: "GET",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      },
    }).then(async function (res) {
      var existing = await res.json();
      if (existing && existing.length > 0) {
        await fetch(SUPABASE_URL + "/rest/v1/app_settings?key=eq.chrome_extension_id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ value: extensionId }),
        });
      } else {
        await fetch(SUPABASE_URL + "/rest/v1/app_settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ key: "chrome_extension_id", value: extensionId }),
        });
      }
    });
    console.log("[WCA Extension] ID saved to app_settings");
  } catch (err) {
    console.error("[WCA Extension] Failed to save ID:", err);
  }

  // Auto-sync cookies on install
  await syncWcaCookiesToServer();
});
