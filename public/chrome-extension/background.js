// ══════════════════════════════════════════════════
// WCA Chrome Extension — Background Service Worker
// V3: Extract-only. No server saving. Honest contract.
// ══════════════════════════════════════════════════

// ── Profile extraction function (injected into WCA tab) ──
function extractFullProfileFromPage() {
  try {
    var result = {
      wcaId: null, companyName: null, contacts: [], profileHtml: null,
      profile: {
        address: null, phone: null, fax: null, mobile: null,
        emergencyPhone: null, email: null, website: null,
        memberSince: null, membershipExpires: null, officeType: null,
        description: null, networks: [], services: [], certifications: [], branchCities: []
      }
    };

    // WCA ID from URL
    var urlMatch = window.location.href.match(/\/directory\/members\/(\d+)/i);
    if (urlMatch) result.wcaId = parseInt(urlMatch[1]);

    // Company name from H1
    var h1 = document.querySelector("h1");
    if (h1) result.companyName = h1.textContent.trim();

    // Raw HTML
    result.profileHtml = document.body.innerHTML;

    // ── Company-level profile_label / profile_val pairs ──
    var allLabels = document.querySelectorAll("[class*='profile_label']");
    for (var li = 0; li < allLabels.length; li++) {
      var label = allLabels[li];
      var inContact = false;
      var parent = label.parentElement;
      while (parent) {
        if (parent.className && typeof parent.className === "string" && parent.className.indexOf("contactperson_row") >= 0) { inContact = true; break; }
        parent = parent.parentElement;
      }
      if (inContact) continue;

      var labelText = label.textContent.trim().replace(/:$/, "");
      var valEl = label.nextElementSibling;
      if (!valEl || (valEl.className && typeof valEl.className === "string" && valEl.className.indexOf("profile_val") < 0)) {
        var par = label.parentElement;
        if (par) { var next = par.nextElementSibling; if (next) valEl = next.querySelector("[class*='profile_val']") || next; }
      }
      var value = valEl ? valEl.textContent.trim() : "";
      if (/Members\s*only/i.test(value) || /please.*Login/i.test(value)) value = "";
      if (!value) continue;

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

    // Description
    var descCandidates = document.querySelectorAll("[class*='profile_description'], [class*='company_description'], [class*='member_description']");
    for (var di = 0; di < descCandidates.length; di++) {
      var txt = descCandidates[di].textContent.trim();
      if (txt.length > 30) { result.profile.description = txt; break; }
    }
    if (!result.profile.description) {
      var allVals = document.querySelectorAll("[class*='profile_val']");
      for (var vi = 0; vi < allVals.length; vi++) { var vt = allVals[vi].textContent.trim(); if (vt.length > 200) { result.profile.description = vt; break; } }
    }

    // Networks
    var networkEls = document.querySelectorAll("[class*='network'], [class*='membership']");
    for (var ni = 0; ni < networkEls.length; ni++) {
      var rows = networkEls[ni].querySelectorAll("tr, [class*='row']");
      for (var nri = 0; nri < rows.length; nri++) {
        var cells = rows[nri].querySelectorAll("td, [class*='col'], [class*='val']");
        if (cells.length >= 1) {
          var netName = cells[0].textContent.trim();
          var netExpires = cells.length >= 2 ? cells[1].textContent.trim() : "";
          if (netName && netName.length > 2 && !/^Network$/i.test(netName) && !/^Name$/i.test(netName))
            result.profile.networks.push({ name: netName, expires: netExpires || null });
        }
      }
    }

    // Services
    var serviceEls = document.querySelectorAll("[class*='service'], [class*='specialit'], [class*='capability']");
    for (var si = 0; si < serviceEls.length; si++) {
      var badges = serviceEls[si].querySelectorAll("span, li, a, div");
      for (var bi = 0; bi < badges.length; bi++) {
        var svc = badges[bi].textContent.trim();
        if (svc && svc.length > 2 && svc.length < 80 && result.profile.services.indexOf(svc) < 0) result.profile.services.push(svc);
      }
    }

    // Certifications
    var certEls = document.querySelectorAll("[class*='certif'], [class*='accredit']");
    for (var ci = 0; ci < certEls.length; ci++) {
      var cBadges = certEls[ci].querySelectorAll("span, li, a, img, div");
      for (var cbi = 0; cbi < cBadges.length; cbi++) {
        var cert = (cBadges[cbi].alt || cBadges[cbi].title || cBadges[cbi].textContent || "").trim();
        if (cert && cert.length > 1 && cert.length < 50 && result.profile.certifications.indexOf(cert) < 0) result.profile.certifications.push(cert);
      }
    }

    // Branch cities
    var branchEls = document.querySelectorAll("[class*='branch'], [class*='office_list']");
    for (var bri = 0; bri < branchEls.length; bri++) {
      var items = branchEls[bri].querySelectorAll("li, a, span, div");
      for (var bii = 0; bii < items.length; bii++) {
        var bc = items[bii].textContent.trim();
        if (bc && bc.length > 1 && bc.length < 60 && result.profile.branchCities.indexOf(bc) < 0) result.profile.branchCities.push(bc);
      }
    }

    // ── Contacts ──
    var allRows = document.querySelectorAll("[class*='contactperson_row']");
    if (allRows.length === 0) {
      var allEls = document.querySelectorAll("*");
      var contactRows = [];
      for (var i = 0; i < allEls.length; i++) {
        if (allEls[i].className && typeof allEls[i].className === "string" && allEls[i].className.indexOf("contactperson_row") >= 0) contactRows.push(allEls[i]);
      }
      allRows = contactRows;
    }

    for (var r = 0; r < allRows.length; r++) {
      var row = allRows[r];
      var contact = {};
      var labels2 = row.querySelectorAll("[class*='profile_label']");
      for (var l = 0; l < labels2.length; l++) {
        var cLabelText = labels2[l].textContent.trim().replace(/:$/, "");
        var cValEl = labels2[l].nextElementSibling;
        if (!cValEl || (cValEl.className && cValEl.className.indexOf("profile_val") < 0)) {
          var cParent = labels2[l].parentElement;
          if (cParent) { var cNext = cParent.nextElementSibling; if (cNext) cValEl = cNext.querySelector("[class*='profile_val']") || cNext; }
        }
        var cValue = cValEl ? cValEl.textContent.trim() : "";
        if (/Members\s*only/i.test(cValue) || /please.*Login/i.test(cValue)) cValue = "";

        if (/^Title$/i.test(cLabelText)) contact.title = cValue;
        else if (/^Name$/i.test(cLabelText)) contact.name = cValue;
        else if (/^Email$/i.test(cLabelText)) {
          var cEmailLink = cValEl ? cValEl.querySelector("a[href^='mailto:']") : null;
          if (cEmailLink) contact.email = cEmailLink.href.replace("mailto:", "").trim();
          else if (cValue && cValue.indexOf("@") >= 0) contact.email = cValue;
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

// ── Page load check (injected into WCA tab) ──
function checkPageLoaded() {
  try {
    var len = (document.body && document.body.innerHTML) ? document.body.innerHTML.length : 0;
    var h1 = document.querySelector("h1");
    var h1Text = h1 ? h1.textContent.trim() : "";
    var h1HasCompanyName = h1Text.length > 3 && !/error/i.test(h1Text) && !/login/i.test(h1Text) && !/not found/i.test(h1Text) && !/sign in/i.test(h1Text);
    var memberNotFound = h1Text.toLowerCase().indexOf("member not found") >= 0 || h1Text.toLowerCase().indexOf("not found") >= 0;
    var loaded = len > 2000 || (h1HasCompanyName && len > 500);
    return { length: len, loaded: loaded, h1Text: h1Text, memberNotFound: memberNotFound };
  } catch (e) {
    return { length: 0, loaded: false, h1Text: "", memberNotFound: false };
  }
}

// ── Tab management with retry on "Tabs cannot be edited" ──
async function safeCreateTab(url, retries) {
  retries = retries || 3;
  for (var attempt = 0; attempt < retries; attempt++) {
    try { return await chrome.tabs.create({ url: url, active: false }); }
    catch (e) {
      if (attempt < retries - 1 && e.message && e.message.indexOf("cannot be edited") >= 0)
        await new Promise(function(r) { setTimeout(r, 500 + attempt * 500); });
      else throw e;
    }
  }
}

async function safeRemoveTab(tabId) {
  for (var attempt = 0; attempt < 3; attempt++) {
    try { await chrome.tabs.remove(tabId); return; }
    catch (e) {
      if (attempt < 2 && e.message && e.message.indexOf("cannot be edited") >= 0)
        await new Promise(function(r) { setTimeout(r, 300 + attempt * 300); });
      else return;
    }
  }
}

function waitForTabLoad(tabId, ms) {
  ms = ms || 20000;
  return new Promise(function (resolve) {
    var timeout = setTimeout(function () { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, ms);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timeout); chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1500);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ── Core extraction: open tab → check page → extract → return structured result ──
async function extractContactsForId(wcaId) {
  var tab = null;
  try {
    tab = await safeCreateTab("https://www.wcaworld.com/directory/members/" + wcaId);
    await waitForTabLoad(tab.id, 20000);

    // Check page loaded
    var loadCheck = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: checkPageLoaded });
    var pageResult = loadCheck[0] && loadCheck[0].result;

    if (!pageResult || !pageResult.loaded) {
      return {
        success: false, wcaId: wcaId, state: "not_loaded",
        companyName: null, contacts: [], profile: {}, profileHtml: null,
        htmlLength: pageResult ? pageResult.length : 0, error: "Page not loaded"
      };
    }

    if (pageResult.memberNotFound) {
      return {
        success: false, wcaId: wcaId, state: "member_not_found",
        companyName: pageResult.h1Text || null, contacts: [], profile: {}, profileHtml: null,
        htmlLength: pageResult.length, error: null
      };
    }

    // Extract profile
    var results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractFullProfileFromPage });
    var pageData = results[0] && results[0].result;

    if (!pageData || pageData.error) {
      return {
        success: false, wcaId: wcaId, state: "extraction_error",
        companyName: null, contacts: [], profile: {}, profileHtml: null,
        htmlLength: 0, error: pageData ? pageData.error : "No data returned"
      };
    }

    // Check for member not found in extracted company name
    var cn = (pageData.companyName || "").toLowerCase();
    if (cn.indexOf("member not found") >= 0 || cn.indexOf("not found") >= 0) {
      return {
        success: false, wcaId: wcaId, state: "member_not_found",
        companyName: pageData.companyName, contacts: [], profile: {}, profileHtml: pageData.profileHtml,
        htmlLength: pageData.profileHtml ? pageData.profileHtml.length : 0, error: null
      };
    }

    return {
      success: true, wcaId: wcaId, state: "ok",
      companyName: pageData.companyName || null,
      contacts: pageData.contacts || [],
      profile: pageData.profile || {},
      profileHtml: pageData.profileHtml || null,
      htmlLength: pageData.profileHtml ? pageData.profileHtml.length : 0,
      error: null
    };
  } catch (err) {
    return {
      success: false, wcaId: wcaId, state: "bridge_error",
      companyName: null, contacts: [], profile: {}, profileHtml: null,
      htmlLength: 0, error: err.message
    };
  } finally {
    if (tab) safeRemoveTab(tab.id);
  }
}

// ── Message listener ──
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.source !== "wca-content-bridge") return false;

  if (message.action === "ping") {
    sendResponse({ success: true, version: "7.0" });
    return false;
  }

  if (message.action === "extractContacts") {
    var wcaId = message.wcaId;
    if (!wcaId) { sendResponse({ success: false, error: "wcaId required" }); return false; }

    (async function () {
      try {
        var result = await extractContactsForId(wcaId);
        // V3: NO server saving — return structured result only
        sendResponse(result);
      } catch (err) {
        sendResponse({ success: false, wcaId: wcaId, state: "bridge_error", error: err.message, contacts: [], profile: {} });
      }
    })();
    return true;
  }

  if (message.action === "verifySession") {
    // Simple cookie check — no page hit
    (async function () {
      try {
        var aspxAuth = await chrome.cookies.get({ url: "https://www.wcaworld.com/", name: ".ASPXAUTH" });
        if (aspxAuth && aspxAuth.value && (!aspxAuth.expirationDate || aspxAuth.expirationDate * 1000 > Date.now())) {
          sendResponse({ success: true, authenticated: true, reason: "aspxauth_present" });
          return;
        }
        var wcaCookie = await chrome.cookies.get({ url: "https://www.wcaworld.com/", name: "wca" });
        if (wcaCookie && wcaCookie.value && (!wcaCookie.expirationDate || wcaCookie.expirationDate * 1000 > Date.now())) {
          sendResponse({ success: true, authenticated: true, reason: "wca_cookie_present" });
          return;
        }
        sendResponse({ success: true, authenticated: false, reason: "no_auth_cookies" });
      } catch (err) {
        sendResponse({ success: false, authenticated: false, error: err.message });
      }
    })();
    return true;
  }

  // Removed: autoLogin, syncCookie — not needed in V3
  return false;
});

// ── On install — register extension ID ──
chrome.runtime.onInstalled.addListener(async function () {
  var SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";
  var extensionId = chrome.runtime.id;
  console.log("[WCA Extension] Installed, ID:", extensionId);
  try {
    var res = await fetch(SUPABASE_URL + "/rest/v1/app_settings?key=eq.chrome_extension_id", {
      method: "GET", headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY }
    });
    var existing = await res.json();
    if (existing && existing.length > 0) {
      await fetch(SUPABASE_URL + "/rest/v1/app_settings?key=eq.chrome_extension_id", {
        method: "PATCH", headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
        body: JSON.stringify({ value: extensionId })
      });
    } else {
      await fetch(SUPABASE_URL + "/rest/v1/app_settings", {
        method: "POST", headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
        body: JSON.stringify({ key: "chrome_extension_id", value: extensionId })
      });
    }
  } catch (err) { console.error("[WCA Extension] Failed to save ID:", err); }
});
