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

// ── Extract contacts for a single WCA ID ──
async function extractContactsForId(wcaId) {
  var tab = await chrome.tabs.create({
    url: "https://www.wcaworld.com/directory/members/" + wcaId,
    active: false,
  });

  try {
    await waitForTabLoad(tab.id, 15000);

    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractContactsFromPage,
    });

    var pageData = results[0] && results[0].result;
    if (pageData) pageData.wcaId = wcaId;

    return pageData || { wcaId: wcaId, contacts: [], error: "No data" };
  } catch (err) {
    return { wcaId: wcaId, contacts: [], error: err.message };
  } finally {
    try { chrome.tabs.remove(tab.id); } catch (e) {}
  }
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

    // If authenticated, also sync the cookie
    if (sessionResult && sessionResult.authenticated) {
      await syncWcaCookiesToServer();
    }

    return sessionResult || { authenticated: false, reason: "no_result" };
  } catch (err) {
    return { authenticated: false, reason: "error: " + err.message };
  } finally {
    try { chrome.tabs.remove(tab.id); } catch (e) {}
  }
}

// ── Sync all WCA cookies to the server ──
async function syncWcaCookiesToServer() {
  try {
    var cookies = await chrome.cookies.getAll({ domain: ".wcaworld.com" });
    if (!cookies || cookies.length === 0) {
      cookies = await chrome.cookies.getAll({ domain: "wcaworld.com" });
    }
    if (!cookies || cookies.length === 0) {
      cookies = await chrome.cookies.getAll({ domain: "www.wcaworld.com" });
    }

    if (!cookies || cookies.length === 0) {
      return { success: false, error: "No WCA cookies found" };
    }

    var cookieString = cookies.map(function (c) { return c.name + "=" + c.value; }).join("; ");

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
    return { success: true, authenticated: result.authenticated, cookieLength: cookieString.length };
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
    sendResponse({ success: true, version: "4.0" });
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
