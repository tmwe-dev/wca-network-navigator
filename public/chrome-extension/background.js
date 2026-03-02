// ══════════════════════════════════════════════════
// WCA Cookie Sync - Background Service Worker
// Handles automated contact extraction, FULL PROFILE extraction, session verification, and cookie sync
// ══════════════════════════════════════════════════

var SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

// ── Extract FULL PROFILE + contacts from a WCA profile page (injected into tab) ──
function extractFullProfileFromPage() {
  try {
    var result = {
      wcaId: null,
      companyName: null,
      contacts: [],
      profileHtml: null,
      profile: {
        address: null,
        phone: null,
        fax: null,
        mobile: null,
        emergencyPhone: null,
        email: null,
        website: null,
        memberSince: null,
        membershipExpires: null,
        officeType: null,
        description: null,
        networks: [],
        services: [],
        certifications: [],
        branchCities: []
      }
    };

    // ── WCA ID from URL ──
    var urlMatch = window.location.href.match(/\/directory\/members\/(\d+)/i);
    if (urlMatch) result.wcaId = parseInt(urlMatch[1]);

    // ── Company name from H1 ──
    var h1 = document.querySelector("h1");
    if (h1) result.companyName = h1.textContent.trim();

    // ── Capture raw HTML of the entire page ──
    result.profileHtml = document.body.innerHTML;

    // ══════════════════════════════════════════════════
    // PART A: Extract all profile_label / profile_val pairs (company-level data)
    // ══════════════════════════════════════════════════
    var allLabels = document.querySelectorAll("[class*='profile_label']");
    for (var li = 0; li < allLabels.length; li++) {
      var label = allLabels[li];
      // Skip labels inside contactperson_row (those are contacts, handled in Part B)
      var inContact = false;
      var parent = label.parentElement;
      while (parent) {
        if (parent.className && typeof parent.className === "string" && parent.className.indexOf("contactperson_row") >= 0) {
          inContact = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (inContact) continue;

      var labelText = label.textContent.trim().replace(/:$/, "");
      var valEl = label.nextElementSibling;
      if (!valEl || (valEl.className && typeof valEl.className === "string" && valEl.className.indexOf("profile_val") < 0)) {
        var par = label.parentElement;
        if (par) {
          var next = par.nextElementSibling;
          if (next) {
            valEl = next.querySelector("[class*='profile_val']") || next;
          }
        }
      }

      var value = valEl ? valEl.textContent.trim() : "";
      if (/Members\s*only/i.test(value) || /please.*Login/i.test(value)) value = "";
      if (!value) continue;

      // Map label to profile field
      if (/^Address$/i.test(labelText)) result.profile.address = value;
      else if (/^Phone$/i.test(labelText)) result.profile.phone = value;
      else if (/^Fax$/i.test(labelText)) result.profile.fax = value;
      else if (/^Mobile$/i.test(labelText)) result.profile.mobile = value;
      else if (/^Emergency\s*Phone$/i.test(labelText)) result.profile.emergencyPhone = value;
      else if (/^Email$/i.test(labelText)) {
        var emailLink = valEl ? valEl.querySelector("a[href^='mailto:']") : null;
        result.profile.email = emailLink ? emailLink.href.replace("mailto:", "").trim() : (value.indexOf("@") >= 0 ? value : null);
      }
      else if (/^Web\s*site$/i.test(labelText) || /^Website$/i.test(labelText) || /^URL$/i.test(labelText)) {
        var link = valEl ? valEl.querySelector("a[href]") : null;
        result.profile.website = link ? link.href : value;
      }
      else if (/^Member\s*Since$/i.test(labelText)) result.profile.memberSince = value;
      else if (/^Membership\s*Expires$/i.test(labelText) || /^Expiry$/i.test(labelText) || /^Expires$/i.test(labelText)) result.profile.membershipExpires = value;
      else if (/^Office\s*Type$/i.test(labelText)) result.profile.officeType = value;
    }

    // ── Description / Profile text (look for large text blocks) ──
    var descCandidates = document.querySelectorAll("[class*='profile_description'], [class*='company_description'], [class*='member_description'], .profile-description, .company-profile-text");
    for (var di = 0; di < descCandidates.length; di++) {
      var txt = descCandidates[di].textContent.trim();
      if (txt.length > 30) {
        result.profile.description = txt;
        break;
      }
    }
    // Fallback: look for large profile_val blocks that aren't a known field
    if (!result.profile.description) {
      var allVals = document.querySelectorAll("[class*='profile_val']");
      for (var vi = 0; vi < allVals.length; vi++) {
        var vt = allVals[vi].textContent.trim();
        if (vt.length > 200) {
          result.profile.description = vt;
          break;
        }
      }
    }

    // ── Networks (look for network listing sections) ──
    var networkEls = document.querySelectorAll("[class*='network'], [class*='membership']");
    for (var ni = 0; ni < networkEls.length; ni++) {
      var nel = networkEls[ni];
      // Look for rows within the network section
      var rows = nel.querySelectorAll("tr, [class*='row']");
      for (var nri = 0; nri < rows.length; nri++) {
        var cells = rows[nri].querySelectorAll("td, [class*='col'], [class*='val']");
        if (cells.length >= 1) {
          var netName = cells[0] ? cells[0].textContent.trim() : "";
          var netExpires = cells.length >= 2 ? cells[1].textContent.trim() : "";
          if (netName && netName.length > 2 && !/^Network$/i.test(netName) && !/^Name$/i.test(netName)) {
            result.profile.networks.push({ name: netName, expires: netExpires || null });
          }
        }
      }
    }
    // Fallback: look for links/badges with network names
    if (result.profile.networks.length === 0) {
      var netLinks = document.querySelectorAll("a[href*='network'], img[alt*='WCA'], img[title*='WCA']");
      for (var nli = 0; nli < netLinks.length; nli++) {
        var netText = netLinks[nli].alt || netLinks[nli].title || netLinks[nli].textContent || "";
        netText = netText.trim();
        if (netText && netText.length > 3 && result.profile.networks.every(function(n) { return n.name !== netText; })) {
          result.profile.networks.push({ name: netText, expires: null });
        }
      }
    }

    // ── Services (look for service tags/badges) ──
    var serviceEls = document.querySelectorAll("[class*='service'], [class*='specialit'], [class*='capability']");
    for (var si = 0; si < serviceEls.length; si++) {
      var badges = serviceEls[si].querySelectorAll("span, li, a, div");
      for (var bi = 0; bi < badges.length; bi++) {
        var svc = badges[bi].textContent.trim();
        if (svc && svc.length > 2 && svc.length < 80 && result.profile.services.indexOf(svc) < 0) {
          result.profile.services.push(svc);
        }
      }
    }

    // ── Certifications ──
    var certEls = document.querySelectorAll("[class*='certif'], [class*='accredit']");
    for (var ci = 0; ci < certEls.length; ci++) {
      var cBadges = certEls[ci].querySelectorAll("span, li, a, img, div");
      for (var cbi = 0; cbi < cBadges.length; cbi++) {
        var cert = (cBadges[cbi].alt || cBadges[cbi].title || cBadges[cbi].textContent || "").trim();
        if (cert && cert.length > 1 && cert.length < 50 && result.profile.certifications.indexOf(cert) < 0) {
          result.profile.certifications.push(cert);
        }
      }
    }

    // ── Branch cities ──
    var branchEls = document.querySelectorAll("[class*='branch'], [class*='office_list']");
    for (var bri = 0; bri < branchEls.length; bri++) {
      var items = branchEls[bri].querySelectorAll("li, a, span, div");
      for (var bii = 0; bii < items.length; bii++) {
        var bc = items[bii].textContent.trim();
        if (bc && bc.length > 1 && bc.length < 60 && result.profile.branchCities.indexOf(bc) < 0) {
          result.profile.branchCities.push(bc);
        }
      }
    }

    // ══════════════════════════════════════════════════
    // PART B: Extract contacts (same logic as before)
    // ══════════════════════════════════════════════════
    var allRows = document.querySelectorAll("[class*='contactperson_row'], .contactperson_row, tr.contactperson_row, div.contactperson_row");

    if (allRows.length === 0) {
      var allEls = document.querySelectorAll("*");
      var contactRows = [];
      for (var i = 0; i < allEls.length; i++) {
        if (allEls[i].className && typeof allEls[i].className === "string" && allEls[i].className.indexOf("contactperson_row") >= 0) {
          contactRows.push(allEls[i]);
        }
      }
      allRows = contactRows;
    }

    for (var r = 0; r < allRows.length; r++) {
      var row = allRows[r];
      var contact = {};

      var labels = row.querySelectorAll("[class*='profile_label']");
      for (var l = 0; l < labels.length; l++) {
        var cLabelText = labels[l].textContent.trim().replace(/:$/, "");
        var cValEl = labels[l].nextElementSibling;
        if (!cValEl || (cValEl.className && cValEl.className.indexOf("profile_val") < 0)) {
          var cParent = labels[l].parentElement;
          if (cParent) {
            var cNext = cParent.nextElementSibling;
            if (cNext) {
              cValEl = cNext.querySelector("[class*='profile_val']") || cNext;
            }
          }
        }

        var cValue = cValEl ? cValEl.textContent.trim() : "";
        if (/Members\s*only/i.test(cValue) || /please.*Login/i.test(cValue)) cValue = "";

        if (/^Title$/i.test(cLabelText)) contact.title = cValue;
        else if (/^Name$/i.test(cLabelText)) contact.name = cValue;
        else if (/^Email$/i.test(cLabelText)) {
          var cEmailLink = cValEl ? cValEl.querySelector("a[href^='mailto:']") : null;
          if (cEmailLink) {
            contact.email = cEmailLink.href.replace("mailto:", "").trim();
          } else if (cValue && cValue.indexOf("@") >= 0) {
            contact.email = cValue;
          }
        }
        else if (/^Direct\s*Line$/i.test(cLabelText) || /^Phone$/i.test(cLabelText)) contact.phone = cValue;
        else if (/^Mobile$/i.test(cLabelText)) contact.mobile = cValue;
      }

      if (contact.title || contact.name) {
        if (!contact.name && contact.title) contact.name = contact.title;
        result.contacts.push(contact);
      }
    }

    return result;
  } catch (e) {
    return { error: e.message, contacts: [], profile: {} };
  }
}

// ── Check if a page has real authenticated contact data ──
function checkSessionOnPage() {
  try {
    var bodyText = document.body.innerText || "";
    if (/please.*log\s*in/i.test(bodyText) || /sign\s*in.*to.*continue/i.test(bodyText)) {
      return { authenticated: false, reason: "login_prompt" };
    }

    // Check for "Member Not Found" — means session expired or member doesn't exist
    var h1 = document.querySelector("h1");
    var h1Text = h1 ? h1.textContent.trim().toLowerCase() : "";
    if (h1Text.indexOf("member not found") >= 0 || h1Text.indexOf("not found") >= 0) {
      return { authenticated: false, reason: "member_not_found_on_test_profile" };
    }

    // Check for "Members only" text — strong signal of expired session
    if (/Members\s*only/i.test(bodyText)) {
      return { authenticated: false, reason: "members_only_visible" };
    }

    var contactRows = document.querySelectorAll("[class*='contactperson_row']");
    if (contactRows.length === 0) {
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
      // Page loaded but no contact rows — NOT enough to confirm auth
      // Check for profile_label/profile_val pairs with real data (not "Members only")
      var profileVals = document.querySelectorAll("[class*='profile_val']");
      var hasRealProfileData = false;
      for (var pv = 0; pv < profileVals.length; pv++) {
        var pvText = profileVals[pv].textContent.trim();
        if (pvText.length > 5 && !/Members\s*only/i.test(pvText) && !/please.*Login/i.test(pvText) && pvText.indexOf("@") >= 0) {
          hasRealProfileData = true;
          break;
        }
      }
      return { authenticated: hasRealProfileData, reason: hasRealProfileData ? "profile_has_real_data" : "no_contact_rows_no_real_data" };
    }

    var hasRealData = false;
    for (var r = 0; r < contactRows.length; r++) {
      var text = contactRows[r].innerText || "";
      if (text.indexOf("@") >= 0 && !/Members\s*only/i.test(text)) {
        hasRealData = true;
        break;
      }
    }

    return { authenticated: hasRealData, reason: hasRealData ? "real_contacts" : "contacts_but_members_only" };
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
    // Smart check: if H1 has a real company name (not error/login), page is loaded even if short
    var h1 = document.querySelector("h1");
    var h1Text = h1 ? h1.textContent.trim() : "";
    var h1HasCompanyName = h1Text.length > 3 
      && !/error/i.test(h1Text) 
      && !/login/i.test(h1Text) 
      && !/not found/i.test(h1Text)
      && !/sign in/i.test(h1Text);
    var loaded = len > 2000 || (h1HasCompanyName && len > 500);
    return { length: len, loaded: loaded, h1Text: h1Text };
  } catch (e) {
    return { length: 0, loaded: false, h1Text: "" };
  }
}

// ── Extract FULL PROFILE for a single WCA ID ──
async function extractContactsForId(wcaId) {
  var tab = null;
  try {
    tab = await chrome.tabs.create({
      url: "https://www.wcaworld.com/directory/members/" + wcaId,
      active: false,
    });

    await waitForTabLoad(tab.id, 30000);

    // Check if page actually loaded
    var loadCheck = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: checkPageLoaded,
    });
    var pageLoadResult = loadCheck[0] && loadCheck[0].result;
    var pageLoaded = pageLoadResult && pageLoadResult.loaded;

    if (!pageLoaded) {
      var notLoadedHtmlLen = pageLoadResult ? pageLoadResult.length : 0;
      console.log("[WCA Extension] Page not loaded for " + wcaId + " (length=" + notLoadedHtmlLen + "), skipping.");
      return { wcaId: wcaId, contacts: [], profile: {}, pageLoaded: false, error: "Page not loaded", htmlLength: notLoadedHtmlLen };
    }

    // Use the new full-profile extraction function
    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractFullProfileFromPage,
    });

    var pageData = results[0] && results[0].result;
    if (pageData) {
      pageData.wcaId = wcaId;
      pageData.pageLoaded = true;
      pageData.htmlLength = pageData.profileHtml ? pageData.profileHtml.length : 0;
    }

    return pageData || { wcaId: wcaId, contacts: [], profile: {}, pageLoaded: true, error: "No data", htmlLength: 0 };
  } catch (err) {
    return { wcaId: wcaId, contacts: [], profile: {}, pageLoaded: false, error: err.message };
  } finally {
    if (tab) {
      try { chrome.tabs.remove(tab.id); } catch (e) {}
    }
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
    var cookieMap = {};

    var domainVariants = [".wcaworld.com", "wcaworld.com", "www.wcaworld.com"];
    for (var d = 0; d < domainVariants.length; d++) {
      try {
        var cookies = await chrome.cookies.getAll({ domain: domainVariants[d] });
        for (var c = 0; c < cookies.length; c++) {
          cookieMap[cookies[c].name] = cookies[c].value;
        }
      } catch (e) { /* ignore */ }
    }

    try {
      var urlCookies = await chrome.cookies.getAll({ url: "https://www.wcaworld.com/" });
      for (var u = 0; u < urlCookies.length; u++) {
        cookieMap[urlCookies[u].name] = urlCookies[u].value;
      }
    } catch (e) { /* ignore */ }

    try {
      var aspxCookie = await chrome.cookies.get({ url: "https://www.wcaworld.com/", name: ".ASPXAUTH" });
      if (aspxCookie) cookieMap[aspxCookie.name] = aspxCookie.value;
    } catch (e) { /* ignore */ }

    try {
      var sessionCookie = await chrome.cookies.get({ url: "https://www.wcaworld.com/", name: "ASP.NET_SessionId" });
      if (sessionCookie) cookieMap[sessionCookie.name] = sessionCookie.value;
    } catch (e) { /* ignore */ }

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

// ── Save contacts + profile to server ──
async function sendContactsToServer(dataArray) {
  var batch = dataArray.map(function (d) {
    return {
      wcaId: d.wcaId,
      contacts: d.contacts,
      profile: d.profile || {},
      profileHtml: d.profileHtml || null
    };
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
    sendResponse({ success: true, version: "6.0" });
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
          profile: result.profile || {},
          profileHtml: result.profileHtml || null,
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

  if (message.action === "autoLogin") {
    (async function () {
      try {
        var username = message.username;
        var password = message.password;
        if (!username || !password) {
          sendResponse({ success: false, error: "Credenziali mancanti" });
          return;
        }

        // Open WCA login page in background tab
        var tab = await chrome.tabs.create({
          url: "https://www.wcaworld.com/Account/Login",
          active: false,
        });

        await waitForTabLoad(tab.id, 20000);

        // Inject and fill login form
        function fillAndSubmitLogin(u, p) {
          try {
            var userInput = document.querySelector("#UserName") || document.querySelector("input[name='UserName']") || document.querySelector("input[type='text']") || document.querySelector("input[type='email']");
            var passInput = document.querySelector("#Password") || document.querySelector("input[name='Password']") || document.querySelector("input[type='password']");
            if (!userInput || !passInput) return { success: false, error: "Campi non trovati" };
            var nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            userInput.focus(); nativeSet.call(userInput, u); userInput.dispatchEvent(new Event("input", { bubbles: true })); userInput.dispatchEvent(new Event("change", { bubbles: true }));
            passInput.focus(); nativeSet.call(passInput, p); passInput.dispatchEvent(new Event("input", { bubbles: true })); passInput.dispatchEvent(new Event("change", { bubbles: true }));
            var submitBtn = document.querySelector("input[type='submit']") || document.querySelector("button[type='submit']") || document.querySelector(".btn-login") || document.querySelector("button.btn-primary");
            var form = userInput.closest("form") || document.querySelector("form");
            if (submitBtn) { submitBtn.click(); } else if (form) { form.submit(); } else { return { success: false, error: "Nessun submit trovato" }; }
            return { success: true };
          } catch (e) { return { success: false, error: e.message }; }
        }

        var injRes = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: fillAndSubmitLogin,
          args: [username, password],
        });
        var formResult = injRes[0] && injRes[0].result;
        if (!formResult || !formResult.success) {
          try { chrome.tabs.remove(tab.id); } catch (e) {}
          sendResponse({ success: false, error: (formResult && formResult.error) || "Form non trovato" });
          return;
        }

        // Wait for redirect after login
        await new Promise(function (resolve) {
          var timeout = setTimeout(function () { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 10000);
          var navigated = false;
          function listener(id, info) {
            if (id === tab.id && info.status === "complete" && !navigated) {
              navigated = true; clearTimeout(timeout);
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(resolve, 2000);
            }
          }
          chrome.tabs.onUpdated.addListener(listener);
        });

        // Sync cookies after login
        await syncWcaCookiesToServer();

        try { chrome.tabs.remove(tab.id); } catch (e) {}
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
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

  await syncWcaCookiesToServer();
});
